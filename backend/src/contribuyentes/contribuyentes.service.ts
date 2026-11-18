import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Contribuyente, EstadoCuenta, EstadoPersona, EstadoRegistro, GrupoCatalogo, Prisma, TipoPersona } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EstadoCuentaService } from '../rentas/estado-cuenta/estado-cuenta.service.js';
import { hoyLima } from '../rentas/fechas.js';
import { SIN_DOCUMENTO, documentoFicticio, normalizarDocumento } from './documento.js';
import {
  BeneficioDto,
  BuscarContribuyentesDto,
  BuscarUbigeosDto,
  CambiarEstadoDto,
  CreateContribuyenteDto,
  PorDocumentoDto,
  RevocarBeneficioDto,
  UpdateContribuyenteDto,
} from './dto/contribuyente.dto.js';
import {
  componerNombre,
  errorContacto,
  errorDocumentos,
  errorFormato,
  errorNombre,
  errorRelacionados,
  estadoAlHabilitar,
  estadoCalculado,
  mensajeDeuda,
  pendientesDe,
  seSolapan,
  type Documento,
} from './persona.reglas.js';

type Tx = Prisma.TransactionClient;

// Deuda viva: lo que aún se puede cobrar (en caja, convenio o coactivo).
const ESTADOS_DEUDA: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.FRACCIONADO, EstadoCuenta.COACTIVO];
// Para sumar la deuda viva: la FRACCIONADO ya está en las cuotas del convenio (tributo FRACCION).
const ESTADOS_SALDO: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.COACTIVO];

// San Bartolo (Lima/Lima): ubigeo por defecto del alta, igual que el _codpos de SIMUN.
const UBIGEO_DEFECTO = '150129';

// P04 y P08: lo deciden un supervisor o el administrador.
const ROLES_SUPERVISION = ['SUPERVISOR', 'ADMIN'];

const SELECT_LISTA = {
  id: true,
  codigoLegacy: true,
  tipoPersona: true,
  tipoDoc: true,
  numDoc: true,
  nombreCompleto: true,
  direccionFiscal: true,
  estado: true,
} satisfies Prisma.ContribuyenteSelect;

export interface Actor {
  id: number;
  rol: string;
}

// Dirección tal como va a quedar guardada: lo del payload pisando lo que ya había.
interface Direccion {
  ubigeo: string | null;
  viaId: number | null;
  zonaId: number | null;
  urbanizacionId: number | null;
  numero: string | null;
  interior: string | null;
  manzana: string | null;
  lote: string | null;
  referencia: string | null;
}
const CAMPOS_DIRECCION = ['ubigeo', 'viaId', 'zonaId', 'urbanizacionId', 'numero', 'interior', 'manzana', 'lote', 'referencia'] as const;

interface CatalogosDireccion {
  via: { tipoVia: string; nombre: string } | null;
  urbanizacion: { nombre: string } | null;
  distrito: string | null;
}

interface ContactoLimpio {
  tipo: string;
  valor: string;
}

interface RelacionadoLimpio {
  id?: number;
  tipo: string;
  tipoDoc: string | null;
  numDoc: string | null;
  nombreCompleto: string;
  direccion: string | null;
  personaId: number | null;
  vigente: boolean;
}

// Lo que se escribe tras validar: campos de la persona y, si vinieron, sus listas.
interface Preparado {
  data: Prisma.ContribuyenteUncheckedUpdateInput & { nombreCompleto?: string; tipoDoc?: string };
  documentos?: Documento[];
  contactos?: ContactoLimpio[];
  relacionados?: RelacionadoLimpio[];
  pendientes: { numDoc: string | null; excepcionAprobadaAt: Date | null; nombreRevisado: boolean };
}

const opcional = (v?: string | null) => (v == null ? (v as undefined | null) : v.trim() || null);
const mayus = (v?: string | null) => {
  const o = opcional(v);
  return o ? o.replace(/\s+/g, ' ').toUpperCase() : o;
};

