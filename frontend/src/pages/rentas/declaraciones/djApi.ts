// DJ presentada (contrato: backend/src/declaraciones; specs/rentas-nucleo-v2.md, Fase 4; J01–J17).
import type { DireccionElegida } from '../direcciones/direccionesApi'
import { RUTA_BASE } from '../contribuyentes/tipos'

export const RUTA_DJ = `${RUTA_BASE}/declaraciones`

export type EstadoDj = 'PENDIENTE' | 'EN_REVISION' | 'LIQUIDADA' | 'ANULADA' | 'RECHAZADA'

export const ETIQUETA_ESTADO_DJ: Record<EstadoDj, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  LIQUIDADA: 'Liquidada',
  ANULADA: 'Anulada',
  RECHAZADA: 'Rechazada',
}

export const ESTILO_ESTADO_DJ: Record<EstadoDj, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-800',
  EN_REVISION: 'bg-amber-50 text-amber-800',
  LIQUIDADA: 'bg-emerald-50 text-emerald-800',
  ANULADA: 'bg-slate-100 text-slate-600',
  RECHAZADA: 'bg-slate-100 text-slate-600',
}

// Motivos que el sistema trata distinto (filas `sistema` del catálogo MOTIVO_DJ).
export const DESCARGOS = ['VENTA', 'BAJA']
export const CREAN_PREDIO = ['INSCRIPCION', 'COMPRA']
// J09 (Fase 7): sub-motivo de la DJ anual que objeta la actualización de valores.
export const SUB_MOTIVO_OBJECION = 'AN_OBJECION'

export interface DjResumen {
  id: number
  anio: number
  numero: number
  numeroTexto: string
  motivo: string
  subMotivo: string | null
  tipo: string
  estado: EstadoDj
  fechaPresentacion: string
  contribuyente: { id: number; tipoDoc: string; numDoc: string | null; nombreCompleto: string }
  _count: { anexos: number }
}

type Dec = string // Decimal de Prisma llega como texto

export interface NivelApi {
  nivel: string
  anioConstruccion: number | null
  mesConstruccion: number | null
  clasificacion: string
  material: string
  estadoConservacion: string
  categorias: string
  areaPropia: Dec
  areaComun: Dec | null
  participacion: Dec | null
}
export interface ObraApi {
  codigo: string | null // V05: código de la tabla de obras del año (null = valor declarado)
  descripcion: string
  unidad: string | null
  cantidad: Dec
  largo: Dec | null
  ancho: Dec | null
  alto: Dec | null
  anioConstruccion: number | null
  material: string | null
  estadoConservacion: string | null
  valorDeclarado: Dec | null
}
export interface UsoApi {
  uso: string
  subUso: string | null
  inquilino: string | null
  area: Dec
  frontis: Dec | null
  fechaInicio: string | null
  fechaFin: string | null
  predominante: boolean
}
export interface RusticoApi {
  categoria: string
  clasificacion: string | null
  hectareas: Dec
}
export interface AdquirienteApi {
  rol: string
  tipoPersona: 'NATURAL' | 'JURIDICA' | 'SUCESION'
  tipoDoc: string | null
  numDoc: string | null
  nombreCompleto: string
  direccion: string | null
  documentoTransferencia: string | null
  persona: { id: number; nombreCompleto: string } | null
}

export interface AnexoApi {
  id: number
  numero: number
  predioId: number
  predioNuevo: boolean
  predio: { id: number; nombre: string | null; tipo: 'URBANO' | 'RUSTICO'; codigoCatastro: string | null; estado: string; direccion: { id: number; direccion: string } | null }
  subMotivo: string | null
  condicion: string
  porcentaje: Dec
  fechaAdquisicion: string | null
  fechaDocumento: string | null
  fechaDescargo: string | null
  anioAfectacion: number
  fechaAfectacionArbitrios: string
  valorTransferencia: Dec | null
  moneda: string | null
  partidaRegistral: string | null
  areaTerreno: Dec
  areaComun: Dec | null
  numeroPisos: number | null
  observacion: string | null
  niveles: NivelApi[]
  obras: ObraApi[]
  usos: UsoApi[]
  rusticos: RusticoApi[]
  adquirientes: AdquirienteApi[]
}

