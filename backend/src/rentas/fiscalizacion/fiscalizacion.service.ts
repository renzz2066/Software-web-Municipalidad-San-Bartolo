import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoFiscalizacion, EstadoRegistro, ModalidadNotificacion, Prisma, TipoFiscalizacion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DatosPredioDto, OtraInstalacionDto, PisoDto } from '../../predios/dto/declaracion.dto.js';
import { INCLUDE_PREDIO } from '../../predios/predios.service.js';
import { reservarCorrelativos } from '../correlativos.js';
import { iso } from '../estado-cuenta/tasas.js';
import { hoyLima } from '../fechas.js';
import { type AccionExpediente, errorAccion, errorExpediente, errorRequerimiento, estadoTrasFichas, rangoFiscalizable } from './fiscalizacion.reglas.js';

type Tx = Prisma.TransactionClient;

const OPCIONES_TX = { maxWait: 10_000, timeout: 20_000 };
const ZONA_LIMA = '-05:00';

export interface AperturaEntrada {
  tipo: TipoFiscalizacion;
  contribuyenteId: number;
  fiscalizadorId: number;
  anioDesde: number;
  anioHasta: number;
  predioIds: number[];
  observacion?: string;
}

export interface RequerimientoEntrada {
  fechaInspeccion: string; // AAAA-MM-DD
  horaInspeccion: string; // HH:MM, hora de Lima
  notificacion?: { fecha: string; modalidad: ModalidadNotificacion; dni?: string; nombre?: string } | null;
}

// Ficha de inspección (F3): los mismos datos que una DJ del predio, más lo observado en campo.
export interface FichaEntrada {
  predio: DatosPredioDto;
  pisos: PisoDto[];
  otrasInstalaciones: OtraInstalacionDto[];
  observacion?: string;
}

const SELECT_CONTRIBUYENTE = {
  id: true,
  tipoPersona: true,
  tipoDoc: true,
  numDoc: true,
  nombreCompleto: true,
  direccionFiscal: true,
  codigoLegacy: true,
} as const;

const limaFechaHora = (d: Date) => {
  const lima = new Date(d.getTime() - 5 * 3_600_000).toISOString();
  return { fecha: lima.slice(0, 10), hora: lima.slice(11, 16) };
};

// Expedientes de fiscalización (specs/rentas-fiscalizacion-v1.md, F1–F3): apertura con número FIS,
// requerimiento de inspección con su notificación y ficha por predio. La ficha no cambia el predio:
// eso lo hace la resolución (fase C) con una DJ de motivo FISCALIZACION.
@Injectable()
export class FiscalizacionService {
  constructor(private readonly prisma: PrismaService) {}

