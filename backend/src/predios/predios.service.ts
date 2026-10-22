import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoRegistro, MotivoDeclaracion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { anioValido } from '../rentas/maestros/maestros.reglas.js';
import { validarDeclaracion } from './declaracion.reglas.js';
import { DatosPredioDto, DeclaracionDto } from './dto/declaracion.dto.js';

type Tx = Prisma.TransactionClient;

// Una DJ hace ~15 consultas seguidas; con la latencia a Supabase el límite de 5 s no alcanza.
const OPCIONES_TX = { maxWait: 10_000, timeout: 20_000 };

const INCLUDE_PREDIO = {
  zona: { select: { id: true, codigo: true, nombre: true } },
  urbanizacion: { select: { id: true, codigo: true, nombre: true } },
  via: { select: { id: true, tipoVia: true, nombre: true } },
  pisos: { orderBy: { nivel: 'asc' } },
  otrasInstalaciones: { orderBy: { id: 'asc' } },
  contribuyentes: {
    where: { estado: EstadoRegistro.ACTIVO },
    select: {
      porcentaje: true,
      esPrincipal: true,
      fechaAdquisicion: true,
      contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
    },
    orderBy: [{ esPrincipal: 'desc' }, { contribuyenteId: 'asc' }],
  },
} satisfies Prisma.PredioInclude;

@Injectable()
export class PrediosService {
  constructor(private readonly prisma: PrismaService) {}

  // Catálogos de ubicación en solo lectura para quien registra DDJJ (sin nivel de maestros).
  async catalogos() {
    const [zonas, urbanizaciones, vias] = await Promise.all([
      this.prisma.zona.findMany({ orderBy: { codigo: 'asc' } }),
      this.prisma.urbanizacion.findMany({ orderBy: { nombre: 'asc' } }),
      this.prisma.via.findMany({ orderBy: [{ nombre: 'asc' }, { tipoVia: 'asc' }] }),
    ]);
    return { zonas, urbanizaciones, vias };
  }

  async findOne(id: number) {
    const predio = await this.prisma.predio.findUnique({
      where: { id },
      include: {
        ...INCLUDE_PREDIO,
        declaraciones: {
          select: {
            id: true,
            anio: true,
            motivo: true,
            fecha: true,
            observacion: true,
            contribuyente: { select: { id: true, nombreCompleto: true } },
          },
          orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        },
      },
    });
    if (!predio) {
      throw new NotFoundException('El predio no existe');
    }
    return predio;
  }

