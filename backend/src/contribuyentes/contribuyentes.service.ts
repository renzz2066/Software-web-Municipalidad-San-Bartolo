import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Contribuyente, EstadoCuenta, EstadoRegistro, Prisma, TipoPersona } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizarDocumento, validarDocumento } from './documento.js';
import {
  BuscarContribuyentesDto,
  BuscarUbigeosDto,
  CreateContribuyenteDto,
  UpdateContribuyenteDto,
} from './dto/contribuyente.dto.js';

// Deuda viva: lo que aún se puede cobrar (en caja, convenio o coactivo).
const ESTADOS_DEUDA: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.FRACCIONADO, EstadoCuenta.COACTIVO];
// Para sumar la deuda viva: la FRACCIONADO ya está en las cuotas del convenio (tributo FRACCION).
const ESTADOS_SALDO: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.COACTIVO];

// San Bartolo (Lima/Lima): ubigeo por defecto del alta, igual que el _codpos de SIMUN.
const UBIGEO_DEFECTO = '150129';

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

interface DatosContribuyente {
  tipoPersona?: TipoPersona;
  tipoDoc?: string;
  numDoc?: string;
  nombreCompleto?: string;
  direccionFiscal?: string | null;
  ubigeo?: string | null;
  telefono?: string | null;
  celular?: string | null;
  email?: string | null;
  zonaId?: number | null;
  urbanizacionId?: number | null;
  viaId?: number | null;
  numero?: string | null;
  interior?: string | null;
  manzana?: string | null;
  lote?: string | null;
  referencia?: string | null;
  conyugeNombre?: string | null;
  conyugeNumDoc?: string | null;
  representanteNombre?: string | null;
  representanteNumDoc?: string | null;
  representanteDireccion?: string | null;
}

// Dirección tal como va a quedar guardada: lo del payload pisando lo que ya había.
type Direccion = Pick<
  DatosContribuyente,
  'ubigeo' | 'viaId' | 'zonaId' | 'urbanizacionId' | 'numero' | 'interior' | 'manzana' | 'lote' | 'referencia'
>;

interface CatalogosDireccion {
  via: { tipoVia: string; nombre: string } | null;
  urbanizacion: { nombre: string } | null;
  distrito: string | null;
}

@Injectable()
export class ContribuyentesService {
  constructor(private readonly prisma: PrismaService) {}

