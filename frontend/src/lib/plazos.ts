// Réplica exacta de `backend/src/rentas/valores/plazos.ts` (specs/utilitarios-v1.md, U4).
// Los vectores golden de `plazos.spec.ts` se repiten en `plazos.test.ts`.
// Día hábil = lunes a viernes que no está en `feriados`.
const DIA_MS = 86_400_000

// El calendario no trabaja rangos mayores: evita un bucle infinito con fechas mal escritas.
const MAX_DIAS = 3660 // 10 años

export const masDias = (f: string, n: number) => new Date(Date.parse(f) + n * DIA_MS).toISOString().slice(0, 10)

export function esHabil(fecha: string, feriados: ReadonlySet<string>): boolean {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay()
  return dia !== 0 && dia !== 6 && !feriados.has(fecha)
}

// Día hábil siguiente (estrictamente posterior) a `fecha`.
export function siguienteHabil(fecha: string, feriados: ReadonlySet<string>): string {
  let f = masDias(fecha, 1)
  while (!esHabil(f, feriados)) f = masDias(f, 1)
  return f
}

// n-ésimo día hábil contando desde el día hábil siguiente a `fecha` (que es el día 1).
export function sumarHabiles(fecha: string, n: number, feriados: ReadonlySet<string>): string {
  let f = fecha
  for (let i = 0; i < n; i++) f = siguienteHabil(f, feriados)
  return f
}

// Días hábiles en el intervalo (desde, hasta]: cuenta desde el día siguiente a `desde`,
// igual que cuenta `sumarHabiles`. Devuelve 0 si `hasta` no es posterior.
export function diasHabilesEntre(desde: string, hasta: string, feriados: ReadonlySet<string>): number {
  if (hasta <= desde) return 0
  let n = 0
  let f = masDias(desde, 1)
  for (let i = 0; f <= hasta; i++) {
    if (i >= MAX_DIAS) throw new Error('El rango de fechas no puede superar 10 años')
    if (esHabil(f, feriados)) n++
    f = masDias(f, 1)
  }
  return n
}
