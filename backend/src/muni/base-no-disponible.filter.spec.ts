import type { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { BaseNoDisponibleFilter, esBaseNoDisponible } from './base-no-disponible.filter.js';
import { contextoMuni, type Muni } from './muni.registro.js';

const DEMO = { slug: 'demo', nombreCorto: 'Muni Demo' } as Muni;
const conocido = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`fallo ${code}`, { code, clientVersion: '6.19.3' });

function hostFalso() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  return { host, res };
}

describe('esBaseNoDisponible', () => {
  it.each(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017'])('%s (base caída en pleno uso) → sí', (code) => {
    expect(esBaseNoDisponible(conocido(code))).toBe(true);
  });

  it('InitializationError (base caída al primer uso) → sí', () => {
    expect(esBaseNoDisponible(new Prisma.PrismaClientInitializationError("Can't reach", '6.19.3', 'P1001'))).toBe(true);
  });

  it.each(['P2002', 'P2025', 'P2024'])('%s (error de datos, no de conexión) → no', (code) => {
    expect(esBaseNoDisponible(conocido(code))).toBe(false);
  });

  it('errores que no son de Prisma → no', () => {
    expect(esBaseNoDisponible(new Error('P1001'))).toBe(false);
    expect(esBaseNoDisponible(undefined)).toBe(false);
  });
});

describe('BaseNoDisponibleFilter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('P1017 en pleno uso → 503 con el nombre de la muni activa', () => {
    const { host, res } = hostFalso();

    contextoMuni.run(DEMO, () => new BaseNoDisponibleFilter().catch(conocido('P1017'), host));

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se pudo conectar con la base de datos de Muni Demo. Intenta en unos minutos.',
      error: 'Service Unavailable',
      statusCode: 503,
    });
  });

  it('InitializationError → 503', () => {
    const { host, res } = hostFalso();

    contextoMuni.run(DEMO, () =>
      new BaseNoDisponibleFilter().catch(new Prisma.PrismaClientInitializationError("Can't reach", '6.19.3'), host),
    );

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('sin muni en contexto usa un texto genérico', () => {
    const { host, res } = hostFalso();

    new BaseNoDisponibleFilter().catch(conocido('P1001'), host);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'No se pudo conectar con la base de datos de la municipalidad. Intenta en unos minutos.' }),
    );
  });

  it('P2002 no se convierte en 503: lo delega al manejo normal de Nest', () => {
    const { host, res } = hostFalso();
    const base = vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
    const error = conocido('P2002');

    new BaseNoDisponibleFilter().catch(error, host);

    expect(base).toHaveBeenCalledWith(error, host);
    expect(res.status).not.toHaveBeenCalled();
  });
});