  // Búsqueda única (C1): documento o código legacy si son dígitos; nombre o dirección si no.
  async buscar(dto: BuscarContribuyentesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const q = dto.q?.trim() ?? '';
    const where: Prisma.ContribuyenteWhereInput = {};
    if (dto.incluirBaja !== 'true') {
      where.estado = { not: EstadoRegistro.BAJA };
    }
    if (q) {
      const doc = normalizarDocumento(q);
      where.OR = /^\d+$/.test(doc)
        ? [{ numDoc: { startsWith: doc } }, { codigoLegacy: { startsWith: doc } }]
        : [
            { nombreCompleto: { contains: q, mode: 'insensitive' } },
            { direccionFiscal: { contains: q, mode: 'insensitive' } },
            { numDoc: { startsWith: doc } },
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

  async findOne(id: number) {
    const c = await this.prisma.contribuyente.findUnique({ where: { id } });
    if (!c) {
      throw new NotFoundException('El contribuyente no existe');
    }
    const { creadoPorId: _c, modificadoPorId: _m, ...datos } = c;
    return datos;
  }

  async create(dto: CreateContribuyenteDto) {
    const data = this.limpiar(dto);
    const numDoc = normalizarDocumento(dto.numDoc);
    this.asegurarDocumento(dto.tipoDoc, numDoc, dto.tipoPersona);
    await this.asegurarDocumentoLibre(numDoc);
    // Sin ubigeo explícito se usa el de San Bartolo (150129), igual que el alta de SIMUN.
    data.ubigeo = data.ubigeo || UBIGEO_DEFECTO;
    const dir = this.direccionDesde(data);
    const catalogos = await this.resolverCatalogos(dir, data.ubigeo);
    const direccionFiscal = this.componerDireccionFiscal(dir, catalogos);
    if (direccionFiscal) data.direccionFiscal = direccionFiscal;
    return this.prisma.contribuyente.create({
      data: { ...data, tipoPersona: dto.tipoPersona, tipoDoc: dto.tipoDoc, numDoc, nombreCompleto: data.nombreCompleto ?? '' },
      select: SELECT_LISTA,
    });
  }

  async update(id: number, dto: UpdateContribuyenteDto) {
    const actual = await this.findOne(id);
    const data = this.limpiar(dto);
    const tipoDoc = data.tipoDoc ?? actual.tipoDoc;
    const numDoc = data.numDoc ?? actual.numDoc;
    this.asegurarDocumento(tipoDoc, numDoc, data.tipoPersona ?? actual.tipoPersona);
    if (numDoc !== actual.numDoc) {
      await this.asegurarDocumentoLibre(numDoc);
    }
    if (dto.estado === EstadoRegistro.BAJA && actual.estado !== EstadoRegistro.BAJA) {
      const deuda = await this.prisma.cuentaCorriente.count({
        where: { contribuyenteId: id, estado: { in: ESTADOS_DEUDA } },
      });
      if (deuda > 0) {
        throw new ConflictException('No se puede dar de baja: el contribuyente tiene deuda pendiente');
      }
    }
    // La dirección se recalcula con lo nuevo pisando lo que había. Si no queda ningún tramo de
    // dirección, direccionFiscal no se toca (no se borra lo que ya estaba guardado).
    const dir = this.direccionDesde(data, actual);
    const catalogos = await this.resolverCatalogos(dir, data.ubigeo);
    const direccionFiscal = this.componerDireccionFiscal(dir, catalogos);
    if (direccionFiscal) data.direccionFiscal = direccionFiscal;

    return this.prisma.contribuyente.update({
      where: { id },
      data: { ...data, ...(dto.estado ? { estado: dto.estado } : {}) },
      select: SELECT_LISTA,
    });
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

  // Normaliza solo los campos enviados (vacío en opcionales = null).
  private limpiar(dto: UpdateContribuyenteDto): DatosContribuyente {
    const opcional = (v?: string | null) => (v == null ? undefined : v.trim() || null);
    const texto = (v?: string | null) => opcional(v)?.toUpperCase() ?? opcional(v);
    const datos: DatosContribuyente = {
      tipoPersona: dto.tipoPersona,
      tipoDoc: dto.tipoDoc,
      numDoc: dto.numDoc === undefined ? undefined : normalizarDocumento(dto.numDoc),
      nombreCompleto: dto.nombreCompleto?.trim().replace(/\s+/g, ' ').toUpperCase(),
      telefono: opcional(dto.telefono),
      celular: opcional(dto.celular),
      email: opcional(dto.email)?.toLowerCase() ?? opcional(dto.email),
      zonaId: dto.zonaId,
      urbanizacionId: dto.urbanizacionId,
      viaId: dto.viaId,
      numero: texto(dto.numero),
      interior: texto(dto.interior),
      manzana: texto(dto.manzana),
      lote: texto(dto.lote),
      referencia: texto(dto.referencia),
      conyugeNombre: texto(dto.conyugeNombre),
      conyugeNumDoc: opcional(dto.conyugeNumDoc),
      representanteNombre: texto(dto.representanteNombre),
      representanteNumDoc: opcional(dto.representanteNumDoc),
      representanteDireccion: texto(dto.representanteDireccion),
    };
    // undefined = no se envía y no se toca; null o vacío = se limpia.
    if (dto.ubigeo !== undefined) datos.ubigeo = dto.ubigeo?.trim() || null;
    return Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)) as DatosContribuyente;
  }

  // Dirección resultante: lo del payload pisa lo que ya tenía el registro.
  private direccionDesde(datos: DatosContribuyente, base?: Pick<Contribuyente, keyof Direccion>): Direccion {
    const valor = <K extends keyof Direccion>(k: K): Direccion[K] =>
      (datos[k] !== undefined ? datos[k] : base ? base[k] : null) as Direccion[K];
    return {
      ubigeo: valor('ubigeo'),
      viaId: valor('viaId'),
      zonaId: valor('zonaId'),
      urbanizacionId: valor('urbanizacionId'),
      numero: valor('numero'),
      interior: valor('interior'),
      manzana: valor('manzana'),
      lote: valor('lote'),
      referencia: valor('referencia'),
    };
  }

  // Trae los catálogos de la dirección y valida lo que vino en el payload.
  // vía/zona/urbanización tienen FK: si el id no existe, aquí sale un 400 en vez de un P2003/500.
  // El ubigeo no tiene FK (una fila heredada sin catalogar rompería la migración), así que solo se
  // exige que exista el que viene ahora; el heredado se resuelve si está y si no, se omite.
  private async resolverCatalogos(dir: Direccion, ubigeoPayload?: string | null): Promise<CatalogosDireccion> {
    const codigoUbigeo = ubigeoPayload ?? dir.ubigeo;
    const [via, urbanizacion, distrito] = await Promise.all([
      dir.viaId ? this.prisma.via.findUnique({ where: { id: dir.viaId }, select: { tipoVia: true, nombre: true } }) : null,
      dir.urbanizacionId
        ? this.prisma.urbanizacion.findUnique({ where: { id: dir.urbanizacionId }, select: { nombre: true } })
        : null,
      codigoUbigeo ? this.prisma.ubigeo.findUnique({ where: { codigo: codigoUbigeo }, select: { distrito: true } }) : null,
    ]);
    if (dir.viaId && !via) throw new BadRequestException('La vía seleccionada ya no existe');
    if (dir.urbanizacionId && !urbanizacion) throw new BadRequestException('La urbanización seleccionada ya no existe');
    if (ubigeoPayload && !distrito) throw new BadRequestException('El ubigeo no corresponde a un distrito registrado');
    return { via, urbanizacion, distrito: distrito?.distrito ?? null };
  }

  // Línea de dirección fiscal (max. 150) que consumen recibos, OP/RD, estado de cuenta y búsqueda.
  // Sin ningún tramo de dirección devuelve null para no pisar lo que ya estaba guardado.
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

  private asegurarDocumento(tipoDoc: string, numDoc: string, tipoPersona: TipoPersona) {
    const error = validarDocumento(tipoDoc, numDoc, tipoPersona);
    if (error) {
      throw new BadRequestException(error);
    }
  }

  private async asegurarDocumentoLibre(numDoc: string) {
    const otro = await this.prisma.contribuyente.findUnique({
      where: { numDoc },
      select: { id: true, nombreCompleto: true },
    });
    if (otro) {
      throw new ConflictException(`Ya existe un contribuyente con ese documento: ${otro.nombreCompleto} (id ${otro.id})`);
    }
  }
}