// Personas v2 (specs/rentas-nucleo-v2.md, Fase 1). Reglas P01–P18 de docs/rentas/reglas-negocio.md.
@Injectable()
export class ContribuyentesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogos: CatalogosService,
    private readonly estadoCuenta: EstadoCuentaService,
  ) {}

  // Búsqueda única: documento (cualquiera de los suyos) o código legacy si son dígitos; nombre,
  // dirección o documento si no. Por defecto no muestra inhabilitados.
  async buscar(dto: BuscarContribuyentesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const q = dto.q?.trim() ?? '';
    const where: Prisma.ContribuyenteWhereInput = {};
    if (dto.estado) where.estado = dto.estado;
    else if (dto.incluirInhabilitados !== 'true') where.estado = { not: EstadoPersona.INHABILITADO };
    if (q) {
      const doc = normalizarDocumento(q);
      const porDocumento: Prisma.ContribuyenteWhereInput = { documentos: { some: { numDoc: { startsWith: doc } } } };
      where.OR = /^\d+$/.test(doc)
        ? [porDocumento, { codigoLegacy: { startsWith: doc } }, { dniCausante: { startsWith: doc } }]
        : [
            { nombreCompleto: { contains: q, mode: 'insensitive' } },
            { direccionFiscal: { contains: q, mode: 'insensitive' } },
            porDocumento,
          ];
    }
    // Solo lectura: Promise.all (la forma batch de $transaction está bloqueada por auditoría).
    const [items, total] = await Promise.all([
      this.prisma.contribuyente.findMany({
        where,
        select: SELECT_LISTA,
        orderBy: { nombreCompleto: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contribuyente.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  // Buscador del campo ubigeo del formulario: código o nombre de distrito/provincia/departamento.
  async buscarUbigeos(dto: BuscarUbigeosDto) {
    const q = dto.q?.trim() ?? '';
    const where: Prisma.UbigeoWhereInput = q
      ? {
          OR: [
            { codigo: { startsWith: q } },
            { distrito: { contains: q, mode: 'insensitive' } },
            { provincia: { contains: q, mode: 'insensitive' } },
            { departamento: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    const items = await this.prisma.ubigeo.findMany({
      where,
      orderBy: { codigo: 'asc' },
      take: dto.limit ?? 20,
      select: { codigo: true, departamento: true, provincia: true, distrito: true },
    });
    return { items };
  }

  // P10: si el documento de un relacionado ya es de una persona registrada, se enlaza y se precarga.
  async porDocumento(dto: PorDocumentoDto) {
    const doc = await this.prisma.contribuyenteDocumento.findUnique({
      where: { tipoDoc_numDoc: { tipoDoc: dto.tipoDoc, numDoc: normalizarDocumento(dto.numDoc) } },
      select: { contribuyente: { select: { id: true, nombreCompleto: true, direccionFiscal: true, estado: true } } },
    });
    return { contribuyente: doc?.contribuyente ?? null };
  }

  async findOne(id: number) {
    const c = await this.prisma.contribuyente.findUnique({
      where: { id },
      include: {
        documentos: { orderBy: { orden: 'asc' }, select: { id: true, orden: true, tipoDoc: true, numDoc: true } },
        contactos: { orderBy: { orden: 'asc' }, select: { id: true, orden: true, tipo: true, valor: true } },
        relacionados: {
          orderBy: { orden: 'asc' },
          select: {
            id: true,
            orden: true,
            tipo: true,
            tipoDoc: true,
            numDoc: true,
            nombreCompleto: true,
            direccion: true,
            vigente: true,
            persona: { select: { id: true, nombreCompleto: true } },
          },
        },
        beneficios: { orderBy: [{ vigente: 'desc' }, { anioDesde: 'desc' }] },
        excepcionAprobadaPor: { select: { usuario: true, nombres: true, apellidos: true } },
      },
    });
    if (!c) {
      throw new NotFoundException('El contribuyente no existe');
    }
    const { creadoPorId: _c, modificadoPorId: _m, excepcionAprobadaPorId: _e, ...datos } = c;
    return { ...datos, pendientes: pendientesDe(c) };
  }

  async create(dto: CreateContribuyenteDto) {
    const { id } = await this.prisma.$transaction(async (tx) => {
      const p = await this.preparar(tx, { ...dto, documentos: dto.documentos ?? [] }, null);
      const estado = estadoCalculado(null, pendientesDe(p.pendientes));
      const creado = await tx.contribuyente.create({
        data: {
          ...(p.data as Prisma.ContribuyenteUncheckedCreateInput),
          ubigeo: (p.data.ubigeo as string | null | undefined) || UBIGEO_DEFECTO,
          estado,
        },
        select: { id: true },
      });
      await this.sincronizarListas(tx, creado.id, p);
      return creado;
    });
    return this.prisma.contribuyente.findUnique({ where: { id }, select: SELECT_LISTA });
  }

  async update(id: number, dto: UpdateContribuyenteDto) {
    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.contribuyente.findUnique({ where: { id } });
      if (!actual) throw new NotFoundException('El contribuyente no existe');
      const p = await this.preparar(tx, dto, actual);
      const estado = estadoCalculado(actual.estado, pendientesDe(p.pendientes));
      await tx.contribuyente.update({ where: { id }, data: { ...p.data, estado } });
      await this.sincronizarListas(tx, id, p);
    });
    return this.prisma.contribuyente.findUnique({ where: { id }, select: SELECT_LISTA });
  }

  // P01/P02/P16: inhabilitar exige que no haya deuda vigente; habilitar no tiene restricción.
  async cambiarEstado(id: number, dto: CambiarEstadoDto) {
    const c = await this.prisma.contribuyente.findUnique({
      where: { id },
      select: { estado: true, numDoc: true, excepcionAprobadaAt: true, nombreRevisado: true },
    });
    if (!c) throw new NotFoundException('El contribuyente no existe');
    if (dto.estado === EstadoPersona.INHABILITADO) {
      if (c.estado !== EstadoPersona.INHABILITADO) {
        await this.asegurarSinDeuda(id);
        await this.prisma.contribuyente.update({
          where: { id },
          data: { estado: EstadoPersona.INHABILITADO, motivoEstado: opcional(dto.motivo) ?? null },
        });
      }
    } else {
      await this.prisma.contribuyente.update({
        where: { id },
        data: { estado: estadoAlHabilitar(pendientesDe(c)), motivoEstado: null },
      });
    }
    return this.prisma.contribuyente.findUnique({ where: { id }, select: SELECT_LISTA });
  }

  // P01: lo usa la inhabilitación manual y, en la Fase 5, la automática al liquidar (P03).
  async asegurarSinDeuda(id: number, db: PrismaService | Tx = this.prisma) {
    const cuotas = await db.cuentaCorriente.count({ where: { contribuyenteId: id, estado: { in: ESTADOS_DEUDA } } });
    if (cuotas === 0) return;
    // El monto, con mora y reajuste al día: el mismo que vería el cajero.
    const { totales } = await this.estadoCuenta.generar(id);
    throw new ConflictException(mensajeDeuda(totales.total ?? '0'));
  }

  // P08: un supervisor acepta que la persona quede sin documento.
  async aprobarExcepcion(id: number, actor: Actor) {
    if (!ROLES_SUPERVISION.includes(actor.rol)) {
      throw new ForbiddenException('Solo un supervisor puede aprobar una persona sin documento');
    }
    const c = await this.prisma.contribuyente.findUnique({
      where: { id },
      select: { estado: true, numDoc: true, nombreRevisado: true, sinDocumentoMotivo: true, excepcionAprobadaAt: true },
    });
    if (!c) throw new NotFoundException('El contribuyente no existe');
    if (c.numDoc) throw new ConflictException('La persona ya tiene documento: no hay excepción que aprobar');
    if (c.excepcionAprobadaAt) throw new ConflictException('La excepción ya fue aprobada');
    const ahora = new Date();
    await this.prisma.contribuyente.update({
      where: { id },
      data: {
        excepcionAprobadaPorId: actor.id,
        excepcionAprobadaAt: ahora,
        estado: estadoCalculado(c.estado, pendientesDe({ ...c, excepcionAprobadaAt: ahora })),
      },
    });
    return this.findOne(id);
  }

  // P04: solo se borra un error de digitación (sin DJ, sin cuenta corriente, sin deuda ni otra historia).
  async eliminar(id: number, actor: Actor) {
    if (!ROLES_SUPERVISION.includes(actor.rol)) {
      throw new ForbiddenException('Solo un supervisor puede eliminar una persona');
    }
    const c = await this.prisma.contribuyente.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            declaraciones: true,
            cuentas: true,
            predios: true,
            recibos: true,
            pagos: true,
            valores: true,
            convenios: true,
            fiscalizaciones: true,
            coactivoExps: true,
            licencias: true,
            vehiculos: true,
          },
        },
      },
    });
    if (!c) throw new NotFoundException('El contribuyente no existe');
    const historia = Object.entries(c._count).filter(([, n]) => n > 0);
    if (historia.length) {
      throw new ConflictException('La persona tiene historia (DJ, predios, cuenta corriente o pagos): no se elimina, se inhabilita');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.contribuyenteDocumento.deleteMany({ where: { contribuyenteId: id } });
        await tx.contribuyenteContacto.deleteMany({ where: { contribuyenteId: id } });
        await tx.contribuyenteRelacionado.deleteMany({ where: { contribuyenteId: id } });
        await tx.contribuyenteBeneficio.deleteMany({ where: { contribuyenteId: id } });
        await tx.contribuyente.delete({ where: { id } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException('La persona tiene registros asociados: no se elimina, se inhabilita');
      }
      throw e;
    }
    return { id, eliminado: true };
  }

  // ---- Beneficios (P14, P15) ----

  async agregarBeneficio(id: number, dto: BeneficioDto) {
    const c = await this.prisma.contribuyente.findUnique({
      where: { id },
      select: { tipoPersona: true, tipoDoc: true, numDoc: true, beneficios: { where: { vigente: true } } },
    });
    if (!c) throw new NotFoundException('El contribuyente no existe');
    const items = await this.catalogos.asegurarCodigos(this.prisma, GrupoCatalogo.BENEFICIO, [dto.codigo], 'Beneficio');
    const item = items.get(dto.codigo)!;
    const attrs = (item.atributos ?? {}) as { regimen?: string; persona?: string; baseLegal?: string };
    if (attrs.persona === 'JURIDICA' && !(c.tipoPersona === TipoPersona.JURIDICA && c.tipoDoc === 'RUC')) {
      // P14: solo es inafecto quien está en el art. 17, y el manual exige persona jurídica con RUC.
      throw new BadRequestException(`${item.nombre}: solo para persona jurídica con RUC`);
    }
    if (attrs.persona === 'NATURAL' && c.tipoPersona !== TipoPersona.NATURAL) {
      throw new BadRequestException(`${item.nombre}: solo para persona natural`);
    }
    const anioHasta = dto.anioHasta ?? null;
    if (anioHasta !== null && anioHasta < dto.anioDesde) throw new BadRequestException('El año final no puede ser menor que el inicial');
    if (dto.fechaResolucion.slice(0, 10) > hoyLima()) throw new BadRequestException('La fecha de la resolución no puede ser futura');
    // Dos resoluciones del mismo régimen no cubren el mismo año (p. ej. pensionista y adulto mayor).
    const regimenes = await this.catalogos.asegurarCodigos(
      this.prisma,
      GrupoCatalogo.BENEFICIO,
      c.beneficios.map((b) => b.codigo),
      'Beneficio',
      c.beneficios.map((b) => b.codigo),
    );
    const choque = c.beneficios.find(
      (b) =>
        (regimenes.get(b.codigo)?.atributos as { regimen?: string } | null)?.regimen === attrs.regimen &&
        seSolapan(b, { anioDesde: dto.anioDesde, anioHasta }),
    );
    if (choque) {
      throw new ConflictException(`Ya tiene una resolución vigente del mismo régimen para esos años (${choque.resolucion}): revócala primero`);
    }
    const baseLegal = opcional(dto.baseLegal) ?? attrs.baseLegal;
    if (!baseLegal) throw new BadRequestException('Indica la base legal');
    await this.prisma.contribuyenteBeneficio.create({
      data: {
        contribuyenteId: id,
        codigo: dto.codigo,
        baseLegal,
        expediente: opcional(dto.expediente) ?? null,
        resolucion: dto.resolucion.trim().toUpperCase(),
        fechaResolucion: new Date(dto.fechaResolucion.slice(0, 10)),
        anioDesde: dto.anioDesde,
        anioHasta,
        observacion: opcional(dto.observacion) ?? null,
      },
    });
    return this.findOne(id);
  }

  async revocarBeneficio(id: number, beneficioId: number, dto: RevocarBeneficioDto) {
    const b = await this.prisma.contribuyenteBeneficio.findFirst({ where: { id: beneficioId, contribuyenteId: id } });
    if (!b) throw new NotFoundException('La resolución no existe');
    if (!b.vigente) throw new ConflictException('La resolución ya estaba revocada');
    const anioHasta = dto.anioHasta ?? b.anioHasta;
    if (anioHasta !== null && anioHasta < b.anioDesde) throw new BadRequestException('El año final no puede ser menor que el inicial');
    await this.prisma.contribuyenteBeneficio.update({
      where: { id: beneficioId },
      data: { vigente: false, anioHasta, observacion: dto.observacion.trim() },
    });
    return this.findOne(id);
  }

  // Nombres legibles del domicilio fiscal para la ficha (la dirección ya viene en direccionFiscal).
  private async direccionParaMostrar(c: Pick<Contribuyente, 'viaId' | 'zonaId' | 'urbanizacionId' | 'ubigeo'>) {
    const [via, zona, urbanizacion, distrito] = await Promise.all([
      c.viaId ? this.prisma.via.findUnique({ where: { id: c.viaId }, select: { tipoVia: true, nombre: true } }) : null,
      c.zonaId ? this.prisma.zona.findUnique({ where: { id: c.zonaId }, select: { codigo: true, nombre: true } }) : null,
      c.urbanizacionId
        ? this.prisma.urbanizacion.findUnique({ where: { id: c.urbanizacionId }, select: { nombre: true } })
        : null,
      c.ubigeo
        ? this.prisma.ubigeo.findUnique({
            where: { codigo: c.ubigeo },
            select: { departamento: true, provincia: true, distrito: true },
          })
        : null,
    ]);
    return { via, zona, urbanizacion, distrito };
  }

  // Ficha 360 (C2): datos, predios, deuda viva por año/tributo y DDJJ.
  async resumen(id: number) {
    const contribuyente = await this.findOne(id);
    const [predios, deudaAgrupada, declaraciones, ubicacion] = await Promise.all([
      this.prisma.predioContribuyente.findMany({
        where: { contribuyenteId: id, estado: { not: EstadoRegistro.BAJA } },
        select: {
          porcentaje: true,
          esPrincipal: true,
          fechaAdquisicion: true,
          predio: {
            select: {
              id: true,
              codigoLegacy: true,
              numero: true,
              manzana: true,
              lote: true,
              usoPredio: true,
              areaTerreno: true,
              areaConstruida: true,
              valorAutovaluo: true,
              estado: true,
              via: { select: { tipoVia: true, nombre: true } },
              urbanizacion: { select: { nombre: true } },
              zona: { select: { codigo: true, nombre: true } },
            },
          },
        },
        orderBy: { predioId: 'asc' },
      }),
      this.prisma.cuentaCorriente.groupBy({
        by: ['anioFiscal', 'tributoId'],
        where: { contribuyenteId: id, estado: { in: ESTADOS_SALDO } },
        _sum: { importe: true, reajuste: true, mora: true, derechoEmision: true, descuento: true },
        _count: { _all: true },
        orderBy: [{ anioFiscal: 'desc' }, { tributoId: 'asc' }],
      }),
      // DDJJ que presentó o que afectan a predios donde es o fue titular.
      this.prisma.declaracionJurada.findMany({
        where: { OR: [{ contribuyenteId: id }, { predio: { contribuyentes: { some: { contribuyenteId: id } } } }] },
        select: {
          id: true,
          predioId: true,
          anio: true,
          motivo: true,
          fecha: true,
          observacion: true,
          createdAt: true,
          contribuyente: { select: { id: true, nombreCompleto: true } },
        },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
      this.direccionParaMostrar(contribuyente),
    ]);

    const tributos = await this.prisma.tributo.findMany({
      where: { id: { in: [...new Set(deudaAgrupada.map((d) => d.tributoId))] } },
      select: { id: true, codigo: true, nombre: true },
    });
    const tributoPorId = new Map(tributos.map((t) => [t.id, t]));

    let totalDeuda = new Prisma.Decimal(0);
    const deuda = deudaAgrupada.map((d) => {
      const s = d._sum;
      const total = new Prisma.Decimal(0)
        .plus(s.importe ?? 0)
        .plus(s.reajuste ?? 0)
        .plus(s.mora ?? 0)
        .plus(s.derechoEmision ?? 0)
        .minus(s.descuento ?? 0);
      totalDeuda = totalDeuda.plus(total);
      return {
        anio: d.anioFiscal,
        tributo: tributoPorId.get(d.tributoId) ?? { id: d.tributoId, codigo: '', nombre: '' },
        cuotas: d._count._all,
        importe: s.importe ?? 0,
        reajuste: s.reajuste ?? 0,
        mora: s.mora ?? 0,
        derechoEmision: s.derechoEmision ?? 0,
        descuento: s.descuento ?? 0,
        total: total.toFixed(2),
      };
    });

    return { contribuyente: { ...contribuyente, ...ubicacion }, predios, deuda, totalDeuda: totalDeuda.toFixed(2), declaraciones };
  }

  // ---- Preparación: valida todo antes de escribir ----

  private async preparar(tx: Tx, dto: UpdateContribuyenteDto, actual: Contribuyente | null): Promise<Preparado> {
    const data: Preparado['data'] = {};
    const tipoPersona = dto.tipoPersona ?? actual?.tipoPersona ?? TipoPersona.NATURAL;
    if (dto.tipoPersona) data.tipoPersona = dto.tipoPersona;

    await this.prepararNombre(tx, dto, actual, tipoPersona, data);

    // Documentos (P06, P07, P08, P17, P18).
    let documentos: Documento[] | undefined;
    if (dto.documentos !== undefined) {
      documentos = dto.documentos.map((d) => ({ tipoDoc: d.tipoDoc, numDoc: normalizarDocumento(d.numDoc) }));
    } else if (actual && dto.tipoPersona && dto.tipoPersona !== actual.tipoPersona) {
      // Cambió el tipo de persona: sus documentos deben seguir siendo coherentes.
      const guardados = await tx.contribuyenteDocumento.findMany({ where: { contribuyenteId: actual.id }, orderBy: { orden: 'asc' } });
      const e = errorDocumentos(tipoPersona, guardados);
      if (e) throw new BadRequestException(e);
    }
    let numDocFinal = actual?.numDoc ?? null;
    if (documentos) {
      const e = errorDocumentos(tipoPersona, documentos);
      if (e) throw new BadRequestException(e);
      const vigentes = actual ? (await tx.contribuyenteDocumento.findMany({ where: { contribuyenteId: actual.id } })).map((d) => d.tipoDoc) : [];
      await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.TIPO_DOCUMENTO, documentos.map((d) => d.tipoDoc), 'Tipo de documento', vigentes);
      await this.asegurarDocumentosLibres(tx, documentos, actual?.id ?? null);
      const principal = documentos[0];
      data.tipoDoc = principal?.tipoDoc ?? SIN_DOCUMENTO;
      data.numDoc = principal?.numDoc ?? null;
      numDocFinal = principal?.numDoc ?? null;
    }

    // Sin documento (P08): justificación obligatoria; con documento, la excepción ya no aplica.
    let excepcionAprobadaAt = actual?.excepcionAprobadaAt ?? null;
    if (numDocFinal) {
      if (documentos) {
        data.sinDocumentoMotivo = null;
        data.excepcionAprobadaPorId = null;
        data.excepcionAprobadaAt = null;
        excepcionAprobadaAt = null;
      }
    } else {
      const motivo = dto.sinDocumentoMotivo !== undefined ? opcional(dto.sinDocumentoMotivo) : actual?.sinDocumentoMotivo;
      if (!motivo || motivo.length < 10) {
        throw new BadRequestException('Persona sin documento: explica por qué no lo tiene (mínimo 10 caracteres)');
      }
      data.sinDocumentoMotivo = motivo;
    }

    // Sucesión (P18): el DNI del causante es solo referencia. Natural (P15): fecha de nacimiento.
    if (tipoPersona !== TipoPersona.SUCESION) {
      if (actual?.dniCausante || dto.dniCausante) data.dniCausante = null;
    } else if (dto.dniCausante !== undefined) {
      const dni = opcional(dto.dniCausante) ?? null;
      if (dni && documentoFicticio('DNI', dni)) throw new BadRequestException(`El DNI del causante ${dni} parece inventado`);
      data.dniCausante = dni;
    }
    if (tipoPersona !== TipoPersona.NATURAL) {
      if (actual?.fechaNacimiento || dto.fechaNacimiento) data.fechaNacimiento = null;
    } else if (dto.fechaNacimiento !== undefined) {
      const fecha = opcional(dto.fechaNacimiento)?.slice(0, 10) ?? null;
      if (fecha && fecha > hoyLima()) throw new BadRequestException('La fecha de nacimiento no puede ser futura');
      data.fechaNacimiento = fecha ? new Date(fecha) : null;
    }

    // Perfil y clasificación (P12): códigos de catálogo; se conserva el que ya tenía aunque se desactive.
    const perfiles = [
      ['perfilCumplimiento', GrupoCatalogo.PERFIL_CUMPLIMIENTO, 'Perfil de cumplimiento'],
      ['perfilCobranza', GrupoCatalogo.PERFIL_COBRANZA, 'Perfil de cobranza'],
      ['clasificacion', GrupoCatalogo.CLASIFICACION_CONTRIBUYENTE, 'Clasificación'],
    ] as const;
    for (const [campo, grupo, etiqueta] of perfiles) {
      if (dto[campo] === undefined) continue;
      const codigo = opcional(dto[campo]) ?? null;
      if (codigo) await this.catalogos.asegurarCodigos(tx, grupo, [codigo], etiqueta, actual?.[campo] ? [actual[campo]] : []);
      data[campo] = codigo;
    }

    const contactos = dto.contactos !== undefined ? await this.prepararContactos(tx, dto.contactos, actual) : undefined;
    const relacionados = dto.relacionados !== undefined ? await this.prepararRelacionados(tx, dto.relacionados, actual) : undefined;

    await this.prepararDomicilio(tx, dto, actual, data);

    return {
      data,
      documentos,
      contactos,
      relacionados,
      pendientes: {
        numDoc: numDocFinal,
        excepcionAprobadaAt,
        nombreRevisado: (data.nombreRevisado as boolean | undefined) ?? actual?.nombreRevisado ?? true,
      },
    };
  }

  // P05: si llega cualquier dato del nombre (o cambia el tipo de persona), se vuelve a armar y
  // queda revisado (decisión 7). Los campos que no corresponden al tipo se limpian.
  private async prepararNombre(tx: Tx, dto: UpdateContribuyenteDto, actual: Contribuyente | null, tipoPersona: TipoPersona, data: Preparado['data']) {
    const campos = ['apellidoPaterno', 'apellidoMaterno', 'nombres', 'razonSocial', 'tipoSucesion'] as const;
    if (actual && !dto.tipoPersona && campos.every((k) => dto[k] === undefined)) return;
    const valor = (k: (typeof campos)[number]) => (dto[k] !== undefined ? mayus(dto[k]) : (actual?.[k] ?? null)) ?? null;
    const juridica = tipoPersona === TipoPersona.JURIDICA;
    const sucesion = tipoPersona === TipoPersona.SUCESION;
    const nombre = {
      apellidoPaterno: juridica ? null : valor('apellidoPaterno'),
      apellidoMaterno: juridica ? null : valor('apellidoMaterno'),
      nombres: juridica ? null : valor('nombres'),
      razonSocial: juridica ? valor('razonSocial') : null,
      tipoSucesion: sucesion ? (dto.tipoSucesion !== undefined ? opcional(dto.tipoSucesion) : actual?.tipoSucesion) || 'INDIVISA' : null,
    };
    const error = errorNombre({ tipoPersona, ...nombre });
    if (error) throw new BadRequestException(error);
    let abreviaturaSucesion: string | null = null;
    if (nombre.tipoSucesion) {
      const items = await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.TIPO_SUCESION, [nombre.tipoSucesion], 'Tipo de sucesión', actual?.tipoSucesion ? [actual.tipoSucesion] : []);
      abreviaturaSucesion = items.get(nombre.tipoSucesion)?.abreviatura ?? null;
    }
    Object.assign(data, nombre, {
      nombreCompleto: componerNombre({ tipoPersona, ...nombre, abreviaturaSucesion }),
      nombreRevisado: true,
    });
  }

  // P09: el formato lo fija el tipo de contacto en el catálogo; los repetidos se descartan.
  private async prepararContactos(tx: Tx, lista: { tipo: string; valor: string }[], actual: Contribuyente | null) {
    const vigentes = actual ? (await tx.contribuyenteContacto.findMany({ where: { contribuyenteId: actual.id } })).map((c) => c.tipo) : [];
    const tipos = await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.TIPO_CONTACTO, lista.map((c) => c.tipo), 'Tipo de contacto', vigentes);
    const vistos = new Set<string>();
    const limpios: ContactoLimpio[] = [];
    for (const c of lista) {
      const item = tipos.get(c.tipo)!;
      const formato = (item.atributos as { formato?: string } | null)?.formato;
      const valor = formato === 'EMAIL' ? c.valor.trim().toLowerCase() : c.valor.trim();
      const e = errorContacto(item.nombre, formato, valor);
      if (e) throw new BadRequestException(e);
      const clave = `${c.tipo}|${valor}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      limpios.push({ tipo: c.tipo, valor });
    }
    return limpios;
  }

  // P10: datos en la ficha, enlace opcional a la persona registrada, un solo cónyuge vigente.
  private async prepararRelacionados(tx: Tx, lista: NonNullable<UpdateContribuyenteDto['relacionados']>, actual: Contribuyente | null) {
    const guardados = actual ? await tx.contribuyenteRelacionado.findMany({ where: { contribuyenteId: actual.id } }) : [];
    const tipos = await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.TIPO_RELACIONADO, lista.map((r) => r.tipo), 'Tipo de relacionado', guardados.map((r) => r.tipo));
    const tiposDoc = lista.map((r) => opcional(r.tipoDoc)).filter((t): t is string => Boolean(t));
    await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.TIPO_DOCUMENTO, tiposDoc, 'Tipo de documento del relacionado', guardados.map((r) => r.tipoDoc ?? ''));

    const limpios: RelacionadoLimpio[] = [];
    for (const r of lista) {
      if (r.id && !guardados.some((g) => g.id === r.id)) throw new BadRequestException('Un relacionado no pertenece a esta persona');
      const tipoDoc = opcional(r.tipoDoc) ?? null;
      const numDoc = r.numDoc ? normalizarDocumento(r.numDoc) || null : null;
      if (Boolean(tipoDoc) !== Boolean(numDoc)) throw new BadRequestException('Del relacionado indica tipo y número de documento, o ninguno');
      if (tipoDoc && numDoc) {
        if (tipoDoc === SIN_DOCUMENTO) throw new BadRequestException('Si el relacionado no tiene documento, deja el documento vacío');
        const e = errorFormato(tipoDoc, numDoc);
        if (e) throw new BadRequestException(`Relacionado: ${e}`);
      }
      let personaId: number | null = null;
      if (tipoDoc && numDoc) {
        const doc = await tx.contribuyenteDocumento.findUnique({ where: { tipoDoc_numDoc: { tipoDoc, numDoc } }, select: { contribuyenteId: true } });
        if (doc && doc.contribuyenteId === actual?.id) throw new BadRequestException('Una persona no puede ser su propio relacionado');
        personaId = doc?.contribuyenteId ?? null;
      }
      limpios.push({
        id: r.id,
        tipo: r.tipo,
        tipoDoc,
        numDoc,
        nombreCompleto: mayus(r.nombreCompleto)!,
        direccion: mayus(r.direccion) ?? null,
        personaId,
        vigente: r.vigente ?? true,
      });
    }
    const unicos = new Map([...tipos.values()].filter((t) => (t.atributos as { unico?: boolean } | null)?.unico).map((t) => [t.codigo, t.nombre]));
    const e = errorRelacionados(limpios, unicos);
    if (e) throw new BadRequestException(e);
    return limpios;
  }

  // Domicilio fiscal (spec contribuyente-domicilio-representante-v1). La Fase 2 lo lleva a direcciones únicas.
  private async prepararDomicilio(tx: Tx, dto: UpdateContribuyenteDto, actual: Contribuyente | null, data: Preparado['data']) {
    const enviado: Partial<Direccion> = {};
    if (dto.ubigeo !== undefined) enviado.ubigeo = opcional(dto.ubigeo) ?? null;
    for (const k of ['zonaId', 'urbanizacionId', 'viaId'] as const) if (dto[k] !== undefined) enviado[k] = dto[k] ?? null;
    for (const k of ['numero', 'interior', 'manzana', 'lote', 'referencia'] as const) if (dto[k] !== undefined) enviado[k] = mayus(dto[k]) ?? null;
    Object.assign(data, enviado);
    const dir = Object.fromEntries(
      CAMPOS_DIRECCION.map((k) => [k, enviado[k] !== undefined ? enviado[k] : (actual?.[k] ?? null)]),
    ) as unknown as Direccion;
    if (!actual) dir.ubigeo = dir.ubigeo || UBIGEO_DEFECTO;
    const catalogos = await this.resolverCatalogos(tx, dir, enviado.ubigeo);
    // Sin ningún tramo de dirección no se toca direccionFiscal (no se borra lo que ya estaba).
    const linea = this.componerDireccionFiscal(dir, catalogos);
    if (linea) data.direccionFiscal = linea;
  }

  // vía/zona/urbanización tienen FK: si el id no existe, aquí sale un 400 en vez de un P2003/500.
  // El ubigeo no tiene FK: solo se exige que exista el que viene ahora.
  private async resolverCatalogos(tx: Tx, dir: Direccion, ubigeoPayload?: string | null): Promise<CatalogosDireccion> {
    const codigoUbigeo = ubigeoPayload ?? dir.ubigeo;
    const [via, urbanizacion, distrito] = await Promise.all([
      dir.viaId ? tx.via.findUnique({ where: { id: dir.viaId }, select: { tipoVia: true, nombre: true } }) : null,
      dir.urbanizacionId ? tx.urbanizacion.findUnique({ where: { id: dir.urbanizacionId }, select: { nombre: true } }) : null,
      codigoUbigeo ? tx.ubigeo.findUnique({ where: { codigo: codigoUbigeo }, select: { distrito: true } }) : null,
    ]);
    if (dir.viaId && !via) throw new BadRequestException('La vía seleccionada ya no existe');
    if (dir.urbanizacionId && !urbanizacion) throw new BadRequestException('La urbanización seleccionada ya no existe');
    if (ubigeoPayload && !distrito) throw new BadRequestException('El ubigeo no corresponde a un distrito registrado');
    return { via, urbanizacion, distrito: distrito?.distrito ?? null };
  }

  // Línea de dirección fiscal (max. 150) que consumen recibos, OP/RD, estado de cuenta y búsqueda.
  private componerDireccionFiscal(dir: Direccion, catalogos: CatalogosDireccion): string | null {
    const partes: string[] = [];
    if (catalogos.via) partes.push(`${catalogos.via.tipoVia} ${catalogos.via.nombre}`.replace(/\s+/g, ' ').trim());
    if (dir.numero) partes.push(`N° ${dir.numero}`);
    if (dir.interior) partes.push(`Dpto. ${dir.interior}`);
    if (dir.manzana) partes.push(`Mz. ${dir.manzana}`);
    if (dir.lote) partes.push(`Lt. ${dir.lote}`);
    if (catalogos.urbanizacion) partes.push(catalogos.urbanizacion.nombre);
    if (partes.length === 0) return null;
    const linea = catalogos.distrito ? `${partes.join(' ')}, ${catalogos.distrito}` : partes.join(' ');
    return linea.slice(0, 150);
  }

  // P06: el par tipo + número no se repite en toda la base.
  private async asegurarDocumentosLibres(tx: Tx, docs: Documento[], propioId: number | null) {
    if (docs.length === 0) return;
    const otro = await tx.contribuyenteDocumento.findFirst({
      where: {
        OR: docs.map((d) => ({ tipoDoc: d.tipoDoc, numDoc: d.numDoc })),
        ...(propioId ? { contribuyenteId: { not: propioId } } : {}),
      },
      select: { tipoDoc: true, numDoc: true, contribuyente: { select: { id: true, nombreCompleto: true } } },
    });
    if (otro) {
      throw new ConflictException(
        `Ya existe una persona con ${otro.tipoDoc} ${otro.numDoc}: ${otro.contribuyente.nombreCompleto} (id ${otro.contribuyente.id})`,
      );
    }
  }

  // ---- Escritura de las listas: se conserva lo que no cambió (la auditoría queda limpia) ----

  private async sincronizarListas(tx: Tx, contribuyenteId: number, p: Preparado) {
    try {
      if (p.documentos) await this.sincronizarDocumentos(tx, contribuyenteId, p.documentos);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Otra persona acaba de registrar ese documento. Revisa y vuelve a intentar.');
      }
      throw e;
    }
    if (p.contactos) await this.sincronizarContactos(tx, contribuyenteId, p.contactos);
    if (p.relacionados) await this.sincronizarRelacionados(tx, contribuyenteId, p.relacionados);
  }

  private async sincronizarDocumentos(tx: Tx, contribuyenteId: number, docs: Documento[]) {
    const clave = (d: Documento) => `${d.tipoDoc}|${d.numDoc}`;
    const actuales = await tx.contribuyenteDocumento.findMany({ where: { contribuyenteId } });
    const orden = new Map(docs.map((d, i) => [clave(d), i + 1]));
    const quitar = actuales.filter((a) => !orden.has(clave(a))).map((a) => a.id);
    if (quitar.length) await tx.contribuyenteDocumento.deleteMany({ where: { id: { in: quitar } } });
    for (const a of actuales) {
      const o = orden.get(clave(a));
      if (o && o !== a.orden) await tx.contribuyenteDocumento.update({ where: { id: a.id }, data: { orden: o } });
    }
    const existentes = new Set(actuales.map(clave));
    const nuevos = docs.map((d, i) => ({ contribuyenteId, orden: i + 1, ...d })).filter((d) => !existentes.has(clave(d)));
    if (nuevos.length) await tx.contribuyenteDocumento.createMany({ data: nuevos });
  }

  private async sincronizarContactos(tx: Tx, contribuyenteId: number, contactos: ContactoLimpio[]) {
    const clave = (c: ContactoLimpio) => `${c.tipo}|${c.valor}`;
    const actuales = await tx.contribuyenteContacto.findMany({ where: { contribuyenteId } });
    const orden = new Map(contactos.map((c, i) => [clave(c), i + 1]));
    const quitar = actuales.filter((a) => !orden.has(clave(a))).map((a) => a.id);
    if (quitar.length) await tx.contribuyenteContacto.deleteMany({ where: { id: { in: quitar } } });
    for (const a of actuales) {
      const o = orden.get(clave(a));
      if (o && o !== a.orden) await tx.contribuyenteContacto.update({ where: { id: a.id }, data: { orden: o } });
    }
    const existentes = new Set(actuales.map(clave));
    const nuevos = contactos.map((c, i) => ({ contribuyenteId, orden: i + 1, ...c })).filter((c) => !existentes.has(clave(c)));
    if (nuevos.length) await tx.contribuyenteContacto.createMany({ data: nuevos });
  }

  private async sincronizarRelacionados(tx: Tx, contribuyenteId: number, lista: RelacionadoLimpio[]) {
    const actuales = await tx.contribuyenteRelacionado.findMany({ where: { contribuyenteId } });
    const conservados = new Set(lista.map((r) => r.id).filter(Boolean));
    const quitar = actuales.filter((a) => !conservados.has(a.id)).map((a) => a.id);
    if (quitar.length) await tx.contribuyenteRelacionado.deleteMany({ where: { id: { in: quitar } } });
    for (const [i, r] of lista.entries()) {
      const { id, ...datos } = r;
      const fila = { ...datos, orden: i + 1 };
      if (id) {
        const a = actuales.find((x) => x.id === id)!;
        const cambio = (Object.keys(fila) as (keyof typeof fila)[]).some((k) => a[k] !== fila[k]);
        if (cambio) await tx.contribuyenteRelacionado.update({ where: { id }, data: fila });
      } else {
        await tx.contribuyenteRelacionado.create({ data: { contribuyenteId, ...fila } });
      }
    }
  }
}
