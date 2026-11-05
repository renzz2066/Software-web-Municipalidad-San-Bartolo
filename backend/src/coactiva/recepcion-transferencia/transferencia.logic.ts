import { PrismaClient, Prisma, EstadoCuenta, EstadoValor, CoactivoExp, ValorCab } from '@prisma/client';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { hoyLima } from '../../rentas/fechas.js';
import { MENSAJE_NO_RECIBIBLE, WHERE_RECIBIBLE, idsUnicos, motivoNoRecibible, siguienteExpediente } from '../coactiva.reglas.js';

type Tx = Prisma.TransactionClient;

// Serializa recepciones: un valor no puede abrir dos expedientes ni dos expedientes compartir número.
const LOCK_RECEPCION = 7_301_003;

export interface Responsables {
  ejecutorId: number;
  auxiliarId: number;
  tipoGestionId?: number;
}

export interface TransferenciaInput extends Responsables {
  valorId: number;
}

export interface TransferenciaResultado {
  expediente: CoactivoExp;
  valor: ValorCab;
}

// Ejecutor, auxiliar y tipo de gestión deben existir y estar activos.
async function validarResponsables(db: Tx | PrismaClient, r: Responsables): Promise<void> {
  const [ejecutor, auxiliar, tipoGestion] = await Promise.all([
    db.ejecutorCoactivo.findUnique({ where: { id: r.ejecutorId } }),
    db.auxiliarCoactivo.findUnique({ where: { id: r.auxiliarId } }),
    r.tipoGestionId != null ? db.tipoGestionCoactiva.findUnique({ where: { id: r.tipoGestionId } }) : null,
  ]);
  if (!ejecutor || !ejecutor.activo) {
    throw new BadRequestException('Ejecutor no encontrado o inactivo');
  }
  if (!auxiliar || !auxiliar.activo) {
    throw new BadRequestException('Auxiliar no encontrado o inactivo');
  }
  if (r.tipoGestionId != null && (!tipoGestion || tipoGestion.activo === false)) {
    throw new BadRequestException('Tipo de gestión no encontrado o inactivo');
  }
}