export interface DjDetalle extends Omit<DjResumen, '_count'> {
  numeroFormulario: string | null
  folios: number | null
  observacion: string | null
  djPrevio: { id: number; numeroTexto: string } | null
  rectificadaPor: { id: number; numeroTexto: string; estado: EstadoDj }[]
  anuladaMotivo: string | null
  anuladaAt: string | null
  anuladaPor: { usuario: string; nombres: string; apellidos: string } | null
  creadoPor: { usuario: string; nombres: string; apellidos: string } | null
  creadoPorId: number | null
  createdAt: string
  // Fase 5: revisión (J14/J17), liquidación (C7) y plazo de presentación (J08).
  revisionVence: string | null
  revisionResueltaAt: string | null
  revisionJustificacion: string | null
  revisionResueltaPor: { usuario: string; nombres: string; apellidos: string } | null
  liquidadaAt: string | null
  liquidadaPor: { usuario: string; nombres: string; apellidos: string } | null
  multaDescartada: string | null
  multas: { id: number; anio: number; numero: string; estado: string }[]
  plazo: {
    hecho: string | null
    vence: string
    venceOriginal: string
    prorroga: { id: number; fechaLimite: string } | null // J16
    cambio5Uit: boolean // J08: modificación de más de 5 UIT
    extemporanea: boolean
  } | null
  // Fase 7: cambio del autoavalúo de una modificación (5 UIT) y descargo de oficio del transferente.
  variacion: {
    anio: number
    hecho: string | null
    uit: string | null
    limite: string | null
    predios: { predioId: number; antes: string | null; despues: string | null; cambio: string | null }[]
    supera: boolean
  } | null
  generadaDesde: { id: number; numeroTexto: string; contribuyente: { nombreCompleto: string } } | null
  generadas: { id: number; numeroTexto: string; estado: EstadoDj; contribuyente: { nombreCompleto: string } }[]
  contribuyente: DjResumen['contribuyente'] & { estado: string }
  documentos: { tipo: string; numero: string | null; fecha: string | null; observacion: string | null }[]
  anexos: AnexoApi[]
}

// ---- Estado del formulario (todo texto, como los inputs) ----

export interface NivelForm {
  nivel: string
  anioConstruccion: string
  mesConstruccion: string
  clasificacion: string
  material: string
  estadoConservacion: string
  categorias: string
  areaPropia: string
  areaComun: string
  participacion: string
}
export interface ObraForm {
  codigo: string
  descripcion: string
  unidad: string
  cantidad: string
  largo: string
  ancho: string
  alto: string
  anioConstruccion: string
  material: string
  estadoConservacion: string
  valorDeclarado: string
}
export interface UsoForm {
  uso: string
  subUso: string
  inquilino: string
  area: string
  frontis: string
  fechaInicio: string
  fechaFin: string
  predominante: boolean
}
export interface RusticoForm {
  categoria: string
  clasificacion: string
  hectareas: string
}
export interface AdquirienteForm {
  rol: string
  tipoPersona: 'NATURAL' | 'JURIDICA' | 'SUCESION'
  tipoDoc: string
  numDoc: string
  nombreCompleto: string
  direccion: string
  documentoTransferencia: string
}
export interface PredioElegido {
  id: number
  etiqueta: string
  tipo: 'URBANO' | 'RUSTICO'
}
export interface PredioNuevoForm {
  tipo: 'URBANO' | 'RUSTICO'
  direccion: DireccionElegida | null
  codigoCatastro: string
  nombre: string
}
export interface AnexoForm {
  predio: PredioElegido | null
  nuevo: PredioNuevoForm | null
  subMotivo: string
  condicion: string
  porcentaje: string
  fechaAdquisicion: string
  fechaDocumento: string
  fechaDescargo: string
  anioAfectacion: string
  fechaAfectacionArbitrios: string
  valorTransferencia: string
  moneda: string
  partidaRegistral: string
  areaTerreno: string
  areaComun: string
  numeroPisos: string
  observacion: string
  niveles: NivelForm[]
  obras: ObraForm[]
  usos: UsoForm[]
  rusticos: RusticoForm[]
  adquirientes: AdquirienteForm[]
}
export interface DocumentoForm {
  tipo: string
  numero: string
  fecha: string
  observacion: string
}
export interface DjForm {
  contribuyente: { id: number; nombreCompleto: string; documento: string } | null
  motivo: string
  subMotivo: string
  numeroFormulario: string
  folios: string
  fechaPresentacion: string
  observacion: string
  documentos: DocumentoForm[]
  anexos: AnexoForm[]
}

