import { BadRequestException } from '@nestjs/common';
import { EstadoRegistro } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { DireccionesService } from '../direcciones/direcciones.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrediosService } from './predios.service.js';

// Base simulada: se prueba el predio maestro (Fase 3). El alta de DJ de v1 se retiró en la Fase 6.
function construir() {
  const prisma = {
    $transaction: vi.fn(),
    predio: {
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 5 }),
      create: vi.fn().mockResolvedValue({ id: 5 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 5 }),
    },
    contribuyente: { findMany: vi.fn() },
    piso: { deleteMany: vi.fn(), createMany: vi.fn() },
    otraInstalacion: { deleteMany: vi.fn(), createMany: vi.fn() },
    predioContribuyente: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), update: vi.fn() },
    declaracionJurada: { create: vi.fn().mockResolvedValue({ id: 70 }) },
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
  const direcciones = { obtenerOCrear: vi.fn().mockResolvedValue({ id: 9, direccion: 'AV LOS PINOS N° 123, SAN BARTOLO' }) };
  const catalogos = {
    asegurarCodigos: vi.fn(async (_db: unknown, _g: unknown, codigos: string[]) => new Map(codigos.map((c) => [c, { codigo: c, nombre: c, atributos: null }]))),
  };
  const servicio = new PrediosService(
    prisma as unknown as PrismaService,
    direcciones as unknown as DireccionesService,
    catalogos as unknown as CatalogosService,
  );
  return { servicio, prisma, direcciones };
}


describe('PrediosService — predio maestro (Fase 3)', () => {
  it('maestro: la condición solo se cambia a titulares vigentes', async () => {
    const { servicio, prisma } = construir();
    prisma.predio.findUnique.mockResolvedValue({
      id: 5,
      estado: EstadoRegistro.ACTIVO,
      latitud: null,
      longitud: null,
      frecuenciaBarrido: null,
      ubicacionParque: null,
      contribuyentes: [{ contribuyenteId: 2, condicion: 'PROPIETARIO_UNICO' }],
    });
    await expect(servicio.actualizarMaestro(5, { titulares: [{ contribuyenteId: 3, condicion: 'POSEEDOR' }] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maestro: coordenadas juntas y linderos con metros válidos', async () => {
    const { servicio, prisma } = construir();
    prisma.predio.findUnique.mockResolvedValue({ id: 5, estado: EstadoRegistro.ACTIVO, latitud: null, longitud: null, contribuyentes: [] });
    await expect(servicio.actualizarMaestro(5, { latitud: -12.39 })).rejects.toThrow(/latitud y longitud/);
    await expect(servicio.actualizarMaestro(5, { linderoFondoMetros: -1 })).rejects.toThrow(/fondo/);
    expect(prisma.predio.update).not.toHaveBeenCalled();
  });
});