  async findDeclaracion(id: number) {
    const dj = await this.prisma.declaracionJurada.findUnique({
      where: { id },
      include: { contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } } },
    });
    if (!dj) {
      throw new NotFoundException('La declaración no existe');
    }
    return dj;
  }

  // Toda DJ cambia el predio y queda versionada con su foto (snapshot), en una sola transacción.
  async declarar(dto: DeclaracionDto) {
    if (!anioValido(dto.anio)) {
      throw new BadRequestException('El año no es válido');
    }
    if (dto.motivo !== MotivoDeclaracion.BAJA && !dto.predio) {
      throw new BadRequestException('Completa los datos del predio');
    }
    const fecha = dto.fecha.slice(0, 10);

    return this.prisma.$transaction(async (tx) => {
      const actual = dto.predioId
        ? await tx.predio.findUnique({
            where: { id: dto.predioId },
            select: { id: true, estado: true, contribuyentes: { where: { estado: EstadoRegistro.ACTIVO }, select: { contribuyenteId: true } } },
          })
        : null;
      if (dto.predioId && !actual) {
        throw new NotFoundException('El predio no existe');
      }
      if (actual?.estado === EstadoRegistro.BAJA) {
        throw new ConflictException('El predio está dado de baja');
      }

      const error = validarDeclaracion(
        { ...dto, fecha },
        { hoy: new Date().toISOString().slice(0, 10), titularesActuales: actual?.contribuyentes.map((c) => c.contribuyenteId) ?? [] },
      );
      if (error) {
        throw new BadRequestException(error);
      }
      await this.asegurarContribuyentes(tx, [dto.declaranteId, ...dto.condominos.map((c) => c.contribuyenteId)]);

      let predioId: number;
      if (dto.motivo === MotivoDeclaracion.BAJA) {
        predioId = actual!.id;
        await tx.predio.update({ where: { id: predioId }, data: { estado: EstadoRegistro.BAJA } });
        await tx.predioContribuyente.updateMany({
          where: { predioId, estado: EstadoRegistro.ACTIVO },
          data: { estado: EstadoRegistro.BAJA },
        });
      } else {
        const datos = this.datosPredio(dto.predio!, dto);
        predioId = actual
          ? (await tx.predio.update({ where: { id: actual.id }, data: datos })).id
          : (await tx.predio.create({ data: datos })).id;
        await this.reemplazarConstruccion(tx, predioId, dto);
        await this.sincronizarCondominos(tx, predioId, dto, fecha);
      }

      const snapshot = await tx.predio.findUniqueOrThrow({ where: { id: predioId }, include: INCLUDE_PREDIO });
      const dj = await tx.declaracionJurada.create({
        data: {
          predioId,
          contribuyenteId: dto.declaranteId,
          anio: dto.anio,
          motivo: dto.motivo,
          fecha: new Date(fecha),
          snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
          observacion: dto.observacion?.trim() || null,
        },
        select: { id: true },
      });
      return { declaracionId: dj.id, predioId };
    }, OPCIONES_TX);
  }

  private datosPredio(p: DatosPredioDto, dto: DeclaracionDto) {
    const texto = (v?: string) => v?.trim().toUpperCase() || null;
    const areaConstruida = dto.pisos.reduce((acc, piso) => acc + Math.round(piso.areaConstruida * 100), 0) / 100;
    return {
      zonaId: p.zonaId ?? null,
      urbanizacionId: p.urbanizacionId ?? null,
      viaId: p.viaId,
      numero: texto(p.numero),
      manzana: texto(p.manzana),
      lote: texto(p.lote),
      referencia: texto(p.referencia),
      codigoCatastro: texto(p.codigoCatastro),
      areaTerreno: p.areaTerreno,
      areaConstruida,
      usoPredio: texto(p.usoPredio),
    };
  }

  // Pisos e instalaciones se declaran completos en cada DJ (la versión anterior queda en el snapshot).
  private async reemplazarConstruccion(tx: Tx, predioId: number, dto: DeclaracionDto) {
    await tx.otraInstalacion.deleteMany({ where: { predioId } });
    await tx.piso.deleteMany({ where: { predioId } });
    if (dto.pisos.length) {
      await tx.piso.createMany({
        data: dto.pisos.map((p) => ({
          predioId,
          nivel: p.nivel.trim().toUpperCase(),
          anioConstruccion: p.anioConstruccion ?? null,
          clasificacion: p.clasificacion,
          material: p.material,
          estadoConservacion: p.estadoConservacion,
          categorias: p.categorias,
          areaConstruida: p.areaConstruida,
        })),
      });
    }
    if (dto.otrasInstalaciones.length) {
      await tx.otraInstalacion.createMany({
        data: dto.otrasInstalaciones.map((o) => ({
          predioId,
          descripcion: o.descripcion.trim().toUpperCase(),
          unidad: o.unidad?.trim().toUpperCase() || null,
          cantidad: o.cantidad ?? null,
          valor: o.valor ?? null,
        })),
      });
    }
  }

  // Los condóminos enviados quedan ACTIVOS con su %; los que salen pasan a BAJA (historial intacto).
  private async sincronizarCondominos(tx: Tx, predioId: number, dto: DeclaracionDto, fecha: string) {
    const ids = dto.condominos.map((c) => c.contribuyenteId);
    await tx.predioContribuyente.updateMany({
      where: { predioId, estado: EstadoRegistro.ACTIVO, contribuyenteId: { notIn: ids } },
      data: { estado: EstadoRegistro.BAJA, esPrincipal: false },
    });
    for (const [i, c] of dto.condominos.entries()) {
      await tx.predioContribuyente.upsert({
        where: { contribuyenteId_predioId: { contribuyenteId: c.contribuyenteId, predioId } },
        update: { porcentaje: c.porcentaje, esPrincipal: i === 0, estado: EstadoRegistro.ACTIVO },
        create: {
          contribuyenteId: c.contribuyenteId,
          predioId,
          porcentaje: c.porcentaje,
          esPrincipal: i === 0,
          fechaAdquisicion: new Date(fecha),
        },
      });
    }
  }

  private async asegurarContribuyentes(tx: Tx, ids: number[]) {
    const unicos = [...new Set(ids)];
    const encontrados = await tx.contribuyente.findMany({
      where: { id: { in: unicos }, estado: { not: EstadoRegistro.BAJA } },
      select: { id: true },
    });
    if (encontrados.length !== unicos.length) {
      throw new BadRequestException('Algún contribuyente no existe o está dado de baja');
    }
  }
}
