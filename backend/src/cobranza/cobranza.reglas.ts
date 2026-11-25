import { EstadoGestionCobranza } from '@prisma/client';

// Reglas de la gestión de cobranza (specs/prediccion-cobranza-v1.md, P6). Puras.

// Estados que exigen observación: sin ella el siguiente gestor no sabe qué se pactó
// ni dónde se buscó al contribuyente.
const REQUIEREN_OBSERVACION: EstadoGestionCobranza[] = [
  EstadoGestionCobranza.COMPROMISO,
  EstadoGestionCobranza.NO_UBICADO,
];

export function motivoGestionInvalida(estado: EstadoGestionCobranza, observacion?: string | null): string | null {
  if (REQUIEREN_OBSERVACION.includes(estado) && !observacion?.trim()) {
    return estado === EstadoGestionCobranza.COMPROMISO
      ? 'Indica en la observación la fecha y el monto del compromiso de pago.'
      : 'Indica en la observación dónde y cuándo se buscó al contribuyente.';
  }
  return null;
}

/** Fracción de la deuda esperada que concentra el primer `fraccion` de la lista (ya ordenada). */
export function concentracionTop(deudasOrdenadas: number[], fraccion = 0.2): number {
  const total = deudasOrdenadas.reduce((s, d) => s + d, 0);
  if (total <= 0) return 0;
  const n = Math.ceil(deudasOrdenadas.length * fraccion);
  return deudasOrdenadas.slice(0, n).reduce((s, d) => s + d, 0) / total;
}
