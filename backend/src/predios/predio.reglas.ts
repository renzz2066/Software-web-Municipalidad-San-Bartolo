// Predio maestro (specs/rentas-nucleo-v2.md, Fase 3; reglas R01–R06). Lógica pura.

export const LADOS = ['Frente', 'Derecha', 'Izquierda', 'Fondo'] as const;
export type Lado = (typeof LADOS)[number];

// R05: lo que se asigna solo cuando nadie lo eligió. Las demás condiciones (poseedor, sociedad
// conyugal…) las pone una persona y la DJ de v1 no las pisa.
export const CONDICIONES_AUTOMATICAS = ['PROPIETARIO_UNICO', 'CONDOMINIO', 'SUCESION_INDIVISA'];

export function condicionPorDefecto(titulares: number, esSucesion: boolean): string {
  if (esSucesion) return 'SUCESION_INDIVISA';
  return titulares > 1 ? 'CONDOMINIO' : 'PROPIETARIO_UNICO';
}

// R01: un lindero lleva metros mayores que 0, colindante, o ambos; nunca metros negativos.
export function errorLinderos(linderos: { lado: Lado; metros: number | null; colindante: string | null }[]): string | null {
  for (const l of linderos) {
    if (l.metros !== null && (!Number.isFinite(l.metros) || l.metros <= 0)) return `El lindero ${l.lado.toLowerCase()} debe medir más de 0 m`;
  }
  return null;
}

// ---- Personas asociadas por año (C4) ----

export interface Titularidad {
  contribuyenteId: number;
  fechaAdquisicion: string | null; // AAAA-MM-DD
  fechaFin: string | null;
  estado: 'ACTIVO' | 'INACTIVO' | 'BAJA';
}

export interface Asociacion {
  // Fue titular en algún momento del año.
  asociado: boolean;
  // Era titular al 1 de enero: es el contribuyente del impuesto de ese año (TUO LTM art. 10; J10).
  contribuyenteDelAnio: boolean;
  // Dejó de ser titular pero no se sabe cuándo (dato convertido de v1).
  finDesconocido: boolean;
}

const anioDe = (fecha: string | null) => (fecha ? Number(fecha.slice(0, 4)) : null);

// Una compra en el año N afecta desde N+1 (J10) y una venta en N deja al vendedor como contribuyente de N.
export function asociacionEnAnio(t: Titularidad, anio: number): Asociacion {
  const desde = anioDe(t.fechaAdquisicion);
  const finDesconocido = t.estado !== 'ACTIVO' && !t.fechaFin;
  const hasta = anioDe(t.fechaFin);
  const empezo = desde === null || desde <= anio;
  const seguia = finDesconocido || hasta === null || hasta >= anio;
  return {
    asociado: empezo && seguia,
    contribuyenteDelAnio: (desde === null || desde < anio) && !finDesconocido && (hasta === null || hasta >= anio),
    finDesconocido,
  };
}

// ---- Beneficio del predio (R06) ----

export interface Periodo {
  anioDesde: number;
  anioHasta: number | null;
}

// El periodo del titular cubre todo el del predio.
export function cubre(titular: Periodo, predio: Periodo): boolean {
  if (titular.anioDesde > predio.anioDesde) return false;
  if (titular.anioHasta === null) return true;
  return predio.anioHasta !== null && titular.anioHasta >= predio.anioHasta;
}

export function seSolapan(a: Periodo, b: Periodo): boolean {
  return a.anioDesde <= (b.anioHasta ?? Infinity) && b.anioDesde <= (a.anioHasta ?? Infinity);
}

export interface TitularInafecto {
  nombre: string;
  inafectaciones: Periodo[]; // sus resoluciones vigentes de inafectación (P14)
}

// R06: solo inafectación o exoneración (la deducción es de la persona, P15). Un predio inafecto exige
// que todos sus titulares vigentes sean inafectos en esos años.
export function errorBeneficioPredio(
  b: { regimen: string | undefined; porcentaje: number; nombre: string } & Periodo,
  titulares: TitularInafecto[],
): string | null {
  if (b.regimen !== 'INAFECTACION' && b.regimen !== 'EXONERACION') {
    return `${b.nombre}: no es una inafectación ni una exoneración del predio`;
  }
  if (b.anioHasta !== null && b.anioHasta < b.anioDesde) return 'El año final no puede ser menor que el inicial';
  if (!(b.porcentaje > 0 && b.porcentaje <= 100)) return 'El porcentaje debe estar entre 0 y 100';
  if (b.regimen === 'INAFECTACION') {
    if (b.porcentaje !== 100) return 'La inafectación es del 100%';
    if (titulares.length === 0) return 'El predio no tiene titulares vigentes';
    const falta = titulares.find((t) => !t.inafectaciones.some((p) => cubre(p, b)));
    if (falta) return `Un predio inafecto exige propietario inafecto: ${falta.nombre} no tiene una resolución de inafectación para esos años`;
  }
  return null;
}
