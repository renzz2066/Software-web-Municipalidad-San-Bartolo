// Reglas puras de la declaración jurada de predios (specs/rentas-nucleo-v1.md, C3).

export const MOTIVOS_DJ = ['INSCRIPCION', 'COMPRA', 'VENTA', 'RECTIFICACION', 'BAJA'] as const;
export type Motivo = (typeof MOTIVOS_DJ)[number];

export interface CondominoDJ {
  contribuyenteId: number;
  porcentaje: number;
}

export interface PisoDJ {
  nivel: string;
  anioConstruccion?: number | null;
  areaConstruida: number;
}

export interface DeclaracionDJ {
  motivo: Motivo;
  anio: number;
  fecha: string; // AAAA-MM-DD
  fechaHecho?: string | null; // adquisición o inscripción (D.L. 776 art. 14): inicia el plazo para declarar
  declaranteId: number;
  predioId?: number | null;
  condominos: CondominoDJ[];
  pisos: PisoDJ[];
}

export interface ContextoDJ {
  hoy: string; // AAAA-MM-DD
  titularesActuales: number[]; // condóminos activos antes de la DJ (vacío en inscripción)
}

const centavos = (n: number) => Math.round(n * 100);

export function validarDeclaracion(dj: DeclaracionDJ, ctx: ContextoDJ): string | null {
  if (dj.fecha > ctx.hoy) {
    return 'La fecha de la declaración no puede ser futura';
  }
  if (dj.fechaHecho && dj.fechaHecho > dj.fecha) {
    return 'La fecha de adquisición no puede ser posterior a la presentación de la declaración';
  }
  if (dj.motivo === 'INSCRIPCION' && dj.predioId) {
    return 'La inscripción crea un predio nuevo: no indiques predio';
  }
  if (dj.motivo !== 'INSCRIPCION' && !dj.predioId) {
    return 'Indica el predio que se declara';
  }
  if (dj.motivo !== 'INSCRIPCION' && !ctx.titularesActuales.includes(dj.declaranteId)) {
    // Compra la declara el comprador, que aún no es titular.
    if (dj.motivo !== 'COMPRA') {
      return 'El declarante no es titular actual del predio';
    }
  }
  if (dj.motivo === 'BAJA') {
    return null;
  }

  const error = validarCondominos(dj.condominos);
  if (error) return error;

  const enCondominos = dj.condominos.some((c) => c.contribuyenteId === dj.declaranteId);
  if (dj.motivo === 'VENTA' && enCondominos) {
    return 'En una venta el declarante deja de ser titular: quítalo de los condóminos';
  }
  if (dj.motivo !== 'VENTA' && !enCondominos) {
    return 'El declarante debe figurar entre los condóminos';
  }
  return validarPisos(dj.pisos, dj.anio);
}

export function validarCondominos(condominos: CondominoDJ[]): string | null {
  if (condominos.length === 0) {
    return 'El predio debe tener al menos un titular';
  }
  const ids = new Set<number>();
  let suma = 0;
  for (const c of condominos) {
    if (ids.has(c.contribuyenteId)) return 'Un contribuyente figura dos veces como condómino';
    ids.add(c.contribuyenteId);
    if (!(c.porcentaje > 0 && c.porcentaje <= 100)) return 'Cada porcentaje debe estar entre 0 y 100';
    suma += centavos(c.porcentaje);
  }
  if (suma !== 10000) {
    return `Los porcentajes deben sumar 100% (suman ${(suma / 100).toFixed(2)}%)`;
  }
  return null;
}

export function validarPisos(pisos: PisoDJ[], anio: number): string | null {
  const niveles = new Set<string>();
  for (const p of pisos) {
    const nivel = p.nivel.trim().toUpperCase();
    if (!nivel) return 'Cada piso debe indicar su nivel';
    if (niveles.has(nivel)) return `El nivel ${nivel} está repetido`;
    niveles.add(nivel);
    if (!(p.areaConstruida > 0)) return `El nivel ${nivel} debe tener área construida mayor que 0`;
    if (p.anioConstruccion != null && (p.anioConstruccion < 1900 || p.anioConstruccion > anio)) {
      return `El año de construcción del nivel ${nivel} debe estar entre 1900 y ${anio}`;
    }
  }
  return null;
}
