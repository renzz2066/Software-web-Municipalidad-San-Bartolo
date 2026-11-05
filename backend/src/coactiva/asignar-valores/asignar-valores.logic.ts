import { PrismaClient } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { idsUnicos, motivoNoAsignable } from '../coactiva.reglas.js';

export interface AsignarValoresInput {
  valorIds: number[];
  auxiliarId: number;
}

export interface AsignarValoresResultado {
  exitosos: number;
  fallidos: { valorId: number; error: string }[];
}

export async function getMemorandumsActivos(tx: PrismaClient) {
  return tx.memorandumCoactiva.findMany({
    where: { activo: true },
    orderBy: [{ anio: 'desc' }, { numero: 'asc' }],
  });
}

export async function getAuxiliaresActivos(tx: PrismaClient) {
  return tx.auxiliarCoactivo.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function getValoresByMemorandum(tx: PrismaClient, memorandumId: number) {
  const memorandum = await tx.memorandumCoactiva.findUnique({
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
  const auxiliar = await tx.auxiliarCoactivo.findUnique({
    where: { id: input.auxiliarId },
  });

  if (!auxiliar || !auxiliar.activo) {
    throw new BadRequestException('Auxiliar no encontrado o inactivo');
  }

  const exitosos: number[] = [];
  const fallidos: { valorId: number; error: string }[] = [];

  for (const valorId of idsUnicos(input.valorIds)) {
    try {
      const valor = await tx.valorCab.findUnique({
        where: { id: valorId },
        select: { estado: true, _count: { select: { expedientes: true } } },
      });
      const motivo = motivoNoAsignable(valor && { estado: valor.estado, expedientes: valor._count.expedientes });
      if (motivo) {
        fallidos.push({ valorId, error: motivo });
        continue;
      }

      // modificadoPorId lo fija el trigger de auditoría (skills/backend-db.md, 6).
      await tx.valorCab.update({
        where: { id: valorId },
        data: { auxiliarAsignadoId: input.auxiliarId },
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