export const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

export const NIVEL_VACIO: NivelForm = {
  nivel: '',
  anioConstruccion: '',
  mesConstruccion: '',
  clasificacion: 'CASA_HABITACION',
  material: 'LADRILLO',
  estadoConservacion: 'BUENO',
  categorias: '',
  areaPropia: '',
  areaComun: '',
  participacion: '',
}
export const OBRA_VACIA: ObraForm = {
  codigo: '',
  descripcion: '',
  unidad: '',
  cantidad: '',
  largo: '',
  ancho: '',
  alto: '',
  anioConstruccion: '',
  material: '',
  estadoConservacion: '',
  valorDeclarado: '',
}
export const USO_VACIO: UsoForm = { uso: 'CASA', subUso: '', inquilino: '', area: '', frontis: '', fechaInicio: '', fechaFin: '', predominante: false }
export const RUSTICO_VACIO: RusticoForm = { categoria: '', clasificacion: '', hectareas: '' }
export const ADQUIRIENTE_VACIO = (rol: string): AdquirienteForm => ({
  rol,
  tipoPersona: 'NATURAL',
  tipoDoc: 'DNI',
  numDoc: '',
  nombreCompleto: '',
  direccion: '',
  documentoTransferencia: '',
})

export const anexoVacio = (): AnexoForm => ({
  predio: null,
  nuevo: null,
  subMotivo: '',
  condicion: 'PROPIETARIO_UNICO',
  porcentaje: '100',
  fechaAdquisicion: '',
  fechaDocumento: '',
  fechaDescargo: '',
  anioAfectacion: '',
  fechaAfectacionArbitrios: '',
  valorTransferencia: '',
  moneda: '',
  partidaRegistral: '',
  areaTerreno: '',
  areaComun: '',
  numeroPisos: '',
  observacion: '',
  niveles: [],
  obras: [],
  usos: [{ ...USO_VACIO, predominante: true }],
  rusticos: [],
  adquirientes: [],
})

export const formVacio = (): DjForm => ({
  contribuyente: null,
  motivo: '',
  subMotivo: '',
  numeroFormulario: '',
  folios: '',
  fechaPresentacion: hoy(),
  observacion: '',
  documentos: [],
  anexos: [anexoVacio()],
})

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const f10 = (v: string | null) => (v ? v.slice(0, 10) : '')