// Recepción de un valor ya transferido por Rentas: crea el expediente con sus cuotas en coactiva.
// No toca el valor (sigue COACTIVO con su transferenciaId y su fechaNotificacion originales).
async function recibir(t: Tx, input: TransferenciaInput): Promise<TransferenciaResultado> {
  await t.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_RECEPCION})`;
  const valor = await t.valorCab.findUnique({
    where: { id: input.valorId },
    include: {
      detalles: { include: { cuentaCorriente: { include: { tributo: true } } }, orderBy: { id: 'asc' } },
      _count: { select: { expedientes: true } },
    },
  });
  if (!valor) {
    throw new NotFoundException('Valor no encontrado');
  }

  const cuotas = valor.detalles.filter((d) => d.cuentaCorriente.estado === EstadoCuenta.COACTIVO);
  const motivo = motivoNoRecibible({
    estado: valor.estado,
    transferenciaId: valor.transferenciaId,
    expedientes: valor._count.expedientes,
    cuotasCoactivo: cuotas.length,
  });
  if (motivo) {
    throw new ConflictException(MENSAJE_NO_RECIBIBLE[motivo]);
  }

  const fecha = hoyLima();
  const anioExpediente = Number(fecha.slice(0, 4));
  const ultimo = await t.coactivoExp.findFirst({
    where: { anioExpediente },
    orderBy: { numExpediente: 'desc' },
    select: { numExpediente: true },
  });

  // creadoPorId lo fija el trigger de auditoría (skills/backend-db.md, 6).
  const expediente = await t.coactivoExp.create({
    data: {
      anioExpediente,
      numExpediente: siguienteExpediente(ultimo?.numExpediente),
      valorId: valor.id,
      contribuyenteId: valor.contribuyenteId,
      ejecutorId: input.ejecutorId,
      auxiliarId: input.auxiliarId,
      tipoGestionId: input.tipoGestionId,
      estado: EstadoValor.COACTIVO,
      fechaGeneracion: new Date(fecha),
      detalles: {
        create: cuotas.map((d) => ({
          cuentaCorrienteId: d.cuentaCorrienteId,
          descripcion: `${d.cuentaCorriente.tributo.codigo} - Cuota ${d.cuentaCorriente.cuota}`,
          monto: d.subtotal,
        })),
      },
    },
    include: { detalles: true, ejecutor: true, auxiliar: true },
  });

  const { detalles: _d, _count: _c, ...cabecera } = valor;
  return { expediente, valor: cabecera };
}

// Choque con el índice único (valor ya recibido / número repetido) → 409, no 500.
function comoConflicto(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('El valor ya fue recibido en coactiva; actualiza la lista');
  }
  throw error;
}

export async function transferirValor(input: TransferenciaInput, prisma: PrismaClient): Promise<TransferenciaResultado> {
  await validarResponsables(prisma, input);
  // Regla 3 (AGENTS.md): validación, correlativo y expediente en la misma transacción.
  return prisma.$transaction((t) => recibir(t, input)).catch(comoConflicto);
}

// Cada valor en su propia transacción: uno que falla no revierte a los demás (el resultado lo informa).
export async function transferirMasivo(
  input: Responsables & { valorIds: number[] },
  prisma: PrismaClient,
): Promise<{ exitosos: TransferenciaResultado[]; fallidos: { valorId: number; error: string }[] }> {
  await validarResponsables(prisma, input);
  const exitosos: TransferenciaResultado[] = [];
  const fallidos: { valorId: number; error: string }[] = [];

  for (const valorId of idsUnicos(input.valorIds)) {
    try {
      const datos = { ...input, valorId };
      exitosos.push(await prisma.$transaction((t) => recibir(t, datos)).catch(comoConflicto));
    } catch (error) {
      fallidos.push({ valorId, error: error instanceof Error ? error.message : 'Error desconocido' });
    }
  }

  return { exitosos, fallidos };
}

export interface FiltroRecibibles {
  anio?: number;
  tipo?: string;
  contribuyente?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  memorandumId?: number;
  page: number;
  limit: number;
}

// Filtros en AND sobre WHERE_RECIBIBLE: ninguno puede ampliar lo que es recibible.
export function whereRecibibles(f: FiltroRecibibles): Prisma.ValorCabWhereInput {
  const and: Prisma.ValorCabWhereInput[] = [WHERE_RECIBIBLE];
  if (f.memorandumId) and.push({ memorandumId: f.memorandumId });
  if (f.anio) and.push({ anio: f.anio });
  if (f.tipo) and.push({ tipo: f.tipo as Prisma.ValorCabWhereInput['tipo'] });
  if (f.contribuyente) {
    and.push({
      contribuyente: {
        OR: [
          { numDoc: { contains: f.contribuyente } },
          { nombreCompleto: { contains: f.contribuyente, mode: 'insensitive' } },
          { codigoLegacy: { contains: f.contribuyente } },
        ],
      },
    });
  }
  if (f.fechaDesde || f.fechaHasta) {
    and.push({
      fechaEmision: {
        ...(f.fechaDesde ? { gte: new Date(f.fechaDesde) } : {}),
        ...(f.fechaHasta ? { lte: new Date(f.fechaHasta) } : {}),
      },
    });
  }
  return { AND: and };
}

export async function getValoresTransferibles(
  prisma: PrismaClient,
  filtros: FiltroRecibibles,
): Promise<{ data: ValorCab[]; total: number; page: number; limit: number }> {
  const where = whereRecibibles(filtros);
  const [data, total] = await Promise.all([
    prisma.valorCab.findMany({
      where,
      include: {
        contribuyente: {
          select: { id: true, numDoc: true, nombreCompleto: true, codigoLegacy: true },
        },
        predio: {
          select: { id: true, codigoCatastro: true, codigoLegacy: true },
        },
        expedientes: { select: { id: true } },
      },
      orderBy: { fechaEmision: 'desc' },
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    }),
    prisma.valorCab.count({ where }),
  ]);

  return { data, total, page: filtros.page, limit: filtros.limit };
}

export async function getValorDetalle(prisma: PrismaClient, valorId: number): Promise<ValorCab | null> {
  return prisma.valorCab.findUnique({
    where: { id: valorId },
    include: {
      contribuyente: {
        select: { id: true, numDoc: true, nombreCompleto: true, codigoLegacy: true, direccionFiscal: true },
      },
      predio: {
        select: { id: true, codigoCatastro: true, codigoLegacy: true, referencia: true, zona: { select: { codigo: true, nombre: true } } },
      },
      detalles: {
        include: {
          cuentaCorriente: {
            include: {
              tributo: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      },
      expedientes: {
        include: {
          ejecutor: true,
          auxiliar: true,
        },
      },
    },
  });
}

export async function getEjecutoresActivos(prisma: PrismaClient) {
  return prisma.ejecutorCoactivo.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function getAuxiliaresActivos(prisma: PrismaClient) {
  return prisma.auxiliarCoactivo.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function getTiposGestionActivos(prisma: PrismaClient) {
  return prisma.tipoGestionCoactiva.findMany({
    where: { activo: true },
    orderBy: { descripcion: 'asc' },
  });
}
