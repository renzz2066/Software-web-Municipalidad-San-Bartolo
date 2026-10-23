// Reglas puras de los maestros de Rentas (specs/rentas-nucleo-v1.md, C4).
// Sin Prisma: se prueban con vitest y las usa MaestrosService antes de grabar.

export const ANIO_MIN = 2000;
export const ANIO_MAX = 2100;

export interface TramoEscala {
  tramo: number;
  desdeUit: number;
  hastaUit?: number | null;
  tasa: number;
}

export function anioValido(anio: number): boolean {
  return Number.isInteger(anio) && anio >= ANIO_MIN && anio <= ANIO_MAX;
}

// La escala debe cubrir de 0 UIT a infinito sin huecos ni solapes:
// tramos 1..n, cada "desde" = "hasta" del anterior, solo el último sin tope.
export function validarEscala(tramos: TramoEscala[]): string | null {
  if (tramos.length === 0) {
    return 'La escala debe tener al menos un tramo';
  }
  const ordenados = [...tramos].sort((a, b) => a.tramo - b.tramo);
  for (let i = 0; i < ordenados.length; i++) {
    const t = ordenados[i];
    const ultimo = i === ordenados.length - 1;
    if (t.tramo !== i + 1) {
      return 'Los tramos deben numerarse 1, 2, 3… sin saltos';
    }
    if (i === 0 && t.desdeUit !== 0) {
      return 'El tramo 1 debe empezar en 0 UIT';
    }
    if (i > 0 && t.desdeUit !== ordenados[i - 1].hastaUit) {
      return `El tramo ${t.tramo} debe empezar donde termina el tramo ${t.tramo - 1}`;
    }
    const sinTope = t.hastaUit === null || t.hastaUit === undefined;
    if (ultimo && !sinTope) {
      return 'El último tramo no debe tener tope (sin "hasta")';
    }
    if (!ultimo && sinTope) {
      return `El tramo ${t.tramo} debe tener tope`;
    }
    if (!sinTope && (t.hastaUit as number) <= t.desdeUit) {
      return `En el tramo ${t.tramo}, "hasta" debe ser mayor que "desde"`;
    }
  }
  return null;
}

// Devuelve el índice del primer ítem cuya clave ya apareció antes, o -1.
// La clave se arma a mano para que null (= "todos") cuente como valor.
export function indiceDuplicado<T>(items: T[], clave: (item: T) => string): number {
  const vistos = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const k = clave(items[i]);
    if (vistos.has(k)) {
      return i;
    }
    vistos.add(k);
  }
  return -1;
}