export function desdeDetalle(d: DjDetalle): DjForm {
  return {
    contribuyente: { id: d.contribuyente.id, nombreCompleto: d.contribuyente.nombreCompleto, documento: d.contribuyente.numDoc ? `${d.contribuyente.tipoDoc} ${d.contribuyente.numDoc}` : 'Sin documento' },
    motivo: d.motivo,
    subMotivo: s(d.subMotivo),
    numeroFormulario: s(d.numeroFormulario),
    folios: s(d.folios),
    fechaPresentacion: f10(d.fechaPresentacion),
    observacion: s(d.observacion),
    documentos: d.documentos.map((x) => ({ tipo: x.tipo, numero: s(x.numero), fecha: f10(x.fecha), observacion: s(x.observacion) })),
    anexos: d.anexos.map((a) => ({
      predio: { id: a.predio.id, etiqueta: etiquetaPredio(a.predio), tipo: a.predio.tipo },
      nuevo: null,
      subMotivo: s(a.subMotivo),
      condicion: a.condicion,
      porcentaje: String(Number(a.porcentaje)),
      fechaAdquisicion: f10(a.fechaAdquisicion),
      fechaDocumento: f10(a.fechaDocumento),
      fechaDescargo: f10(a.fechaDescargo),
      anioAfectacion: String(a.anioAfectacion),
      fechaAfectacionArbitrios: f10(a.fechaAfectacionArbitrios),
      valorTransferencia: s(a.valorTransferencia),
      moneda: s(a.moneda),
      partidaRegistral: s(a.partidaRegistral),
      areaTerreno: String(Number(a.areaTerreno)),
      areaComun: s(a.areaComun),
      numeroPisos: s(a.numeroPisos),
      observacion: s(a.observacion),
      niveles: a.niveles.map((n) => ({
        nivel: n.nivel,
        anioConstruccion: s(n.anioConstruccion),
        mesConstruccion: s(n.mesConstruccion),
        clasificacion: n.clasificacion,
        material: n.material,
        estadoConservacion: n.estadoConservacion,
        categorias: n.categorias,
        areaPropia: String(Number(n.areaPropia)),
        areaComun: s(n.areaComun),
        participacion: s(n.participacion),
      })),
      obras: a.obras.map((o) => ({
        codigo: s(o.codigo),
        descripcion: o.descripcion,
        unidad: s(o.unidad),
        cantidad: String(Number(o.cantidad)),
        largo: s(o.largo),
        ancho: s(o.ancho),
        alto: s(o.alto),
        anioConstruccion: s(o.anioConstruccion),
        material: s(o.material),
        estadoConservacion: s(o.estadoConservacion),
        valorDeclarado: s(o.valorDeclarado),
      })),
      usos: a.usos.map((u) => ({
        uso: u.uso,
        subUso: s(u.subUso),
        inquilino: s(u.inquilino),
        area: String(Number(u.area)),
        frontis: s(u.frontis),
        fechaInicio: f10(u.fechaInicio),
        fechaFin: f10(u.fechaFin),
        predominante: u.predominante,
      })),
      rusticos: a.rusticos.map((r) => ({ categoria: r.categoria, clasificacion: s(r.clasificacion), hectareas: String(Number(r.hectareas)) })),
      adquirientes: a.adquirientes.map((x) => ({
        rol: x.rol,
        tipoPersona: x.tipoPersona,
        tipoDoc: s(x.tipoDoc),
        numDoc: s(x.numDoc),
        nombreCompleto: x.nombreCompleto,
        direccion: s(x.direccion),
        documentoTransferencia: s(x.documentoTransferencia),
      })),
    })),
  }
}

export function etiquetaPredio(p: { id: number; nombre: string | null; direccion: { direccion: string } | null }): string {
  return `#${p.id} · ${p.nombre ?? p.direccion?.direccion ?? 'Sin dirección'}`
}

const num = (v: string) => (v.trim() ? Number(v) : null)
const txt = (v: string) => v.trim() || null

