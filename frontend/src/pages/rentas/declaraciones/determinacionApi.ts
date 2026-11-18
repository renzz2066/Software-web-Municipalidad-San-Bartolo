// Determinación y liquidación de la DJ presentada (contrato: backend/src/rentas/calculo/determinacion.service.ts;
// specs/rentas-nucleo-v2.md, Fase 5; reglas V01–V07, L01–L13, J14, J15).
import type { DjDetalle } from './djApi'

type Dec = string

export type EstadoDeterminacion = 'DETERMINADA' | 'LIQUIDADA' | 'REEMPLAZADA' | 'DESCARTADA'
export type Tributo = 'PREDIAL' | 'ARBITRIOS'

export const ETIQUETA_DETERMINACION: Record<EstadoDeterminacion, string> = {
  DETERMINADA: 'Por liquidar',
  LIQUIDADA: 'Liquidada',
  REEMPLAZADA: 'Reemplazada',
  DESCARTADA: 'Descartada',
}

export const ESTILO_DETERMINACION: Record<EstadoDeterminacion, string> = {
  DETERMINADA: 'bg-amber-50 text-amber-800',
  LIQUIDADA: 'bg-emerald-50 text-emerald-800',
  REEMPLAZADA: 'bg-slate-100 text-slate-600',
  DESCARTADA: 'bg-slate-100 text-slate-600',
}

// Nombre corto de cada concepto de arbitrios (Tributo.codigo).
export const CONCEPTO: Record<string, string> = {
  RESIDUOS: 'Residuos sólidos',
  BARRIDO: 'Barrido de calles',
  PARQUES: 'Parques y jardines',
  SERENAZGO: 'Serenazgo',
}

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']

export interface PredioDeterminado {
  predioId: number
  direccion: string
  codigoCatastro: string | null
  tipo: 'URBANO' | 'RUSTICO'
  origen: string
  condicion: string | null
  porcentaje: Dec
  afectoPredial: boolean
  exoneracion: Dec
  terreno: Dec | null
  construccion: Dec | null
  obras: Dec | null
  autoavaluo: Dec | null
  valorAfecto: Dec
  arbitrios: Dec
  error: string | null
  arancel: string | null
  niveles: { nivel: string; area: string; valorUnitario: string; depreciacion: string; valor: string }[]
  meses: number[]
}

export interface Determinacion {
  id: number
  anio: number
  estado: EstadoDeterminacion
  dj: { id: number; numeroTexto: string } | null
  baseImponible: Dec
  deduccion: Dec
  baseAfecta: Dec
  impuesto: Dec
  derechoEmision: Dec
  arbitrios: Dec
  predialCalculable: boolean
  liquidaPredial: boolean
  liquidaArbitrios: boolean
  liquidadaAt: string | null
  createdAt: string
  cuotasPredial: { cuota: number; importe: Dec; derechoEmision: Dec; vence: string }[]
  beneficios: string[]
  errores: string[]
  avisos: string[]
  saldoAFavor: { tributo: string; predioId: number | null; importe: Dec }[]
  predios: PredioDeterminado[]
  arbitriosPorMes: { predioId: number; concepto: string; usos: string[]; meses: Dec[]; cuotas: { cuota: number; importe: Dec; vence: string }[] }[]
}

export interface PlanAnio {
  anio: number
  impuesto: Dec
  derechoEmision: Dec
  arbitrios: Dec
  predialCalculable: boolean
  crear: number
  montoNuevo: Dec
  ajustes: number
  anular: number
  sinCambio: number
  saldoAFavor: Dec
  bloqueos: string[]
  errores: string[]
  avisos: string[]
}

export interface Previa {
  anios: number[]
  tributos: Tributo[]
  informativa: boolean
  porAnio: PlanAnio[]
  avisos: string[]
}

export interface ResultadoLiquidacion extends Previa {
  dj: DjDetalle
  determinaciones: Determinacion[]
}

// HR por año de una persona (GET /declaraciones/determinaciones?contribuyenteId=).
export interface HojaResumen {
  id: number
  anio: number
  estado: EstadoDeterminacion
  baseAfecta: Dec
  impuesto: Dec
  derechoEmision: Dec
  arbitrios: Dec
  liquidaPredial: boolean
  liquidaArbitrios: boolean
  liquidadaAt: string | null
  dj: { id: number; anio: number; numero: number; estado: string; numeroTexto: string } | null
  predios: number
}

export const soles = (v: Dec | number | null | undefined) =>
  v === null || v === undefined ? '—' : `S/ ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
