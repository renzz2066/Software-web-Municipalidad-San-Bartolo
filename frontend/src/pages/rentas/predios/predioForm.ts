// Estado y validación del formulario de ubicación, terreno y construcción de un predio
// (lo comparten la DJ y la ficha de inspección; los campos están en DatosPredioCampos.tsx).

export interface PisoForm {
  nivel: string
  anioConstruccion: string
  clasificacion: string
  material: string
  estadoConservacion: string
  categorias: string
  areaConstruida: string
}

export interface InstalacionForm {
  descripcion: string
  unidad: string
  cantidad: string
}

export interface DatosForm {
  viaId: string
  urbanizacionId: string
  zonaId: string
  numero: string
  manzana: string
  lote: string
  referencia: string
  codigoCatastro: string
  areaTerreno: string
  usoPredio: string
}

export const DATOS_VACIOS: DatosForm = {
  viaId: '',
  urbanizacionId: '',
  zonaId: '',
  numero: '',
  manzana: '',
  lote: '',
  referencia: '',
  codigoCatastro: '',
  areaTerreno: '',
  usoPredio: '',
}

export const PISO_VACIO: PisoForm = {
  nivel: '',
  anioConstruccion: '',
  clasificacion: 'CASA_HABITACION',
  material: 'LADRILLO',
  estadoConservacion: 'BUENO',
  categorias: '',
  areaConstruida: '',
}

export const CLASE =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))

type NumTexto = number | string | null | undefined

// Lo que trae el predio actual (GET /predios/:id) o una ficha guardada (mismos campos que la DJ).
export interface PredioEditable {
  viaId: NumTexto
  urbanizacionId: NumTexto
  zonaId: NumTexto
  numero?: string | null
  manzana?: string | null
  lote?: string | null
  referencia?: string | null
  codigoCatastro?: string | null
  areaTerreno: NumTexto
  usoPredio?: string | null
  pisos: {
    nivel: string
    anioConstruccion?: NumTexto
    clasificacion?: string | null
    material?: string | null
    estadoConservacion?: string | null
    categorias?: string | null
    areaConstruida: NumTexto
  }[]
  otrasInstalaciones: { descripcion: string; unidad?: string | null; cantidad?: NumTexto }[]
}

export function formDesdePredio(p: PredioEditable) {
  return {
    datos: {
      viaId: s(p.viaId),
      urbanizacionId: s(p.urbanizacionId),
      zonaId: s(p.zonaId),
      numero: s(p.numero),
      manzana: s(p.manzana),
      lote: s(p.lote),
      referencia: s(p.referencia),
      codigoCatastro: s(p.codigoCatastro),
      areaTerreno: s(p.areaTerreno),
      usoPredio: s(p.usoPredio),
    },
    pisos: p.pisos.map((x) => ({
      nivel: x.nivel,
      anioConstruccion: s(x.anioConstruccion),
      clasificacion: s(x.clasificacion),
      material: s(x.material),
      estadoConservacion: s(x.estadoConservacion),
      categorias: s(x.categorias),
      areaConstruida: s(x.areaConstruida),
    })),
    instalaciones: p.otrasInstalaciones.map((o) => ({ descripcion: o.descripcion, unidad: s(o.unidad), cantidad: s(o.cantidad) })),
  }
}

// La ficha guardada viene con `predio` anidado (como el cuerpo de la DJ).
export const predioDeFicha = (f: { predio: Omit<PredioEditable, 'pisos' | 'otrasInstalaciones'>; pisos: PredioEditable['pisos']; otrasInstalaciones: PredioEditable['otrasInstalaciones'] }): PredioEditable => ({
  ...f.predio,
  pisos: f.pisos,
  otrasInstalaciones: f.otrasInstalaciones,
})

export function errorConstruccion(datos: DatosForm, pisos: PisoForm[]): string | null {
  if (!datos.viaId) return 'Selecciona la vía del predio'
  if (!(Number(datos.areaTerreno) > 0)) return 'El área de terreno debe ser mayor que 0'
  if (!datos.usoPredio.trim()) return 'Indica el uso del predio'
  for (const [i, p] of pisos.entries()) {
    if (!p.nivel.trim()) return `Piso ${i + 1}: indica el nivel`
    if (!(Number(p.areaConstruida) > 0)) return `Piso ${i + 1}: el área debe ser mayor que 0`
    if (!/^[A-I-]{7}$/.test(p.categorias.toUpperCase())) return `Piso ${i + 1}: las categorías son 7 letras A-I o "-"`
  }
  return null
}

// Cuerpo `predio`, `pisos` y `otrasInstalaciones` como lo esperan la DJ y la ficha.
export function payloadConstruccion(datos: DatosForm, pisos: PisoForm[], instalaciones: InstalacionForm[]) {
  const opt = (x: string) => (x.trim() ? x.trim() : undefined)
  const optNum = (x: string) => (x.trim() ? Number(x) : null)
  return {
    predio: {
      viaId: Number(datos.viaId),
      urbanizacionId: optNum(datos.urbanizacionId),
      zonaId: optNum(datos.zonaId),
      numero: opt(datos.numero),
      manzana: opt(datos.manzana),
      lote: opt(datos.lote),
      referencia: opt(datos.referencia),
      codigoCatastro: opt(datos.codigoCatastro),
      areaTerreno: Number(datos.areaTerreno),
      usoPredio: datos.usoPredio.trim(),
    },
    pisos: pisos.map((p) => ({
      nivel: p.nivel.trim(),
      anioConstruccion: optNum(p.anioConstruccion),
      clasificacion: p.clasificacion,
      material: p.material,
      estadoConservacion: p.estadoConservacion,
      categorias: p.categorias.toUpperCase(),
      areaConstruida: Number(p.areaConstruida),
    })),
    otrasInstalaciones: instalaciones
      .filter((o) => o.descripcion.trim())
      .map((o) => ({ descripcion: o.descripcion.trim(), unidad: opt(o.unidad), cantidad: o.cantidad ? Number(o.cantidad) : undefined })),
  }
}
