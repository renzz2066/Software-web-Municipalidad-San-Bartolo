import { Prisma, TipoTasaMora } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { Tasa } from './liquidacion.js';

export const iso = (d: Date) => d.toISOString().slice(0, 10);

// Series de IPM (reajuste) y TIM (mora) para liquidar(); las comparten estado de cuenta y valores.
export async function cargarTasas(db: PrismaService | Prisma.TransactionClient): Promise<{ ipm: Tasa[]; tim: Tasa[] }> {
  const tasas = await db.tasaMora.findMany({ orderBy: { vigenciaDesde: 'asc' } });
  const serie = (tipo: TipoTasaMora): Tasa[] =>
    tasas.filter((t) => t.tipo === tipo).map((t) => ({ vigenciaDesde: iso(t.vigenciaDesde), valor: t.valor }));
  return { ipm: serie(TipoTasaMora.IPM), tim: serie(TipoTasaMora.TIM) };
}
