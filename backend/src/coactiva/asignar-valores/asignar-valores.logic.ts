import { PrismaClient } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

export interface AsignarValoresInput {
  valorIds: number[];
  auxiliarId: number;
  usuarioId: number;
}

export interface AsignarValoresResultado {
  exitosos: number;
  fallidos: { valorId: number; error: string }[];
}

export async function getMemorandumsActivos(tx: PrismaClient) {
  return tx.memorandums_coactiva.findMany({
    where: { activo: true },
    orderBy: [{ anio: 'desc' }, { numero: 'asc' }],
  });
}

export async function getAuxiliaresActivos(tx: PrismaClient) {
  return tx.auxiliares_coactivo.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function getValoresByMemorandum(tx: PrismaClient, memorandumId: number) {
  const memorandum = await tx.memorandums_coactiva.findUnique({
    where: { id: memorandumId },
  });

  if (!memorandum) {
    throw new NotFoundException('Memorándum no encontrado');
  }

  return tx.valorCab.findMany({
    where: { memorandumId },
    include: {
      contribuyente: {
        select: { id: true, numDoc: true, nombreCompleto: true },
      },
      auxiliarAsignado: {
        select: { id: true, codigo: true, nombre: true },
      },
    },
    orderBy: { id: 'asc' },
  });
}

export async function asignarValores(
  input: AsignarValoresInput,
  tx: PrismaClient
): Promise<AsignarValoresResultado> {
  const auxiliar = await tx.auxiliares_coactivo.findUnique({
    where: { id: input.auxiliarId },
  });

  if (!auxiliar || !auxiliar.activo) {
    throw new BadRequestException('Auxiliar no encontrado o inactivo');
  }

  const exitosos: number[] = [];
  const fallidos: { valorId: number; error: string }[] = [];

  for (const valorId of input.valorIds) {
    try {
      const valor = await tx.valorCab.findUnique({ where: { id: valorId } });

      if (!valor) {
        fallidos.push({ valorId, error: 'Valor no encontrado' });
        continue;
      }

      await tx.valorCab.update({
        where: { id: valorId },
        data: {
          auxiliarAsignadoId: input.auxiliarId,
          modificadoPorId: input.usuarioId,
        },
      });

      exitosos.push(valorId);
    } catch (error) {
      fallidos.push({
        valorId,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return {
    exitosos: exitosos.length,
    fallidos,
  };
}
