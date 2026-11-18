import { BadRequestException } from '@nestjs/common';
import { EstadoRegistro, TipoPersona } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { DireccionesService } from '../direcciones/direcciones.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hoyLima } from '../rentas/fechas.js';
import { PrediosService } from './predios.service.js';

// Base simulada: se prueba la DJ v1 con la dirección única y las fechas de titularidad (Fase 3).
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

const anio = Number(hoyLima().slice(0, 4));
const PREDIO = { viaId: 1, zonaId: 2, numero: ' 123 ', manzana: '', lote: '', areaTerreno: 120, usoPredio: 'casa' };

describe('PrediosService — DJ v1 con el predio maestro (Fase 3)', () => {
  it('compra: la ubicación pasa por la dirección única y el vendedor queda con fecha de fin', async () => {
    const { servicio, prisma, direcciones } = construir();
    prisma.predio.findUnique.mockResolvedValue({ id: 5, estado: EstadoRegistro.ACTIVO, contribuyentes: [{ contribuyenteId: 1 }] });
    prisma.contribuyente.findMany.mockResolvedValue([{ id: 2, tipoPersona: TipoPersona.NATURAL }]);
    await servicio.declarar({
      motivo: 'COMPRA',
      anio,
      fecha: `${anio}-01-02`,
      fechaHecho: `${anio}-01-01`,
      declaranteId: 2,
      predioId: 5,
      predio: PREDIO,
      condominos: [{ contribuyenteId: 2, porcentaje: 100 }],
      pisos: [],
      otrasInstalaciones: [],
    } as never);

    expect(direcciones.obtenerOCrear).toHaveBeenCalledWith(prisma, {
      zonaId: 2,
      urbanizacionId: null,
      viaId: 1,
      componentes: [{ componente: 'NUMERO', valor: '123' }],
      referencia: null,
    });
    expect(prisma.predio.update.mock.calls[0][0].data).toMatchObject({ direccionId: 9, viaId: 1, zonaId: 2, numero: '123', usoPredio: 'CASA' });
    expect(prisma.predioContribuyente.updateMany).toHaveBeenCalledWith({
      where: { predioId: 5, estado: EstadoRegistro.ACTIVO, contribuyenteId: { notIn: [2] } },
      data: { estado: EstadoRegistro.BAJA, esPrincipal: false, fechaFin: new Date(`${anio}-01-01`) },
    });
    expect(prisma.predioContribuyente.upsert.mock.calls[0][0].create).toMatchObject({
      contribuyenteId: 2,
      fechaAdquisicion: new Date(`${anio}-01-01`),
      condicion: 'PROPIETARIO_UNICO',
    });
  });

  it('la condición elegida a mano (poseedor) no se pisa con la automática', async () => {
    const { servicio, prisma } = construir();
    prisma.predio.findUnique.mockResolvedValue({ id: 5, estado: EstadoRegistro.ACTIVO, contribuyentes: [{ contribuyenteId: 2 }] });
    prisma.contribuyente.findMany.mockResolvedValue([{ id: 2, tipoPersona: TipoPersona.NATURAL }]);
    prisma.predioContribuyente.findMany.mockResolvedValue([{ contribuyenteId: 2, condicion: 'POSEEDOR', estado: EstadoRegistro.ACTIVO }]);
    await servicio.declarar({
      motivo: 'RECTIFICACION',
      anio,
      fecha: `${anio}-01-02`,
      declaranteId: 2,
      predioId: 5,
      predio: PREDIO,
      condominos: [{ contribuyenteId: 2, porcentaje: 100 }],
      pisos: [],
      otrasInstalaciones: [],
    } as never);
    expect(prisma.predioContribuyente.upsert.mock.calls[0][0].update).toMatchObject({ condicion: 'POSEEDOR' });
    expect(prisma.predioContribuyente.upsert.mock.calls[0][0].update).not.toHaveProperty('fechaFin');
  });

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
