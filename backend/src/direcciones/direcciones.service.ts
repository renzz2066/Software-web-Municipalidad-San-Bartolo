import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GrupoCatalogo, Prisma } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  LARGO_DIRECCION_FISCAL,
  LARGO_LITERAL,
  claveDireccion,
  componerLiteral,
  errorComponentes,
  errorCoordenadas,
  errorUbicacion,
  normalizarValor,
  type Componente,
} from './direccion.reglas.js';
import { ActualizarDireccionDto, BuscarDireccionesDto, CrearDireccionDto, EstadoDireccionDto } from './dto/direccion.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

// Editar o dar de baja una dirección cambia el domicilio de todos los que la usan: lo decide un supervisor.
const ROLES_SUPERVISION = ['SUPERVISOR', 'ADMIN'];

export interface Actor {
  id: number;
  rol: string;
}

const SELECT_LISTA = {
  id: true,
  direccion: true,
  referencia: true,
  activo: true,
  _count: { select: { contribuyentes: true, predios: true } },
} satisfies Prisma.DireccionSelect;

interface Partes {
  ubigeo: string;
  zonaId: number | null;
  urbanizacionId: number | null;
  viaId: number | null;
  componentes: Componente[];
  referencia: string | null;
  latitud: number | null;
  longitud: number | null;
}

const mayus = (v?: string | null) => {
  const t = v?.trim();
  return t ? t.replace(/\s+/g, ' ').toUpperCase() : null;
};

