import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DireccionesService } from './direcciones.service.js';

const ABREVIATURAS: Record<string, string> = { NUMERO: 'N°', DPTO: 'Dpto.', MZ: 'Mz.', LT: 'Lt.' };

// Base y catálogos simulados: aquí se prueba la regla (D01–D05), no Prisma.
function construir() {
  const prisma = {
    $transaction: vi.fn(),
    direccion: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 5 }),
      update: vi.fn().mockResolvedValue({}),
    },
    direccionComponente: { deleteMany: vi.fn(), update: vi.fn(), createMany: vi.fn() },
    contribuyente: { updateMany: vi.fn() },
    via: { findUnique: vi.fn().mockResolvedValue({ tipoVia: 'AV', nombre: 'LOS PINOS' }) },
    urbanizacion: { findUnique: vi.fn().mockResolvedValue({ nombre: 'URB. LOS DELFINES' }) },
    zona: { findUnique: vi.fn().mockResolvedValue({ nombre: 'SECTOR PLAYA' }) },
    ubigeo: { findUnique: vi.fn().mockResolvedValue({ distrito: 'SAN BARTOLO' }) },
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
  const catalogos = {
    valorRegla: vi.fn().mockResolvedValue('150129'),
    asegurarCodigos: vi.fn(
      async (_db: unknown, _grupo: unknown, codigos: string[]) =>
        new Map(codigos.map((c) => [c, { codigo: c, nombre: c, abreviatura: ABREVIATURAS[c] ?? null }])),
    ),
  };
  const servicio = new DireccionesService(prisma as unknown as PrismaService, catalogos as unknown as CatalogosService);
  // findOne al final: no interesa aquí.
  vi.spyOn(servicio, 'findOne').mockResolvedValue({} as never);
  return { servicio, prisma, catalogos };
}

const SUPERVISOR = { id: 1, rol: 'SUPERVISOR' };

describe('DireccionesService', () => {
  it('alta: arma la literal con las abreviaturas del catálogo y la clave ordenada', async () => {
    const { servicio, prisma } = construir();
    await servicio.crear({
      viaId: 3,
      urbanizacionId: 2,
      componentes: [
        { componente: 'NUMERO', valor: ' 123 ' },
        { componente: 'DPTO', valor: '2' },
      ],
      referencia: ' frente al parque ',
    });
    const data = prisma.direccion.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      ubigeo: '150129',
      direccion: 'AV LOS PINOS N° 123 Dpto. 2 URB. LOS DELFINES, SAN BARTOLO',
      clave: '150129||2|3|DPTO=2;NUMERO=123',
      referencia: 'FRENTE AL PARQUE',
    });
    expect(data.componentes.create).toEqual([
      { orden: 1, componente: 'NUMERO', valor: '123' },
      { orden: 2, componente: 'DPTO', valor: '2' },
    ]);
  });

  it('una dirección que ya existe → 409 con su id, sin crear otra (D01)', async () => {
    const { servicio, prisma } = construir();
    prisma.direccion.findUnique.mockResolvedValue({ id: 8, direccion: 'AV LOS PINOS N° 123, SAN BARTOLO', activo: true });
    const intento = servicio.crear({ viaId: 3, componentes: [{ componente: 'NUMERO', valor: '123' }] });
    await expect(intento).rejects.toBeInstanceOf(ConflictException);
    await intento.catch((e: ConflictException) => expect(e.getResponse()).toMatchObject({ direccionId: 8, statusCode: 409 }));
    expect(prisma.direccion.create).not.toHaveBeenCalled();
  });

  it('sin vía ni habilitación → 400', async () => {
    const { servicio } = construir();
    await expect(servicio.crear({ zonaId: 1, componentes: [{ componente: 'MZ', valor: 'A' }] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un cajero no edita ni da de baja una dirección compartida', async () => {
    const { servicio, prisma } = construir();
    await expect(servicio.actualizar(5, { referencia: 'X' }, { id: 2, rol: 'CAJERO' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(servicio.cambiarEstado(5, { activo: false }, { id: 2, rol: 'CAJERO' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.direccion.update).not.toHaveBeenCalled();
  });

  it('editar la literal actualiza direccionFiscal de todos los que la usan, en la misma transacción', async () => {
    const { servicio, prisma } = construir();
    prisma.direccion.findUnique.mockImplementation(async ({ where }: { where: { id?: number; clave?: string } }) =>
      where.id
        ? {
            id: 5,
            ubigeo: '150129',
            zonaId: null,
            urbanizacionId: null,
            viaId: 3,
            direccion: 'AV LOS PINOS N° 123, SAN BARTOLO',
            referencia: null,
            latitud: null,
            longitud: null,
            componentes: [{ id: 11, orden: 1, componente: 'NUMERO', valor: '123' }],
          }
        : null,
    );
    await servicio.actualizar(5, { componentes: [{ componente: 'NUMERO', valor: '125' }] }, SUPERVISOR);
    expect(prisma.direccionComponente.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { valor: '125', orden: 1 } });
    expect(prisma.contribuyente.updateMany).toHaveBeenCalledWith({
      where: { direccionId: 5 },
      data: { direccionFiscal: 'AV LOS PINOS N° 125, SAN BARTOLO' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('una dirección dada de baja no se asigna a una persona nueva, pero quien ya la tenía la conserva', async () => {
    const { servicio, prisma } = construir();
    prisma.direccion.findUnique.mockResolvedValue({ id: 5, ubigeo: '150129', direccion: 'AV X', activo: false });
    await expect(servicio.paraDomicilio(prisma as unknown as PrismaService, 5, null)).rejects.toThrow(/dada de baja/);
    await expect(servicio.paraDomicilio(prisma as unknown as PrismaService, 5, 5)).resolves.toMatchObject({ id: 5 });
  });
});
