// Plazos de valores en días hábiles (specs/rentas-valores-v1.md, V4). Lógica pura, fechas AAAA-MM-DD.
// - La notificación surte efecto el día hábil siguiente a su recepción (Código Tributario art. 106).
// - OP: exigible desde ese día (art. 115 d).
// - RD: 20 días hábiles para reclamar (art. 137); exigible el día hábil siguiente al vencimiento (art. 115 a).
// Día hábil = lunes a viernes que no está en `feriados`.
import type { TipoValor } from '@prisma/client';

export const PLAZO_RECLAMO_RD = 20;

const DIA_MS = 86_400_000;

export const masDias = (f: string, n: number) => new Date(Date.parse(f) + n * DIA_MS).toISOString().slice(0, 10);

export function esHabil(fecha: string, feriados: ReadonlySet<string>): boolean {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return dia !== 0 && dia !== 6 && !feriados.has(fecha);
}

// Día hábil siguiente (estrictamente posterior) a `fecha`.
export function siguienteHabil(fecha: string, feriados: ReadonlySet<string>): string {
  let f = masDias(fecha, 1);
  while (!esHabil(f, feriados)) f = masDias(f, 1);
  return f;
}

// n-ésimo día hábil contando desde el día hábil siguiente a `fecha` (que es el día 1).
export function sumarHabiles(fecha: string, n: number, feriados: ReadonlySet<string>): string {
  let f = fecha;
  for (let i = 0; i < n; i++) f = siguienteHabil(f, feriados);
  return f;
}

export function fechaExigible(tipo: TipoValor, fechaNotificacion: string, feriados: ReadonlySet<string>): string {
  if (tipo === 'OP') return siguienteHabil(fechaNotificacion, feriados);
  return siguienteHabil(sumarHabiles(fechaNotificacion, PLAZO_RECLAMO_RD, feriados), feriados);
}
