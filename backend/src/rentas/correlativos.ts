import { Prisma } from '@prisma/client';

// Numeración correlativa por serie y año (specs/rentas-valores-v1.md, decisión 1).
// INSERT ... ON CONFLICT DO UPDATE bloquea la fila (serie, anio) hasta el commit: dos
// emisiones simultáneas nunca reciben el mismo número, y si la transacción se revierte
// el número vuelve a quedar libre (sin huecos).

export type SerieCorrelativo = 'OP' | 'RD' | 'CONV' | 'MEMO';

const DIGITOS = 6;

export function formatearCorrelativo(n: number): string {
  return String(n).padStart(DIGITOS, '0');
}

// Números asignados cuando el último pasó a ser `ultimo` tras reservar `cantidad`.
export function rangoCorrelativos(ultimo: number, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => formatearCorrelativo(ultimo - cantidad + 1 + i));
}

// Reserva `cantidad` números en un solo viaje a la BD (emisión masiva). Usar dentro de $transaction.
export async function reservarCorrelativos(
  tx: Prisma.TransactionClient,
  serie: SerieCorrelativo,
  anio: number,
  cantidad = 1,
): Promise<string[]> {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error('La cantidad de correlativos debe ser un entero positivo');
  }
  const [fila] = await tx.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO correlativos (serie, anio, ultimo) VALUES (${serie}, ${anio}, ${cantidad})
    ON CONFLICT (serie, anio) DO UPDATE SET ultimo = correlativos.ultimo + ${cantidad}
    RETURNING ultimo`;
  return rangoCorrelativos(fila.ultimo, cantidad);
}