  // Datos para abrir un expediente: predios activos del contribuyente, si declaró, años permitidos.
  async opciones(contribuyenteId: number) {
    const anioActual = Number(hoyLima().slice(0, 4));
    const [contribuyente, predios, conDJ, fiscalizadores] = await Promise.all([
      this.prisma.contribuyente.findUnique({ where: { id: contribuyenteId }, select: SELECT_CONTRIBUYENTE }),
      this.prisma.predio.findMany({
        where: { estado: { not: EstadoRegistro.BAJA }, contribuyentes: { some: { contribuyenteId, estado: EstadoRegistro.ACTIVO } } },
        select: { id: true, numero: true, manzana: true, lote: true, usoPredio: true, via: { select: { id: true, tipoVia: true, nombre: true } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.declaracionJurada.count({ where: { contribuyenteId } }),
      this.prisma.fiscalizador.findMany({ where: { activo: true }, select: { id: true, nombre: true, dni: true }, orderBy: { nombre: 'asc' } }),
    ]);
    if (!contribuyente) {
      throw new NotFoundException('El contribuyente no existe');
    }
    const rango = rangoFiscalizable(anioActual, conDJ === 0);
    return {
      contribuyente,
      predios,
      fiscalizadores,
      sinDeclaracion: conDJ === 0,
      rango,
      aniosConParametros: await this.aniosConParametros(this.prisma, rango.desde, rango.hasta),
    };
  }

  async abrir(e: AperturaEntrada) {
    const hoy = hoyLima();
    const anio = Number(hoy.slice(0, 4));
    const { id } = await this.prisma.$transaction(async (tx) => {
      const contribuyente = await tx.contribuyente.findUnique({ where: { id: e.contribuyenteId }, select: { estado: true } });
      if (!contribuyente || contribuyente.estado === EstadoRegistro.BAJA) {
        throw new BadRequestException('El contribuyente no existe o está dado de baja');
      }
      const fiscalizador = await tx.fiscalizador.findUnique({ where: { id: e.fiscalizadorId }, select: { activo: true } });
      if (!fiscalizador?.activo) {
        throw new BadRequestException('Elige un fiscalizador activo');
      }
      const titulares = await tx.predioContribuyente.count({
        where: { contribuyenteId: e.contribuyenteId, predioId: { in: e.predioIds }, estado: EstadoRegistro.ACTIVO, predio: { estado: { not: EstadoRegistro.BAJA } } },
      });
      if (titulares !== new Set(e.predioIds).size) {
        throw new BadRequestException('Algún predio no es del contribuyente o está dado de baja');
      }
      const sinDeclaracion = (await tx.declaracionJurada.count({ where: { contribuyenteId: e.contribuyenteId } })) === 0;
      const error = errorExpediente({
        anioDesde: e.anioDesde,
        anioHasta: e.anioHasta,
        predioIds: e.predioIds,
        anioActual: anio,
        sinDeclaracion,
        aniosConParametros: await this.aniosConParametros(tx, e.anioDesde, e.anioHasta),
      });
      if (error) {
        throw new BadRequestException(error);
      }
      const [numero] = await reservarCorrelativos(tx, 'FIS', anio);
      return tx.fiscalizacion.create({
        data: {
          anio,
          numero,
          tipo: e.tipo,
          contribuyenteId: e.contribuyenteId,
          fiscalizadorId: e.fiscalizadorId,
          anioDesde: e.anioDesde,
          anioHasta: e.anioHasta,
          observacion: e.observacion?.trim() || null,
          predios: { create: e.predioIds.map((predioId) => ({ predioId })) },
        },
        select: { id: true },
      });
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  async listar(filtros: { contribuyenteId?: number; estado?: EstadoFiscalizacion; anio?: number }) {
    const expedientes = await this.prisma.fiscalizacion.findMany({
      where: { contribuyenteId: filtros.contribuyenteId, estado: filtros.estado, anio: filtros.anio },
      select: {
        id: true,
        anio: true,
        numero: true,
        tipo: true,
        estado: true,
        anioDesde: true,
        anioHasta: true,
        fechaInspeccion: true,
        createdAt: true,
        contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
        fiscalizador: { select: { nombre: true } },
        _count: { select: { predios: true } },
      },
      orderBy: [{ anio: 'desc' }, { numero: 'desc' }],
      take: 200,
    });
    return expedientes.map(({ anio, numero, fechaInspeccion, createdAt, _count, fiscalizador, ...x }) => ({
      ...x,
      numero: `${anio}-${numero}`,
      fechaApertura: limaFechaHora(createdAt).fecha,
      inspeccion: fechaInspeccion ? limaFechaHora(fechaInspeccion) : null,
      fiscalizador: fiscalizador.nombre,
      predios: _count.predios,
    }));
  }

  async obtener(id: number) {
    const f = await this.prisma.fiscalizacion.findUnique({
      where: { id },
      include: {
        contribuyente: { select: SELECT_CONTRIBUYENTE },
        fiscalizador: { select: { id: true, nombre: true, dni: true } },
        creadoPor: { select: { nombres: true, apellidos: true } },
        predios: { include: { predio: { include: INCLUDE_PREDIO } }, orderBy: { predioId: 'asc' } },
      },
    });
    if (!f) {
      throw new NotFoundException('El expediente no existe');
    }
    return {
      id: f.id,
      numero: `${f.anio}-${f.numero}`,
      tipo: f.tipo,
      estado: f.estado,
      anioDesde: f.anioDesde,
      anioHasta: f.anioHasta,
      fechaApertura: limaFechaHora(f.createdAt).fecha,
      observacion: f.observacion,
      motivoAnulacion: f.motivoAnulacion,
      abiertoPor: f.creadoPor ? `${f.creadoPor.nombres} ${f.creadoPor.apellidos}`.trim() : null,
      contribuyente: f.contribuyente,
      fiscalizador: f.fiscalizador,
      inspeccion: f.fechaInspeccion ? limaFechaHora(f.fechaInspeccion) : null,
      notificacion: f.fechaNotificacion
        ? { fecha: iso(f.fechaNotificacion), modalidad: f.modalidadNotificacion, dni: f.notificadoDni, nombre: f.notificadoNombre }
        : null,
      predios: f.predios.map((p) => ({ predioId: p.predioId, ficha: p.ficha, liquidacion: p.liquidacion, predio: p.predio })),
    };
  }

  async requerimiento(id: number, r: RequerimientoEntrada) {
    if (!/^\d{2}:\d{2}$/.test(r.horaInspeccion)) {
      throw new BadRequestException('La hora de inspección debe ser HH:MM');
    }
    await this.prisma.$transaction(async (tx) => {
      const f = await this.paraAccion(tx, id, 'REQUERIMIENTO');
      const error = errorRequerimiento({
        fechaApertura: limaFechaHora(f.createdAt).fecha,
        fechaInspeccion: r.fechaInspeccion,
        notificacion: r.notificacion ?? null,
        hoy: hoyLima(),
      });
      if (error) {
        throw new BadRequestException(error);
      }
      const n = r.notificacion;
      await tx.fiscalizacion.update({
        where: { id },
        data: {
          fechaInspeccion: new Date(`${r.fechaInspeccion}T${r.horaInspeccion}:00${ZONA_LIMA}`),
          fechaNotificacion: n ? new Date(n.fecha) : null,
          modalidadNotificacion: n?.modalidad ?? null,
          notificadoDni: n?.dni?.trim().toUpperCase() || null,
          notificadoNombre: n?.nombre?.trim().toUpperCase() || null,
        },
      });
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  // Graba la ficha del predio; con todas las fichas el expediente pasa a INSPECCIONADO (y vuelve a
  // ABIERTO si alguna se borra en el futuro; hoy no hay borrado de fichas).
  async guardarFicha(id: number, predioId: number, ficha: FichaEntrada) {
    await this.prisma.$transaction(async (tx) => {
      await this.paraAccion(tx, id, 'FICHA');
      const { count } = await tx.fiscalizacionPredio.updateMany({
        where: { fiscalizacionId: id, predioId },
        data: {
          ficha: JSON.parse(JSON.stringify({ ...ficha, observacion: ficha.observacion?.trim() || null })) as Prisma.InputJsonValue,
          liquidacion: Prisma.DbNull, // la ficha cambió: la liquidación anterior ya no vale
        },
      });
      if (count === 0) {
        throw new NotFoundException('El predio no forma parte del expediente');
      }
      const filas = await tx.fiscalizacionPredio.findMany({ where: { fiscalizacionId: id }, select: { ficha: true } });
      const estado = estadoTrasFichas(filas.filter((p) => p.ficha !== null).length, filas.length);
      await tx.fiscalizacion.update({ where: { id }, data: { estado } });
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  async anular(id: number, motivo: string) {
    await this.prisma.$transaction(async (tx) => {
      const f = await tx.fiscalizacion.findUnique({ where: { id }, select: { estado: true } });
      if (!f) {
        throw new NotFoundException('El expediente no existe');
      }
      const error = errorAccion(f.estado, 'ANULAR', motivo);
      if (error) {
        throw new BadRequestException(error);
      }
      const { count } = await tx.fiscalizacion.updateMany({
        where: { id, estado: f.estado },
        data: { estado: EstadoFiscalizacion.ANULADO, motivoAnulacion: motivo.trim() },
      });
      if (count === 0) {
        throw new ConflictException('El expediente cambió mientras lo editabas; recarga la página');
      }
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  private async paraAccion(tx: Tx, id: number, accion: AccionExpediente) {
    const f = await tx.fiscalizacion.findUnique({ where: { id }, select: { estado: true, createdAt: true } });
    if (!f) {
      throw new NotFoundException('El expediente no existe');
    }
    const error = errorAccion(f.estado, accion);
    if (error) {
      throw new BadRequestException(error);
    }
    return f;
  }

  // Un año se puede fiscalizar si tiene UIT y escala predial cargadas (decisión 8).
  private async aniosConParametros(db: PrismaService | Tx, desde: number, hasta: number) {
    const [uits, escalas] = await Promise.all([
      db.uit.findMany({ where: { anio: { gte: desde, lte: hasta } }, select: { anio: true } }),
      db.escalaPredial.findMany({ where: { anio: { gte: desde, lte: hasta } }, distinct: ['anio'], select: { anio: true } }),
    ]);
    const conEscala = new Set(escalas.map((e) => e.anio));
    return uits.map((u) => u.anio).filter((a) => conEscala.has(a)).sort();
  }
}
