import {
  BadRequestException,
  BadGatewayException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TipoPersona } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConsultarIdentidadDto } from '../dto/contribuyente.dto.js';
import { IdentidadService } from './identidad.service.js';
import { IdentidadError, IdentidadProvider } from './identidad.provider.js';

// Dígito verificador módulo 11 (misma fórmula que documento.ts).
const RUC_NATURAL = '10123456781';
const RUC_JURIDICO = '20123456786';

function prismaFalso() {
  return {
    contribuyente: { findFirst: vi.fn().mockResolvedValue(null) },
    consultaIdentidad: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function construir(prisma = prismaFalso(), proveedor = { consultar: vi.fn() }) {
  // Un acierto cualquiera por defecto: los tests que fallan lo pisan con mockRejectedValue.
  proveedor.consultar.mockResolvedValue({
    tipoPersona: 'NATURAL',
    nombreCompleto: 'CONSULTADO',
    estado: null,
    condicion: null,
    direccionExterna: null,
  });
  const servicio = new IdentidadService(
    prisma as unknown as PrismaService,
    proveedor as unknown as IdentidadProvider,
  );
  return { servicio, prisma, proveedor };
}

const dni = (numDoc = '12345678'): ConsultarIdentidadDto => ({ tipoDoc: 'DNI', numDoc });

describe('IdentidadService', () => {
  it('CE y pasaporte no se consultan (BadRequest) y no gastan cupo', async () => {
    const { servicio, proveedor } = construir();
    await expect(servicio.consultar({ tipoDoc: 'CE', numDoc: 'ABC123456' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(proveedor.consultar).not.toHaveBeenCalled();
  });

  it('DNI con menos de 8 dígitos → BadRequest sin llamar al proveedor', async () => {
    const { servicio, proveedor } = construir();
    await expect(servicio.consultar(dni('123'))).rejects.toBeInstanceOf(BadRequestException);
    expect(proveedor.consultar).not.toHaveBeenCalled();
  });

  it('ya inscrito → origen "propia" con su ficha, sin gastar cupo', async () => {
    const { servicio, prisma, proveedor } = construir();
    prisma.contribuyente.findFirst.mockResolvedValue({
      id: 7,
      tipoPersona: TipoPersona.NATURAL,
      nombreCompleto: 'PEREZ RAMOS JUAN',
      estado: 'ACTIVO',
    });
    await expect(servicio.consultar(dni())).resolves.toEqual({
      origen: 'propia',
      contribuyenteId: 7,
      tipoPersona: TipoPersona.NATURAL,
      nombreCompleto: 'PEREZ RAMOS JUAN',
      estado: 'ACTIVO',
    });
    expect(proveedor.consultar).not.toHaveBeenCalled();
    expect(prisma.consultaIdentidad.findUnique).not.toHaveBeenCalled();
  });

  it('al editar, excluirId evita que el propio registro salga como duplicado', async () => {
    const { servicio, prisma } = construir();
    await servicio.consultar({ ...dni(), excluirId: 7 });
    expect(prisma.contribuyente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { numDoc: '12345678', id: { not: 7 } } }),
    );
  });

  it('caché vigente → origen "cache" sin llamar al proveedor', async () => {
    const { servicio, prisma, proveedor } = construir();
    prisma.consultaIdentidad.findUnique.mockResolvedValue({
      tipoDoc: 'DNI',
      numDoc: '12345678',
      consultadoAt: new Date(),
      datos: {
        tipoPersona: TipoPersona.NATURAL,
        nombreCompleto: 'DE LA CRUZ MENDOZA LUPE',
        estado: null,
        condicion: null,
        direccionExterna: null,
      },
    });
    const r = await servicio.consultar(dni());
    expect(r).toMatchObject({
      origen: 'cache',
      nombreCompleto: 'DE LA CRUZ MENDOZA LUPE',
      contribuyenteId: null,
      consultadoEn: expect.any(String),
    });
    expect(proveedor.consultar).not.toHaveBeenCalled();
  });

  it('caché vencida (31 días) → vuelve a consultar al proveedor', async () => {
    const { servicio, prisma, proveedor } = construir();
    prisma.consultaIdentidad.findUnique.mockResolvedValue({
      tipoDoc: 'DNI',
      numDoc: '12345678',
      consultadoAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      datos: { tipoPersona: 'NATURAL', nombreCompleto: 'VIEJO', estado: null, condicion: null, direccionExterna: null },
    });
    proveedor.consultar.mockResolvedValue({
      tipoPersona: 'NATURAL',
      nombreCompleto: 'ACTUALIZADO',
      estado: null,
      condicion: null,
      direccionExterna: null,
    });
    const r = await servicio.consultar(dni());
    expect(r).toMatchObject({ origen: 'externa', nombreCompleto: 'ACTUALIZADO' });
  });

  it('acertó fuera de caché → guarda el acierto y poda los vencidos', async () => {
    const { servicio, prisma, proveedor } = construir();
    proveedor.consultar.mockResolvedValue({
      tipoPersona: 'NATURAL',
      nombreCompleto: 'PEREZ RAMOS JUAN',
      estado: null,
      condicion: null,
      direccionExterna: null,
    });
    const r = await servicio.consultar(dni());
    expect(r).toMatchObject({ origen: 'externa', nombreCompleto: 'PEREZ RAMOS JUAN' });
    expect(prisma.consultaIdentidad.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.consultaIdentidad.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('sin key (SIN_KEY) → 503 y nada se guarda en caché', async () => {
    const { servicio, prisma, proveedor } = construir();
    proveedor.consultar.mockRejectedValue(new IdentidadError('SIN_KEY', 'IDENTIDAD_API_KEY no está configurada'));
    await expect(servicio.consultar(dni())).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.consultaIdentidad.upsert).not.toHaveBeenCalled();
  });

  it('documento inexistente → 404, y no se cachea (un DNI nuevo no quedaría bloqueado)', async () => {
    const { servicio, prisma, proveedor } = construir();
    proveedor.consultar.mockRejectedValue(new IdentidadError('NO_ENCONTRADO', 'no existe'));
    await expect(servicio.consultar(dni())).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.consultaIdentidad.upsert).not.toHaveBeenCalled();
  });

  it('cupo agotado → 429', async () => {
    const { servicio, proveedor } = construir();
    proveedor.consultar.mockRejectedValue(new IdentidadError('CUPO', 'agotado'));
    const e = await servicio.consultar(dni()).catch((x) => x);
    expect(e).toBeInstanceOf(HttpException);
    expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('proveedor caído → 503 reintentable', async () => {
    const { servicio, proveedor } = construir();
    proveedor.consultar.mockRejectedValue(new IdentidadError('REINTENTAR', 'caído'));
    await expect(servicio.consultar(dni())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('respuesta rara del proveedor → 502', async () => {
    const { servicio, proveedor } = construir();
    proveedor.consultar.mockRejectedValue(new IdentidadError('PROVEEDOR', 'respuesta inesperada'));
    await expect(servicio.consultar(dni())).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('RUC 20 → persona jurídica; RUC 10 → persona natural', async () => {
    const { servicio, proveedor } = construir();
    proveedor.consultar.mockResolvedValue({
      tipoPersona: 'JURIDICA',
      nombreCompleto: 'ACME S.A.C.',
      estado: 'ACTIVO',
      condicion: 'HABIDO',
      direccionExterna: 'AV. PRINCIPAL 1',
    });
    const juridico = await servicio.consultar({ tipoDoc: 'RUC', numDoc: RUC_JURIDICO });
    expect(juridico).toMatchObject({ origen: 'externa', tipoPersona: TipoPersona.JURIDICA });

    proveedor.consultar.mockResolvedValue({
      tipoPersona: 'NATURAL',
      nombreCompleto: 'PEREZ RAMOS JUAN',
      estado: null,
      condicion: null,
      direccionExterna: null,
    });
    const natural = await servicio.consultar({ tipoDoc: 'RUC', numDoc: RUC_NATURAL });
    expect(natural).toMatchObject({ origen: 'externa', tipoPersona: TipoPersona.NATURAL });
  });
});