// Direcciones únicas (specs/rentas-nucleo-v2.md, Fase 2; reglas D01–D05). Sin borrado: una
// dirección que ya no se usa se desactiva; quien ya la tenía la conserva.
@Injectable()
export class DireccionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogos: CatalogosService,
  ) {}

  // P11: el distrito propio es un dato de la base (regla muni.ubigeo), no del código.
  ubigeoMuni(db: Db = this.prisma) {
    return this.catalogos.valorRegla<string>('muni.ubigeo', db);
  }

  async config() {
    const codigo = await this.ubigeoMuni();
    const distrito = await this.prisma.ubigeo.findUnique({
      where: { codigo },
      select: { codigo: true, departamento: true, provincia: true, distrito: true },
    });
    return { ubigeo: codigo, distrito };
  }

  // Cada palabra debe aparecer en la literal o en la referencia ("pinos 123" encuentra "AV LOS PINOS N° 123").
  async buscar(dto: BuscarDireccionesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const palabras = (dto.q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
    const where: Prisma.DireccionWhereInput = {
      ...(dto.incluirInactivas === 'true' ? {} : { activo: true }),
      AND: palabras.map((p) => ({
        OR: [{ direccion: { contains: p, mode: 'insensitive' } }, { referencia: { contains: p, mode: 'insensitive' } }],
      })),
    };
    // Solo lectura: Promise.all (la forma batch de $transaction está bloqueada por auditoría).
    const [items, total] = await Promise.all([
      this.prisma.direccion.findMany({
        where,
        select: SELECT_LISTA,
        orderBy: { direccion: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.direccion.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: number) {
    const d = await this.prisma.direccion.findUnique({
      where: { id },
      include: {
        componentes: { orderBy: { orden: 'asc' }, select: { id: true, orden: true, componente: true, valor: true } },
        zona: { select: { id: true, codigo: true, nombre: true } },
        urbanizacion: { select: { id: true, codigo: true, nombre: true } },
        via: { select: { id: true, tipoVia: true, nombre: true } },
        contribuyentes: {
          select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true, estado: true },
          orderBy: { nombreCompleto: 'asc' },
          take: 50,
        },
        predios: {
          select: { id: true, nombre: true, codigoCatastro: true, codigoLegacy: true, estado: true },
          orderBy: { id: 'asc' },
          take: 50,
        },
        _count: { select: { contribuyentes: true, predios: true } },
      },
    });
    if (!d) throw new NotFoundException('La dirección no existe');
    const distrito = await this.prisma.ubigeo.findUnique({
      where: { codigo: d.ubigeo },
      select: { departamento: true, provincia: true, distrito: true },
    });
    const { creadoPorId: _c, modificadoPorId: _m, clave: _k, ...datos } = d;
    return { ...datos, distrito };
  }

  async crear(dto: CrearDireccionDto) {
    const id = await this.escribir(async (tx) => {
      const partes: Partes = {
        ubigeo: await this.ubigeoMuni(tx),
        zonaId: dto.zonaId ?? null,
        urbanizacionId: dto.urbanizacionId ?? null,
        viaId: dto.viaId ?? null,
        componentes: dto.componentes,
        referencia: mayus(dto.referencia),
        latitud: dto.latitud ?? null,
        longitud: dto.longitud ?? null,
      };
      const armada = await this.armar(tx, partes, []);
      await this.asegurarUnica(tx, armada.clave, null);
      const creada = await tx.direccion.create({
        data: {
          ubigeo: partes.ubigeo,
          zonaId: partes.zonaId,
          urbanizacionId: partes.urbanizacionId,
          viaId: partes.viaId,
          direccion: armada.literal,
          clave: armada.clave,
          referencia: partes.referencia,
          latitud: partes.latitud,
          longitud: partes.longitud,
          componentes: { create: armada.componentes.map((c, i) => ({ orden: i + 1, ...c })) },
        },
        select: { id: true },
      });
      return creada.id;
    });
    return this.findOne(id);
  }

  async actualizar(id: number, dto: ActualizarDireccionDto, actor: Actor) {
    this.exigirSupervisor(actor, 'editar una dirección');
    await this.escribir(async (tx) => {
      const actual = await tx.direccion.findUnique({
        where: { id },
        include: { componentes: { orderBy: { orden: 'asc' } }, _count: { select: { predios: true } } },
      });
      if (!actual) throw new NotFoundException('La dirección no existe');
      const toma = <T>(v: T | undefined, previo: T) => (v !== undefined ? v : previo);
      const partes: Partes = {
        // El ubigeo de una dirección no cambia: sigue en su distrito.
        ubigeo: actual.ubigeo,
        zonaId: toma(dto.zonaId, actual.zonaId),
        urbanizacionId: toma(dto.urbanizacionId, actual.urbanizacionId),
        viaId: toma(dto.viaId, actual.viaId),
        componentes: dto.componentes ?? actual.componentes.map((c) => ({ componente: c.componente, valor: c.valor })),
        referencia: dto.referencia !== undefined ? mayus(dto.referencia) : actual.referencia,
        latitud: dto.latitud !== undefined ? dto.latitud : actual.latitud === null ? null : Number(actual.latitud),
        longitud: dto.longitud !== undefined ? dto.longitud : actual.longitud === null ? null : Number(actual.longitud),
      };
      const armada = await this.armar(
        tx,
        partes,
        actual.componentes.map((c) => c.componente),
      );
      await this.asegurarUnica(tx, armada.clave, id);
      // La ubicación de un predio (vía, sector, Mz., Lt.) cambia su arancel y sus arbitrios: eso se
      // declara con una DJ del predio, no corrigiendo la dirección. Aquí solo referencia y coordenadas.
      if (actual._count.predios > 0 && armada.clave !== actual.clave) {
        throw new ConflictException(
          `La usan ${actual._count.predios} predio(s): su ubicación se corrige con una DJ del predio. Aquí solo cambia la referencia o las coordenadas.`,
        );
      }
      await tx.direccion.update({
        where: { id },
        data: {
          zonaId: partes.zonaId,
          urbanizacionId: partes.urbanizacionId,
          viaId: partes.viaId,
          direccion: armada.literal,
          clave: armada.clave,
          referencia: partes.referencia,
          latitud: partes.latitud,
          longitud: partes.longitud,
        },
      });
      await this.sincronizarComponentes(tx, id, actual.componentes, armada.componentes);
      // D01: la misma dirección para todos. Quien la usa ve la literal nueva en recibos y valores.
      if (armada.literal !== actual.direccion) {
        await tx.contribuyente.updateMany({
          where: { direccionId: id },
          data: { direccionFiscal: armada.literal.slice(0, LARGO_DIRECCION_FISCAL) },
        });
      }
      return id;
    });
    return this.findOne(id);
  }

  async cambiarEstado(id: number, dto: EstadoDireccionDto, actor: Actor) {
    this.exigirSupervisor(actor, dto.activo ? 'reactivar una dirección' : 'dar de baja una dirección');
    const d = await this.prisma.direccion.findUnique({ where: { id }, select: { activo: true } });
    if (!d) throw new NotFoundException('La dirección no existe');
    if (d.activo !== dto.activo) await this.prisma.direccion.update({ where: { id }, data: { activo: dto.activo } });
    return this.findOne(id);
  }

  // Para el domicilio de una persona (P11): la dirección debe existir y estar activa, salvo que
  // la persona ya la tuviera (una baja no le quita su domicilio).
  async paraDomicilio(tx: Db, id: number, actualId: number | null) {
    const d = await tx.direccion.findUnique({ where: { id }, select: { id: true, ubigeo: true, direccion: true, activo: true } });
    if (!d) throw new BadRequestException('La dirección elegida no existe');
    if (!d.activo && d.id !== actualId) throw new BadRequestException('La dirección elegida está dada de baja: elige otra');
    return d;
  }

  // Para el predio (D01): la DJ trae vía, sector, habilitación, N°, Mz. y Lt.; si esa dirección ya
  // existe se reusa (aunque esté de baja: el predio sigue ahí), si no se crea. Va dentro de la
  // transacción de la DJ.
  async obtenerOCrear(
    tx: Prisma.TransactionClient,
    p: { zonaId: number | null; urbanizacionId: number | null; viaId: number | null; componentes: Componente[]; referencia: string | null },
  ) {
    const partes: Partes = { ...p, ubigeo: await this.ubigeoMuni(tx), referencia: mayus(p.referencia), latitud: null, longitud: null };
    const armada = await this.armar(tx, partes, partes.componentes.map((c) => c.componente));
    const existente = await tx.direccion.findUnique({ where: { clave: armada.clave }, select: { id: true, direccion: true } });
    if (existente) return existente;
    return tx.direccion.create({
      data: {
        ubigeo: partes.ubigeo,
        zonaId: partes.zonaId,
        urbanizacionId: partes.urbanizacionId,
        viaId: partes.viaId,
        direccion: armada.literal,
        clave: armada.clave,
        referencia: partes.referencia,
        componentes: { create: armada.componentes.map((c, i) => ({ orden: i + 1, ...c })) },
      },
      select: { id: true, direccion: true },
    });
  }

  // ---- auxiliares ----

  private exigirSupervisor(actor: Actor, accion: string) {
    if (!ROLES_SUPERVISION.includes(actor.rol)) {
      throw new ForbiddenException(`Solo un supervisor puede ${accion}: cambia el domicilio de todos los que la usan`);
    }
  }

  private async escribir<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Otra persona acaba de registrar esa dirección. Búscala y vuelve a intentar.');
      }
      throw e;
    }
  }

  // Valida todo antes de escribir y arma la literal (D04) y la clave (D01).
  private async armar(tx: Prisma.TransactionClient, p: Partes, vigentes: string[]) {
    const componentes = p.componentes.map((c) => ({ componente: c.componente, valor: normalizarValor(c.valor) }));
    const error = errorUbicacion(p) ?? errorComponentes(componentes) ?? errorCoordenadas(p.latitud, p.longitud);
    if (error) throw new BadRequestException(error);
    const tipos = await this.catalogos.asegurarCodigos(
      tx,
      GrupoCatalogo.COMPONENTE_DIRECCION,
      componentes.map((c) => c.componente),
      'Componente de dirección',
      vigentes,
    );
    const [via, urbanizacion, zona, ubigeo] = await Promise.all([
      p.viaId ? tx.via.findUnique({ where: { id: p.viaId }, select: { tipoVia: true, nombre: true } }) : null,
      p.urbanizacionId ? tx.urbanizacion.findUnique({ where: { id: p.urbanizacionId }, select: { nombre: true } }) : null,
      p.zonaId ? tx.zona.findUnique({ where: { id: p.zonaId }, select: { nombre: true } }) : null,
      tx.ubigeo.findUnique({ where: { codigo: p.ubigeo }, select: { distrito: true } }),
    ]);
    if (p.viaId && !via) throw new BadRequestException('La vía seleccionada ya no existe');
    if (p.urbanizacionId && !urbanizacion) throw new BadRequestException('La habilitación urbana seleccionada ya no existe');
    if (p.zonaId && !zona) throw new BadRequestException('El sector seleccionado ya no existe');
    const literal = componerLiteral({
      via,
      componentes: componentes.map((c) => {
        const item = tipos.get(c.componente)!;
        return { abreviatura: item.abreviatura ?? item.nombre, valor: c.valor };
      }),
      habilitacion: urbanizacion?.nombre ?? null,
      sector: zona?.nombre ?? null,
      distrito: ubigeo?.distrito ?? null,
    });
    if (literal.length > LARGO_LITERAL) throw new BadRequestException(`La dirección pasa de ${LARGO_LITERAL} caracteres: revisa los componentes`);
    return { componentes, literal, clave: claveDireccion({ ...p, componentes }) };
  }

  // D01: no se duplica. El 409 trae el id para que el formulario use la que ya existe.
  private async asegurarUnica(tx: Prisma.TransactionClient, clave: string, propioId: number | null) {
    const otra = await tx.direccion.findUnique({ where: { clave }, select: { id: true, direccion: true, activo: true } });
    if (otra && otra.id !== propioId) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Esa dirección ya está registrada${otra.activo ? '' : ' (dada de baja)'}: ${otra.direccion}`,
        direccionId: otra.id,
      });
    }
  }

  // Se conserva lo que no cambió para que la auditoría quede limpia.
  private async sincronizarComponentes(
    tx: Prisma.TransactionClient,
    direccionId: number,
    actuales: { id: number; componente: string; valor: string; orden: number }[],
    nuevos: Componente[],
  ) {
    const porCodigo = new Map(nuevos.map((c, i) => [c.componente, { ...c, orden: i + 1 }]));
    const quitar = actuales.filter((a) => !porCodigo.has(a.componente)).map((a) => a.id);
    if (quitar.length) await tx.direccionComponente.deleteMany({ where: { id: { in: quitar } } });
    for (const a of actuales) {
      const n = porCodigo.get(a.componente);
      if (n && (n.valor !== a.valor || n.orden !== a.orden)) {
        await tx.direccionComponente.update({ where: { id: a.id }, data: { valor: n.valor, orden: n.orden } });
      }
    }
    const existentes = new Set(actuales.map((a) => a.componente));
    const crear = [...porCodigo.values()].filter((c) => !existentes.has(c.componente)).map((c) => ({ direccionId, ...c }));
    if (crear.length) await tx.direccionComponente.createMany({ data: crear });
  }
}
