import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EstadoPersona, TipoPersona } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { DireccionesService } from '../direcciones/direcciones.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EstadoCuentaService } from '../rentas/estado-cuenta/estado-cuenta.service.js';
import { ContribuyentesService } from './contribuyentes.service.js';

// Base y catálogos simulados: aquí se prueba la regla, no Prisma.
function construir() {
  const prisma = {
    $transaction: vi.fn(),
    contribuyente: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
    },
    contribuyenteDocumento: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() },
    cuentaCorriente: { count: vi.fn().mockResolvedValue(0) },
    ubigeo: { findUnique: vi.fn().mockResolvedValue({ distrito: 'SAN BARTOLO' }) },
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
  const catalogos = {
    asegurarCodigos: vi.fn(async (_db: unknown, _grupo: unknown, codigos: string[]) => new Map(codigos.map((c) => [c, { codigo: c, nombre: c, atributos: null }]))),
  };
  const estadoCuenta = { generar: vi.fn().mockResolvedValue({ totales: { total: '350.00' } }) };
  const direcciones = { ubigeoMuni: vi.fn().mockResolvedValue('150129'), paraDomicilio: vi.fn() };
  const servicio = new ContribuyentesService(
    prisma as unknown as PrismaService,
    catalogos as unknown as CatalogosService,
    estadoCuenta as unknown as EstadoCuentaService,
    direcciones as unknown as DireccionesService,
  );
  return { servicio, prisma, estadoCuenta, direcciones };
}

const NATURAL = { tipoPersona: TipoPersona.NATURAL, apellidoPaterno: 'Perez', apellidoMaterno: 'Ramos', nombres: 'Juan' };

