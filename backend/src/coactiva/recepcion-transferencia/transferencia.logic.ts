import { PrismaClient, Prisma, EstadoValor, CoactivoExp, ValorCab } from '@prisma/client';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

export interface TransferenciaInput {
  valorId: number;
  ejecutorId: number;
  auxiliarId: number;
  tipoGestionId?: number;
  usuarioId: number;
}

export interface TransferenciaResultado {
  expediente: CoactivoExp;
  valor: ValorCab;
}

export async function transferirValor(
  input: TransferenciaInput,
  tx: PrismaClient
): Promise<TransferenciaResultado> {
  const valor = await tx.valorCab.findUnique({
    where: { id: input.valorId },
    include: {
      detalles: {
        include: {
          cuentaCorriente: {
            include: {
              tributo: true,
            },
          },
        },
      },
      expedientes: true,
    },
  });

  if (!valor) {
    throw new NotFoundException('Valor no encontrado');
  }

  if (valor.expedientes.length > 0) {
    throw new ConflictException('Valor ya transferido a coactiva');
  }

  const [ejecutor, auxiliar] = await Promise.all([
    tx.ejecutores_coactivo.findUnique({ where: { id: input.ejecutorId } }),
    tx.auxiliares_coactivo.findUnique({ where: { id: input.auxiliarId } }),
  ]);

  if (!ejecutor || !ejecutor.activo) {
    throw new BadRequestException('Ejecutor no encontrado o inactivo');
  }

  if (!auxiliar || !auxiliar.activo) {
    throw new BadRequestException('Auxiliar no encontrado o inactivo');
  }

  // tipoGestionId es opcional, no validamos contra tabla inexistente

  const anioExp = new Date().getFullYear();
  const ultimo = await tx.coactivoExp.findFirst({
    where: { anioExpediente: anioExp },
    orderBy: { numExpediente: 'desc' },
    select: { numExpediente: true },
  });

  const correlativo = (ultimo ? parseInt(ultimo.numExpediente, 10) : 0) + 1;
  const numExpediente = correlativo.toString().padStart(6, '0');

  const expediente = await tx.coactivoExp.create({
    data: {
      anioExpediente: anioExp,
      numExpediente,
      valorId: input.valorId,
      contribuyenteId: valor.contribuyenteId,
      ejecutorId: input.ejecutorId,
      auxiliarId: input.auxiliarId,
      tipoGestionId: input.tipoGestionId,
      estado: EstadoValor.COACTIVO,
      fechaGeneracion: new Date(),
      creadoPorId: input.usuarioId,
      detalles: {
        create: valor.detalles.map((d) => ({
          cuentaCorrienteId: d.cuentaCorrienteId,
          descripcion: `${d.cuentaCorriente.tributo.codigo} - Cuota ${d.cuentaCorriente.cuota}`,
          monto: d.subtotal,
        })),
      },
    },
    include: {
      detalles: true,
      ejecutor: true,
      auxiliar: true,
    },
  });

  await tx.valorCab.update({
    where: { id: input.valorId },
    data: {
      estado: EstadoValor.COACTIVO,
      fechaNotificacion: new Date(),
      modificadoPorId: input.usuarioId,
    },
  });

  return { expediente, valor };
}

export async function transferirMasivo(
  input: { valorIds: number[]; ejecutorId: number; auxiliarId: number; tipoGestionId?: number; usuarioId: number },
  tx: PrismaClient
): Promise<{ exitosos: TransferenciaResultado[]; fallidos: { valorId: number; error: string }[] }> {
  const exitosos: TransferenciaResultado[] = [];
  const fallidos: { valorId: number; error: string }[] = [];

  for (const valorId of input.valorIds) {
    try {
      const resultado = await transferirValor(
        {
          valorId,
          ejecutorId: input.ejecutorId,
          auxiliarId: input.auxiliarId,
          tipoGestionId: input.tipoGestionId,
          usuarioId: input.usuarioId,
        },
        tx
      );
      exitosos.push(resultado);
    } catch (error) {
      fallidos.push({
        valorId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return { exitosos, fallidos };
}

export async function getValoresTransferibles(
  tx: PrismaClient,
  filtros: {
    anio?: number;
    tipo?: string;
    contribuyente?: string;
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    memorandumId?: number;
    page: number;
    limit: number;
  }
): Promise<{ data: ValorCab[]; total: number; page: number; limit: number }> {
  const where: Prisma.ValorCabWhereInput = {
    expedientes: {
      none: {},
    },
    OR: [
      { estado: EstadoValor.COACTIVO },
      {
        estado: EstadoValor.EMITIDO,
        fechaNotificacion: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    ],
  };

  if (filtros.memorandumId) {
    where.memorandumId = filtros.memorandumId;
  }

  if (filtros.anio) {
    where.anio = filtros.anio;
  }

  if (filtros.tipo) {
    where.tipo = filtros.tipo as any;
  }

  if (filtros.contribuyente) {
    where.OR = [
      { contribuyente: { numDoc: { contains: filtros.contribuyente } } },
      { contribuyente: { nombreCompleto: { contains: filtros.contribuyente, mode: 'insensitive' } } },
      { contribuyente: { codigoLegacy: { contains: filtros.contribuyente } } },
    ];
  }

  if (filtros.estado) {
    where.estado = filtros.estado as EstadoValor;
  }

  if (filtros.fechaDesde || filtros.fechaHasta) {
    where.fechaEmision = {};
    if (filtros.fechaDesde) {
      (where.fechaEmision as any).gte = new Date(filtros.fechaDesde);
    }
    if (filtros.fechaHasta) {
      (where.fechaEmision as any).lte = new Date(filtros.fechaHasta);
    }
  }

  const [data, total] = await Promise.all([
    tx.valorCab.findMany({
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
    tx.valorCab.count({ where }),
  ]);

  return { data, total, page: filtros.page, limit: filtros.limit };
}

export async function getValorDetalle(
  tx: PrismaClient,
  valorId: number
): Promise<ValorCab | null> {
  return tx.valorCab.findUnique({
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
          ejecutores_coactivo: true,
          auxiliares_coactivo: true,
        },
      },
    },
  });
}

export async function getEjecutoresActivos(tx: PrismaClient) {
  return tx.ejecutores_coactivo.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function getAuxiliaresActivos(tx: PrismaClient) {
  return tx.auxiliares_coactivo.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function getTiposGestionActivos(tx: PrismaClient) {
  return tx.tipos_gestion_coactiva.findMany({
    where: { activo: true },
    orderBy: { descripcion: 'asc' },
  });
}