// Prórrogas de presentación de DJ (specs/rentas-nucleo-v2.md, Fase 7; J16, J17). Lógica pura.
export type EstadoProrroga = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'ANULADA';

export const ROLES_SUPERVISION = ['SUPERVISOR', 'ADMIN'];
const MINIMO_TEXTO = 10;

export interface NuevaProrroga {
  general: boolean; // sin persona: por ordenanza, para todos
  anio: number;
  fechaLimite: string;
  fechaSolicitud: string;
}

export function errorRegistrarProrroga(p: NuevaProrroga, rol: string, hoy: string, permitido: boolean): string | null {
  if (!permitido) return 'La municipalidad no registra prórrogas de presentación (regla dj.prorrogaPresentacion en Maestros)';
  if (p.general && !ROLES_SUPERVISION.includes(rol)) return 'Una prórroga general (por ordenanza) la registra un supervisor';
  if (p.fechaSolicitud > hoy) return 'La fecha de la solicitud no puede ser futura';
  if (p.fechaLimite <= p.fechaSolicitud) return 'La nueva fecha límite debe ser posterior a la solicitud';
  const anioLimite = Number(p.fechaLimite.slice(0, 4));
  if (anioLimite < p.anio || anioLimite > p.anio + 1) return `La nueva fecha límite debe caer en ${p.anio} o ${p.anio + 1}`;
  return null;
}

// J17: la resuelve un supervisor distinto de quien la registró, con justificación.
export function errorResolverProrroga(
  p: { estado: EstadoProrroga; creadoPorId: number | null },
  actor: { id: number; rol: string },
  justificacion: string,
): string | null {
  if (!ROLES_SUPERVISION.includes(actor.rol)) return 'Solo un supervisor resuelve una prórroga';
  if (p.estado !== 'SOLICITADA') return 'Solo se resuelve una prórroga solicitada';
  if (p.creadoPorId !== null && p.creadoPorId === actor.id) return 'Quien registró la prórroga no puede resolverla: la resuelve otro supervisor';
  if (justificacion.trim().length < MINIMO_TEXTO) return `Justifica la decisión (mínimo ${MINIMO_TEXTO} caracteres)`;
  return null;
}

// Se anula con motivo (no se borra). Las multas ya emitidas no cambian.
export function errorAnularProrroga(estado: EstadoProrroga, rol: string, motivo: string): string | null {
  if (!ROLES_SUPERVISION.includes(rol)) return 'Solo un supervisor anula una prórroga';
  if (estado === 'ANULADA') return 'La prórroga ya está anulada';
  if (estado === 'RECHAZADA') return 'Una prórroga rechazada no se anula';
  if (motivo.trim().length < MINIMO_TEXTO) return `Explica por qué se anula (mínimo ${MINIMO_TEXTO} caracteres)`;
  return null;
}
