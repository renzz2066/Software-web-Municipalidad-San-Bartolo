import { EstadoCuenta, Prisma, TipoTasaMora, TipoTributo } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { vencimientos } from '../calculo/motor.js';
import { liquidar, type Tasa } from './liquidacion.js';

export const iso = (d: Date) => d.toISOString().slice(0, 10);

// Series de IPM (reajuste) y TIM (mora) para liquidar(); las comparten estado de cuenta y valores.
export async function cargarTasas(db: PrismaService | Prisma.TransactionClient): Promise<{ ipm: Tasa[]; tim: Tasa[] }> {
  const tasas = await db.tasaMora.findMany({ orderBy: { vigenciaDesde: 'asc' } });
  const serie = (tipo: TipoTasaMora): Tasa[] =>
    tasas.filter((t) => t.tipo === tipo).map((t) => ({ vigenciaDesde: iso(t.vigenciaDesde), valor: t.valor }));
  return { ipm: serie(TipoTasaMora.IPM), tim: serie(TipoTasaMora.TIM) };
}

// Liquida una fila de cuenta corriente a `fecha` (mismas reglas que el estado de cuenta).
export function liquidarCuenta(
  c: {
    anioFiscal: number;
    cuota: number;
    importe: Prisma.Decimal;
    derechoEmision: Prisma.Decimal;
    fechaVencimiento: Date | null;
    estado: EstadoCuenta;
    tributo: { tipo: TipoTributo };
  },
  fecha: string,
  ipm: Tasa[],
  tim: Tasa[],
) {
  return liquidar(
    {
      esPredial: c.tributo.tipo === TipoTributo.PREDIAL,
      cuota: c.cuota,
      anio: c.anioFiscal,
      importe: c.importe,
      derechoEmision: c.derechoEmision,
      fechaVencimiento: c.fechaVencimiento ? iso(c.fechaVencimiento) : `${c.anioFiscal}-12-31`,
      vencimientoCuota1: vencimientos(c.anioFiscal)[0],
      generaMora: c.estado !== EstadoCuenta.FRACCIONADO,
    },
    fecha,
    ipm,
    tim,
  );
}
