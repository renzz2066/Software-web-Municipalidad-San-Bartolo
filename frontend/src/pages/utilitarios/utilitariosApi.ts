import { isAxiosError } from 'axios'
import { mensajeError } from '../rentas/maestros/maestrosApi'

// Contrato compartido de las pantallas de Utilitarios (specs/utilitarios-v1.md).
// Todo es de solo lectura: no hay endpoints nuevos ni POST/PUT/DELETE.

/** 403 = el rol no tiene el nivel del módulo origen; se pinta como «Sin acceso» y no rompe nada. */
export const SIN_ACCESO = 'Sin acceso a este módulo.'

export const esSinAcceso = (err: unknown): boolean => isAxiosError(err) && err.response?.status === 403

export function mensajeUtilidad(err: unknown): string {
  return esSinAcceso(err) ? SIN_ACCESO : mensajeError(err)
}

/** Rango de años que acepta el backend (backend/src/rentas/maestros/maestros.reglas.ts). */
export const ANIO_MIN = 2000
export const ANIO_MAX = 2100

/** `vigenciaDesde` llega como ISO completo; las reglas de cálculo trabajan con AAAA-MM-DD. */
export const aFecha = (iso: string) => iso.slice(0, 10)

/** Último día del mes (1-12), igual que `vencimientos()` del motor de cálculo. */
export const ultimoDiaMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10)

/** Vencimientos de las 4 cuotas: feb, may, ago, nov (`MESES_VENCIMIENTO` del motor). */
export const vencimientos = (anio: number) => [2, 5, 8, 11].map((mes) => ultimoDiaMes(anio, mes))