describe('ContribuyentesService', () => {
  describe('inhabilitar (P01)', () => {
    it('con deuda vigente → 409 con el monto y no cambia el estado', async () => {
      const { servicio, prisma, estadoCuenta } = construir();
      prisma.contribuyente.findUnique.mockResolvedValue({ estado: EstadoPersona.HABILITADO, numDoc: '45678912', excepcionAprobadaAt: null, nombreRevisado: true });
      prisma.cuentaCorriente.count.mockResolvedValue(3);
      const intento = servicio.cambiarEstado(7, { estado: EstadoPersona.INHABILITADO });
      await expect(intento).rejects.toBeInstanceOf(ConflictException);
      await expect(intento).rejects.toThrow('mantiene una deuda de S/ 350.00 y no puede ser inhabilitado');
      expect(estadoCuenta.generar).toHaveBeenCalledWith(7);
      expect(prisma.contribuyente.update).not.toHaveBeenCalled();
    });

    it('sin deuda → INHABILITADO con su motivo', async () => {
      const { servicio, prisma } = construir();
      prisma.contribuyente.findUnique.mockResolvedValue({ estado: EstadoPersona.HABILITADO, numDoc: '45678912', excepcionAprobadaAt: null, nombreRevisado: true });
      await servicio.cambiarEstado(7, { estado: EstadoPersona.INHABILITADO, motivo: 'Vendió su único predio' });
      expect(prisma.contribuyente.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { estado: EstadoPersona.INHABILITADO, motivoEstado: 'Vendió su único predio' },
      });
    });

    it('habilitar no revisa deuda y vuelve a PENDIENTE si faltan datos (P02)', async () => {
      const { servicio, prisma } = construir();
      prisma.contribuyente.findUnique.mockResolvedValue({ estado: EstadoPersona.INHABILITADO, numDoc: null, excepcionAprobadaAt: null, nombreRevisado: true });
      prisma.cuentaCorriente.count.mockResolvedValue(5);
      await servicio.cambiarEstado(7, { estado: EstadoPersona.HABILITADO });
      expect(prisma.cuentaCorriente.count).not.toHaveBeenCalled();
      expect(prisma.contribuyente.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { estado: EstadoPersona.PENDIENTE, motivoEstado: null } });
    });
  });

  describe('alta (P05, P08, P17)', () => {
    it('sin documento exige justificación', async () => {
      const { servicio } = construir();
      await expect(servicio.create({ ...NATURAL, documentos: [] })).rejects.toThrow(/explica por qué/);
    });

    it('sin documento y con justificación queda PENDIENTE, con SIN_DOCUMENTO como principal', async () => {
      const { servicio, prisma } = construir();
      await servicio.create({ ...NATURAL, documentos: [], sinDocumentoMotivo: 'Adulto mayor indocumentado, trámite en RENIEC' });
      const data = prisma.contribuyente.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        estado: EstadoPersona.PENDIENTE,
        tipoDoc: 'SIN_DOCUMENTO',
        numDoc: null,
        nombreCompleto: 'PEREZ RAMOS JUAN',
        nombreRevisado: true,
        ubigeo: '150129',
      });
    });

    it('00000000 se rechaza antes de escribir', async () => {
      const { servicio, prisma } = construir();
      await expect(servicio.create({ ...NATURAL, documentos: [{ tipoDoc: 'DNI', numDoc: '00000000' }] })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.contribuyente.create).not.toHaveBeenCalled();
    });

    it('con DNI válido queda HABILITADO y guarda el documento', async () => {
      const { servicio, prisma } = construir();
      await servicio.create({ ...NATURAL, documentos: [{ tipoDoc: 'DNI', numDoc: '45678912' }] });
      expect(prisma.contribuyente.create.mock.calls[0][0].data).toMatchObject({ estado: EstadoPersona.HABILITADO, tipoDoc: 'DNI', numDoc: '45678912' });
      expect(prisma.contribuyenteDocumento.createMany).toHaveBeenCalledWith({
        data: [{ contribuyenteId: 1, orden: 1, tipoDoc: 'DNI', numDoc: '45678912' }],
      });
    });

    it('documento de otra persona → 409 con su nombre (P06)', async () => {
      const { servicio, prisma } = construir();
      prisma.contribuyenteDocumento.findFirst.mockResolvedValue({ tipoDoc: 'DNI', numDoc: '45678912', contribuyente: { id: 3, nombreCompleto: 'ROSA DIAZ' } });
      await expect(servicio.create({ ...NATURAL, documentos: [{ tipoDoc: 'DNI', numDoc: '45678912' }] })).rejects.toThrow(/ROSA DIAZ \(id 3\)/);
    });
  });

  describe('supervisión (P04, P08)', () => {
    it('un cajero no aprueba la excepción ni elimina', async () => {
      const { servicio } = construir();
      await expect(servicio.aprobarExcepcion(7, { id: 2, rol: 'CAJERO' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(servicio.eliminar(7, { id: 2, rol: 'CAJERO' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('con historia no se elimina: se inhabilita', async () => {
      const { servicio, prisma } = construir();
      prisma.contribuyente.findUnique.mockResolvedValue({
        _count: { declaraciones: 0, cuentas: 2, predios: 0, recibos: 0, pagos: 0, valores: 0, convenios: 0, fiscalizaciones: 0, coactivoExps: 0, licencias: 0, vehiculos: 0 },
      });
      await expect(servicio.eliminar(7, { id: 1, rol: 'SUPERVISOR' })).rejects.toThrow(/se inhabilita/);
      expect(prisma.contribuyente.delete).not.toHaveBeenCalled();
    });
  });

  describe('domicilio fiscal (P11)', () => {
    const DNI = { ...NATURAL, documentos: [{ tipoDoc: 'DNI', numDoc: '45678912' }] };

    it('en el distrito: apunta a la dirección única y copia su literal en direccionFiscal', async () => {
      const { servicio, prisma, direcciones } = construir();
      direcciones.paraDomicilio.mockResolvedValue({ id: 9, ubigeo: '150129', direccion: 'AV LOS PINOS N° 123, SAN BARTOLO', activo: true });
      await servicio.create({ ...DNI, direccionId: 9 });
      expect(direcciones.paraDomicilio).toHaveBeenCalledWith(prisma, 9, null);
      expect(prisma.contribuyente.create.mock.calls[0][0].data).toMatchObject({
        direccionId: 9,
        ubigeo: '150129',
        domicilioTexto: null,
        direccionFiscal: 'AV LOS PINOS N° 123, SAN BARTOLO',
      });
    });

    it('foráneo: ubigeo + texto, y la línea lleva el distrito', async () => {
      const { servicio, prisma } = construir();
      prisma.ubigeo.findUnique.mockResolvedValue({ distrito: 'MIRAFLORES' });
      await servicio.create({ ...DNI, ubigeo: '150122', domicilioTexto: ' av. larco  101 ' });
      expect(prisma.contribuyente.create.mock.calls[0][0].data).toMatchObject({
        direccionId: null,
        ubigeo: '150122',
        domicilioTexto: 'AV. LARCO 101',
        direccionFiscal: 'AV. LARCO 101, MIRAFLORES',
      });
    });

    it('texto libre en el propio distrito → 400: se elige del catálogo', async () => {
      const { servicio, prisma } = construir();
      await expect(servicio.create({ ...DNI, ubigeo: '150129', domicilioTexto: 'AV LOS PINOS 123' })).rejects.toThrow(/catálogo de direcciones/);
      expect(prisma.contribuyente.create).not.toHaveBeenCalled();
    });

    it('dirección del catálogo y texto a la vez → 400', async () => {
      const { servicio } = construir();
      await expect(servicio.create({ ...DNI, direccionId: 9, domicilioTexto: 'JR LIMA 1' })).rejects.toThrow(/no ambos/);
    });

    it('un texto heredado de v1 en el distrito se conserva si no se toca', async () => {
      const { servicio, prisma } = construir();
      const actual = {
        id: 7, tipoPersona: TipoPersona.NATURAL, numDoc: '45678912', excepcionAprobadaAt: null, nombreRevisado: true,
        estado: EstadoPersona.HABILITADO, direccionId: null, ubigeo: '150129', domicilioTexto: 'JR LIMA 456', direccionFiscal: 'JR LIMA 456',
      };
      prisma.contribuyente.findUnique.mockResolvedValue(actual);
      await servicio.update(7, { ubigeo: '150129', domicilioTexto: 'JR LIMA 456' });
      const data = prisma.contribuyente.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('direccionFiscal');
      expect(data).not.toHaveProperty('domicilioTexto');
    });
  });
});
