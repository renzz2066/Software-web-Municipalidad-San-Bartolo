// Contrato de Utilitarios: manejo de 403 (U7), mensajes de error (U9) y vencimientos
// que deben coincidir con `MESES_VENCIMIENTO` de backend/src/rentas/calculo/motor.ts.
import { describe, expect, it } from 'vitest'
import { ANIO_MAX, ANIO_MIN, SIN_ACCESO, aFecha, esSinAcceso, mensajeUtilidad, ultimoDiaMes, vencimientos } from './utilitariosApi'

/** Error con forma de Axios sin depender de su constructor. */
function errAxios(status: number, data?: unknown) {
  return { isAxiosError: true, message: 'Request failed', response: { status, data } }
}

describe('manejo de permisos y errores', () => {
  it('un 403 es «Sin acceso» y no un error de conexión', () => {
    const e = errAxios(403)
    expect(esSinAcceso(e)).toBe(true)
    expect(mensajeUtilidad(e)).toBe(SIN_ACCESO)
    expect(SIN_ACCESO).toBe('Sin acceso a este módulo.')
  })

  it('401 pide volver a ingresar y el resto usa el mensaje legible', () => {
    expect(mensajeUtilidad(errAxios(401))).toBe('Sesión vencida. Vuelve a ingresar.')
    expect(mensajeUtilidad(errAxios(404, { message: 'No existe' }))).toBe('No existe')
    expect(mensajeUtilidad(errAxios(500))).toBe('No se pudo conectar con el servidor. Intenta nuevamente.')
  })

  it('un error de red sin respuesta también queda como conexión', () => {
    expect(mensajeUtilidad(new Error('offline'))).toBe('No se pudo conectar con el servidor. Intenta nuevamente.')
    expect(esSinAcceso(new Error('offline'))).toBe(false)
  })
})

describe('fechas de utilitarios', () => {
  it('aFecha recorta el ISO completo a AAAA-MM-DD', () => {
    expect(aFecha('2026-03-01T00:00:00.000Z')).toBe('2026-03-01')
    expect(aFecha('2026-01-05')).toBe('2026-01-05')
  })

  it('ultimoDiaMes da el último día del mes (1-12)', () => {
    expect(ultimoDiaMes(2026, 1)).toBe('2026-01-31')
    expect(ultimoDiaMes(2026, 2)).toBe('2026-02-28')
    expect(ultimoDiaMes(2028, 2)).toBe('2028-02-29')
    expect(ultimoDiaMes(2026, 11)).toBe('2026-11-30')
  })

  it('vencimientos replica MESES_VENCIMIENTO = feb, may, ago, nov', () => {
    expect(vencimientos(2026)).toEqual(['2026-02-28', '2026-05-31', '2026-08-31', '2026-11-30'])
    expect(vencimientos(2028)).toEqual(['2028-02-29', '2028-05-31', '2028-08-31', '2028-11-30'])
  })

  it('el rango de años es el que acepta el backend', () => {
    expect([ANIO_MIN, ANIO_MAX]).toEqual([2000, 2100])
  })
})