export function aBody(f: DjForm) {
  return {
    contribuyenteId: f.contribuyente?.id,
    motivo: f.motivo,
    subMotivo: txt(f.subMotivo),
    numeroFormulario: txt(f.numeroFormulario),
    folios: num(f.folios),
    fechaPresentacion: f.fechaPresentacion,
    observacion: txt(f.observacion),
    documentos: f.documentos.map((d) => ({ tipo: d.tipo, numero: txt(d.numero), fecha: txt(d.fecha), observacion: txt(d.observacion) })),
    anexos: f.anexos.map((a) => ({
      ...(a.predio
        ? { predioId: a.predio.id }
        : { predioNuevo: { tipo: a.nuevo?.tipo, direccionId: a.nuevo?.direccion?.id, codigoCatastro: txt(a.nuevo?.codigoCatastro ?? ''), nombre: txt(a.nuevo?.nombre ?? '') } }),
      subMotivo: txt(a.subMotivo),
      condicion: a.condicion,
      porcentaje: Number(a.porcentaje),
      fechaAdquisicion: txt(a.fechaAdquisicion),
      fechaDocumento: txt(a.fechaDocumento),
      fechaDescargo: txt(a.fechaDescargo),
      anioAfectacion: num(a.anioAfectacion),
      fechaAfectacionArbitrios: txt(a.fechaAfectacionArbitrios),
      valorTransferencia: num(a.valorTransferencia),
      moneda: txt(a.moneda),
      partidaRegistral: txt(a.partidaRegistral),
      areaTerreno: Number(a.areaTerreno || 0),
      areaComun: num(a.areaComun),
      numeroPisos: num(a.numeroPisos),
      observacion: txt(a.observacion),
      niveles: a.niveles.map((n) => ({
        nivel: n.nivel.trim(),
        anioConstruccion: num(n.anioConstruccion),
        mesConstruccion: num(n.mesConstruccion),
        clasificacion: n.clasificacion,
        material: n.material,
        estadoConservacion: n.estadoConservacion,
        categorias: n.categorias.trim().toUpperCase(),
        areaPropia: Number(n.areaPropia),
        areaComun: num(n.areaComun),
        participacion: num(n.participacion),
      })),
      obras: a.obras.map((o) => ({
        codigo: txt(o.codigo)?.toUpperCase() ?? null,
        descripcion: o.descripcion.trim(),
        unidad: txt(o.unidad),
        cantidad: Number(o.cantidad),
        largo: num(o.largo),
        ancho: num(o.ancho),
        alto: num(o.alto),
        anioConstruccion: num(o.anioConstruccion),
        material: txt(o.material),
        estadoConservacion: txt(o.estadoConservacion),
        valorDeclarado: num(o.valorDeclarado),
      })),
      usos: a.usos.map((u) => ({
        uso: u.uso,
        subUso: txt(u.subUso),
        inquilino: txt(u.inquilino),
        area: Number(u.area),
        frontis: num(u.frontis),
        fechaInicio: txt(u.fechaInicio),
        fechaFin: txt(u.fechaFin),
        predominante: u.predominante,
      })),
      rusticos: a.rusticos.map((r) => ({ categoria: r.categoria.trim(), clasificacion: txt(r.clasificacion), hectareas: Number(r.hectareas) })),
      adquirientes: a.adquirientes.map((x) => ({
        rol: x.rol,
        tipoPersona: x.tipoPersona,
        tipoDoc: x.numDoc.trim() ? txt(x.tipoDoc) : null,
        numDoc: txt(x.numDoc),
        nombreCompleto: x.nombreCompleto.trim(),
        direccion: txt(x.direccion),
        documentoTransferencia: txt(x.documentoTransferencia),
      })),
    })),
  }
}

// Validación previa en cliente: lo que se puede ver sin la base. El backend vuelve a validar todo.
export function validarForm(f: DjForm): string | null {
  if (!f.contribuyente) return 'Elige el contribuyente que declara.'
  if (!f.motivo) return 'Elige el motivo de la DJ.'
  if (!f.fechaPresentacion) return 'Indica la fecha de presentación.'
  if (f.anexos.length === 0) return 'La DJ lleva al menos un anexo (un predio).'
  const descargo = DESCARGOS.includes(f.motivo)
  for (const [i, a] of f.anexos.entries()) {
    const p = `Anexo ${i + 1}`
    if (!a.predio && !a.nuevo?.direccion) return `${p}: elige el predio o la dirección del predio nuevo.`
    if (!(Number(a.porcentaje) > 0 && Number(a.porcentaje) <= 100)) return `${p}: el porcentaje debe estar entre 0 y 100.`
    if (descargo && !a.fechaDescargo) return `${p}: indica la fecha de descargo.`
    if (f.motivo === 'COMPRA' && !a.fechaAdquisicion) return `${p}: indica la fecha de adquisición.`
    if (f.motivo === 'VENTA' && !a.adquirientes.some((x) => x.rol === 'ADQUIRIENTE')) return `${p}: indica quién adquiere el predio.`
    if (!descargo && !a.usos.length) return `${p}: indica al menos un uso.`
    if (a.usos.some((u) => !(Number(u.area) > 0))) return `${p}: cada uso necesita su área.`
    if (a.niveles.some((n) => !n.nivel.trim() || !(Number(n.areaPropia) > 0) || !/^[A-I-]{7}$/i.test(n.categorias.trim())))
      return `${p}: cada nivel necesita nombre, área y 7 categorías (A–I o "-").`
    if (a.obras.some((o) => !o.descripcion.trim() || !(Number(o.cantidad) > 0))) return `${p}: cada obra necesita descripción y cantidad.`
    if (a.obras.some((o) => o.codigo.trim() && (!o.anioConstruccion || !o.material || !o.estadoConservacion)))
      return `${p}: una obra con código necesita año, material y estado de conservación (se valoriza y deprecia con las tablas del año).`
    if (a.adquirientes.some((x) => !x.nombreCompleto.trim())) return `${p}: cada adquiriente o transferente necesita su nombre.`
  }
  return null
}
