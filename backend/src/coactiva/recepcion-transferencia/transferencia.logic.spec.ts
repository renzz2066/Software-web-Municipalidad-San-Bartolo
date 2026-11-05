import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, EstadoValor, Prisma } from '@prisma/client';
import { transferirMasivo, transferirValor, whereRecibibles } from './transferencia.logic.js';
import { asignarValores } from '../asignar-valores/asignar-valores.logic.js';

const cuota = (id: number, estado: EstadoCuenta) => ({
  cuentaCorrienteId: id,
  subtotal: new Prisma.Decimal('100.50'),
  cuentaCorriente: { estado, cuota: id, tributo: { codigo: 'PRED' } },
});

function valor(over: Record<string, unknown> = {}) {
  return {
    id: 10,
    contribuyenteId: 5,
    estado: EstadoValor.COACTIVO,
    transferenciaId: 3,
    fechaNotificacion: new Date('2026-09-01'),
    detalles: [cuota(1, EstadoCuenta.COACTIVO), cuota(2, EstadoCuenta.CANCELADO)],
    _count: { expedientes: 0 },
    ...over,
  };
}

const activo = { activo: true };

function crear(valores: Record<number, unknown> = { 10: valor() }, ultimo: string | null = '000007') {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    valorCab: {
      findUnique: vi.fn(({ where }: { where: { id: number } }) => Promise.resolve(valores[where.id] ?? null)),
      update: vi.fn(),
    },
    coactivoExp: {
      findFirst: vi.fn().mockResolvedValue(ultimo ? { numExpediente: ultimo } : null),
      create: vi.fn(({ data }: { data: unknown }) => Promise.resolve({ id: 99, ...(data as object) })),
    },
  };
  const prisma = {
    ejecutorCoactivo: { findUnique: vi.fn().mockResolvedValue(activo) },
    auxiliarCoactivo: { findUnique: vi.fn().mockResolvedValue(activo) },
    tipoGestionCoactiva: { findUnique: vi.fn().mockResolvedValue(activo) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    valorCab: tx.valorCab,
  };
  return { prisma: prisma as any, tx };
}

const entrada = { valorId: 10, ejecutorId: 1, auxiliarId: 2 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T15:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('transferirValor — recepción en coactiva', () => {
  it('crea el expediente con el siguiente número y solo las cuotas en coactiva, sin tocar el valor', async () => {
    const { prisma, tx } = crear();

    await transferirValor(entrada, prisma);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1); // advisory lock dentro de la tx
    const { data } = tx.coactivoExp.create.mock.calls[0][0];
    expect(data).toMatchObject({ anioExpediente: 2026, numExpediente: '000008', valorId: 10, contribuyenteId: 5 });
    expect(data.detalles.create).toEqual([
      { cuentaCorrienteId: 1, descripcion: 'PRED - Cuota 1', monto: new Prisma.Decimal('100.50') },
    ]);
    expect(data).not.toHaveProperty('creadoPorId'); // lo fija el trigger de auditoría
    expect(tx.valorCab.update).not.toHaveBeenCalled(); // estado, transferenciaId y fechaNotificacion intactos
  });

  it('el primer expediente del año es 000001', async () => {
    const { prisma, tx } = crear(undefined, null);
    await transferirValor(entrada, prisma);
    expect(tx.coactivoExp.create.mock.calls[0][0].data.numExpediente).toBe('000001');
  });

  it('valor inexistente → 404', async () => {
    const { prisma, tx } = crear({});
    await expect(transferirValor(entrada, prisma)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.coactivoExp.create).not.toHaveBeenCalled();
  });

  it.each([
    ['CANCELADO', { estado: EstadoValor.CANCELADO }],
    ['ANULADO', { estado: EstadoValor.ANULADO }],
    ['EMITIDO', { estado: EstadoValor.EMITIDO, transferenciaId: null }],
    ['NOTIFICADO sin transferir', { estado: EstadoValor.NOTIFICADO, transferenciaId: null }],
    ['ya recibido', { _count: { expedientes: 1 } }],
    ['sin cuotas en coactiva', { detalles: [cuota(1, EstadoCuenta.CANCELADO)] }],
  ])('%s → 409 y cero escrituras', async (_caso, over) => {
    const { prisma, tx } = crear({ 10: valor(over) });
    await expect(transferirValor(entrada, prisma)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.coactivoExp.create).not.toHaveBeenCalled();
  });

  it('ejecutor, auxiliar o tipo de gestión inactivo → 400 antes de abrir la transacción', async () => {
    for (const maestro of ['ejecutorCoactivo', 'auxiliarCoactivo', 'tipoGestionCoactiva'] as const) {
      const { prisma } = crear();
      prisma[maestro].findUnique.mockResolvedValue({ activo: false });
      await expect(transferirValor({ ...entrada, tipoGestionId: 4 }, prisma)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it('choque del índice único (carrera) → 409, no 500', async () => {
    const { prisma, tx } = crear();
    tx.coactivoExp.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(transferirValor(entrada, prisma)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('transferirMasivo', () => {
  it('cada valor en su transacción: informa los fallidos sin revertir los exitosos; ids repetidos una vez', async () => {
    const { prisma } = crear({ 10: valor(), 11: valor({ id: 11, estado: EstadoValor.CANCELADO }) });

    const r = await transferirMasivo({ valorIds: [10, 11, 10, 12], ejecutorId: 1, auxiliarId: 2 }, prisma);

    expect(r.exitosos).toHaveLength(1);
    expect(r.fallidos.map((f) => f.valorId)).toEqual([11, 12]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('responsable inválido → 400 global, ningún valor procesado', async () => {
    const { prisma } = crear();
    prisma.auxiliarCoactivo.findUnique.mockResolvedValue(null);
    await expect(transferirMasivo({ valorIds: [10], ejecutorId: 1, auxiliarId: 2 }, prisma)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('whereRecibibles — los filtros no amplían lo recibible', () => {
  it('filtrar por contribuyente no pisa la condición de estado (bug original del OR)', () => {
    const where = whereRecibibles({ contribuyente: 'PEREZ', page: 1, limit: 20 });
    const and = where.AND as Prisma.ValorCabWhereInput[];
    expect(and[0]).toMatchObject({ estado: EstadoValor.COACTIVO, transferenciaId: { not: null } });
    expect(and[1]).toHaveProperty('contribuyente.OR');
    expect(where).not.toHaveProperty('OR');
  });
});

describe('asignarValores', () => {
  it('asigna solo valores recibidos en coactiva y no envía modificadoPorId', async () => {
    const valores: Record<number, unknown> = {
      10: { estado: EstadoValor.COACTIVO, _count: { expedientes: 1 } },
      11: { estado: EstadoValor.COACTIVO, _count: { expedientes: 0 } },
      12: { estado: EstadoValor.CANCELADO, _count: { expedientes: 1 } },
    };
    const { prisma } = crear(valores);

    const r = await asignarValores({ valorIds: [10, 11, 12, 13, 10], auxiliarId: 2 }, prisma);

    expect(r.exitosos).toBe(1);
    expect(r.fallidos.map((f) => f.valorId)).toEqual([11, 12, 13]);
    expect(prisma.valorCab.update).toHaveBeenCalledTimes(1);
    expect(prisma.valorCab.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { auxiliarAsignadoId: 2 } });
  });

  it('auxiliar inactivo → 400', async () => {
    const { prisma } = crear();
    prisma.auxiliarCoactivo.findUnique.mockResolvedValue({ activo: false });
    await expect(asignarValores({ valorIds: [10], auxiliarId: 2 }, prisma)).rejects.toBeInstanceOf(BadRequestException);
  });
});
