import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, EstadoRegistro, Prisma, TipoPersona } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizarDocumento, validarDocumento } from './documento.js';
import { BuscarContribuyentesDto, CreateContribuyenteDto, UpdateContribuyenteDto } from './dto/contribuyente.dto.js';

// Deuda viva: lo que aún se puede cobrar (en caja, convenio o coactivo).
const ESTADOS_DEUDA: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.FRACCIONADO, EstadoCuenta.COACTIVO];
// Para sumar la deuda viva: la FRACCIONADO ya está en las cuotas del convenio (tributo FRACCION).
const ESTADOS_SALDO: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.COACTIVO];

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
    return this.prisma.contribuyente.update({
      where: { id },
      data: { ...data, ...(dto.estado ? { estado: dto.estado } : {}) },
      select: SELECT_LISTA,
    });
  }

  // Ficha 360 (C2): datos, predios, deuda viva por año/tributo y DDJJ.
  async resumen(id: number) {
    const contribuyente = await this.findOne(id);
    const [predios, deudaAgrupada, declaraciones] = await Promise.all([
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

    return { contribuyente, predios, deuda, totalDeuda: totalDeuda.toFixed(2), declaraciones };
  }

  // Normaliza solo los campos enviados (vacío en opcionales = null).
  private limpiar(dto: UpdateContribuyenteDto): DatosContribuyente {
    const opcional = (v?: string) => (v === undefined ? undefined : v.trim() || null);
    const datos: DatosContribuyente = {
      tipoPersona: dto.tipoPersona,
      tipoDoc: dto.tipoDoc,
      numDoc: dto.numDoc === undefined ? undefined : normalizarDocumento(dto.numDoc),
      nombreCompleto: dto.nombreCompleto?.trim().replace(/\s+/g, ' ').toUpperCase(),
      direccionFiscal: opcional(dto.direccionFiscal)?.toUpperCase() ?? opcional(dto.direccionFiscal),
      ubigeo: opcional(dto.ubigeo),
      telefono: opcional(dto.telefono),
      celular: opcional(dto.celular),
      email: opcional(dto.email)?.toLowerCase() ?? opcional(dto.email),
    };
    return Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)) as DatosContribuyente;
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
