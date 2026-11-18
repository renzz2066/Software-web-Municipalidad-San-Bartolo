import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EstadoDj, EstadoPersona, EstadoRegistro, TipoPredio } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hoyLima } from '../rentas/fechas.js';
import { DeclaracionesService } from './declaraciones.service.js';

const PADRES: Record<string, string> = { A_COMPRAVENTA: 'COMPRA', CASA_UNIFAMILIAR: 'CASA' };

// Base y catálogos simulados: se prueba la regla, no Prisma.
function construir() {
  const prisma = {
    $transaction: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ ultimo: 7 }]),
    contribuyente: { findUnique: vi.fn().mockResolvedValue({ id: 3, estado: EstadoPersona.HABILITADO, nombreCompleto: 'ANA' }) },
    contribuyenteDocumento: { findUnique: vi.fn().mockResolvedValue(null) },
    djPresentada: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 50 }),
      update: vi.fn(),
    },
    djAnexo: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    predio: { findUnique: vi.fn().mockResolvedValue({ id: 9, tipo: TipoPredio.URBANO, estado: EstadoRegistro.ACTIVO }), findFirst: vi.fn().mockResolvedValue(null) },
    predioContribuyente: { count: vi.fn().mockResolvedValue(0) },
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
  const catalogos = {
    valorRegla: vi.fn(async (clave: string) => (clave === 'arbitrios.inicioAfectacion' ? 'MES_SIGUIENTE' : ['COMPRA'])),
    asegurarCodigos: vi.fn(async (_db: unknown, _g: unknown, codigos: string[]) =>
      new Map(
        codigos.filter(Boolean).map((c) => [
          c,
          { codigo: c, nombre: c, atributos: c === 'ACTUALIZACION_DATOS' ? { tipo: 'INFORMATIVA' } : { tipo: 'DECLARATIVA' }, padre: PADRES[c] ? { codigo: PADRES[c] } : null },
        ]),
      ),
    ),
  };
  const servicio = new DeclaracionesService(prisma as unknown as PrismaService, catalogos as unknown as CatalogosService);
  vi.spyOn(servicio, 'findOne').mockResolvedValue({} as never);
  return { servicio, prisma };
}

const hoy = hoyLima();
const anexo = (extra: object = {}) => ({
  predioId: 9,
  condicion: 'PROPIETARIO_UNICO',
  porcentaje: 100,
  fechaAdquisicion: hoy,
  areaTerreno: 120,
  niveles: [],
  obras: [],
  usos: [{ uso: 'CASA', subUso: 'CASA_UNIFAMILIAR', area: 120 }],
  rusticos: [],
  adquirientes: [],
  ...extra,
});
const DJ = (extra: object = {}) => ({ contribuyenteId: 3, motivo: 'COMPRA', subMotivo: 'A_COMPRAVENTA', fechaPresentacion: hoy, documentos: [], anexos: [anexo()], ...extra });

describe('DeclaracionesService', () => {
  it('registra PENDIENTE con su correlativo, el tipo del motivo, la copia de la persona y la afectación por defecto', async () => {
    const { servicio, prisma } = construir();
    await servicio.registrar(DJ() as never);
    const data = prisma.djPresentada.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ anio: Number(hoy.slice(0, 4)), numero: 7, motivo: 'COMPRA', tipo: 'DECLARATIVA', persona: { id: 3, nombreCompleto: 'ANA' } });
    const a = prisma.djAnexo.create.mock.calls[0][0].data;
    expect(a).toMatchObject({ djId: 50, numero: 1, predioId: 9, anioAfectacion: Number(hoy.slice(0, 4)) + 1 });
    expect(a.usos.create[0]).toMatchObject({ uso: 'CASA', predominante: true });
  });

  it('J06: una segunda inscripción → 409', async () => {
    const { servicio, prisma } = construir();
    prisma.djPresentada.findMany.mockResolvedValue([{ anio: 2025, numero: 3 }]);
    await expect(servicio.registrar(DJ({ motivo: 'INSCRIPCION', subMotivo: null }) as never)).rejects.toThrow(/25-0000003/);
  });

  it('una persona inhabilitada no declara', async () => {
    const { servicio, prisma } = construir();
    prisma.contribuyente.findUnique.mockResolvedValue({ id: 3, estado: EstadoPersona.INHABILITADO });
    await expect(servicio.registrar(DJ() as never)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.djPresentada.create).not.toHaveBeenCalled();
  });

  it('un sub-motivo de otro motivo → 400', async () => {
    const { servicio } = construir();
    await expect(servicio.registrar(DJ({ motivo: 'VENTA' }) as never)).rejects.toThrow(/no corresponde al motivo/);
  });

  it('R04: si otro condómino ya declaró 60%, esta DJ no puede declarar 50%', async () => {
    const { servicio, prisma } = construir();
    prisma.djAnexo.findMany.mockResolvedValue([{ porcentaje: 60, fechaDescargo: null, dj: { contribuyenteId: 8, contribuyente: { nombreCompleto: 'ROSA' } } }]);
    await expect(servicio.registrar(DJ({ anexos: [anexo({ porcentaje: 50, condicion: 'CONDOMINIO' })] }) as never)).rejects.toThrow(/ROSA 60%/);
  });

  it('un descargo lo hace solo quien es titular', async () => {
    const { servicio } = construir();
    const venta = DJ({ motivo: 'VENTA', subMotivo: null, anexos: [anexo({ fechaAdquisicion: null, fechaDescargo: hoy, adquirientes: [{ rol: 'ADQUIRIENTE', nombreCompleto: 'X' }] })] });
    await expect(servicio.registrar(venta as never)).rejects.toThrow(/no es titular/);
  });

  it('anular exige motivo y solo desde pendiente; reabrir es de supervisor', async () => {
    const { servicio, prisma } = construir();
    prisma.djPresentada.findUnique.mockResolvedValue({ estado: EstadoDj.PENDIENTE, motivo: 'COMPRA' });
    await expect(servicio.anular(50, { motivo: 'corto' }, { id: 1, rol: 'CAJERO' })).rejects.toBeInstanceOf(BadRequestException);
    await servicio.anular(50, { motivo: 'Se registró a la persona equivocada' }, { id: 1, rol: 'CAJERO' });
    expect(prisma.djPresentada.update.mock.calls[0][0].data).toMatchObject({ estado: EstadoDj.ANULADA, anuladaPorId: 1 });
    prisma.djPresentada.findUnique.mockResolvedValue({ estado: EstadoDj.LIQUIDADA, motivo: 'COMPRA' });
    await expect(servicio.anular(50, { motivo: 'Se registró a la persona equivocada' }, { id: 1, rol: 'CAJERO' })).rejects.toThrow(/extornando/);
    await expect(servicio.reabrir(50, { id: 1, rol: 'CAJERO' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
