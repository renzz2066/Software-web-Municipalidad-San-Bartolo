// Contrato del CSV que descarga la pantalla de exportación (specs/utilitarios-v1.md, U6).
import { describe, expect, it } from 'vitest'
import { aCsv, nombreArchivo, type ColumnaCsv } from './exportarCsv'

const columnas: ColumnaCsv[] = [
  { clave: 'numDoc', titulo: 'Documento' },
  { clave: 'nombre', titulo: 'Nombre' },
  { clave: 'deuda', titulo: 'Deuda' },
]

describe('aCsv', () => {
  it('cabecera y filas separadas por `;` y saltos CRLF', () => {
    const csv = aCsv(
      [
        { numDoc: '20131312955', nombre: 'MUNICIPALIDAD', deuda: 0 },
        { numDoc: '12345678', nombre: 'JUAN PEREZ', deuda: 150.5 },
      ],
      columnas,
    )
    expect(csv).toBe('Documento;Nombre;Deuda\r\n20131312955;MUNICIPALIDAD;0\r\n12345678;JUAN PEREZ;150.5')
  })

  it('con solo la cabecera si no hay filas', () => {
    expect(aCsv([], columnas)).toBe('Documento;Nombre;Deuda')
  })

  it('escapa punto y coma, comillas y saltos de línea', () => {
    const csv = aCsv([{ numDoc: 'a;b', nombre: 'dice "hola"', deuda: 'uno\ndos' }], columnas)
    expect(csv).toBe('Documento;Nombre;Deuda\r\n"a;b";"dice ""hola""";"uno\ndos"')
  })

  it('null y undefined quedan vacíos', () => {
    expect(aCsv([{ numDoc: null, nombre: undefined, deuda: '' }], columnas)).toBe(
      'Documento;Nombre;Deuda\r\n;;',
    )
  })

  it('las fechas salen en AAAA-MM-DD', () => {
    const csv = aCsv([{ numDoc: new Date('2026-03-01T05:00:00.000Z'), nombre: null, deuda: null }], [
      { clave: 'numDoc', titulo: 'Fecha' },
    ])
    expect(csv).toBe('Fecha\r\n2026-03-01')
  })

  it('usa `formato` cuando la columna lo define', () => {
    const csv = aCsv([{ deuda: 1234.5 }], [
      { clave: 'deuda', titulo: 'Deuda', formato: (v) => `S/ ${Number(v).toFixed(2)}` },
    ])
    expect(csv).toBe('Deuda\r\nS/ 1234.50')
  })
})

describe('nombreArchivo', () => {
  it('minúsculas, sin acentos ni símbolos raros', () => {
    expect(nombreArchivo('Contribuyentes 2026')).toBe('contribuyentes-2026.csv')
    expect(nombreArchivo('Área de Ventas')).toBe('area-de-ventas.csv')
    expect(nombreArchivo('Reporte de Caja / marzo')).toBe('reporte-de-caja-marzo.csv')
  })

  it('agrega el sufijo y usa un respaldo si queda vacío', () => {
    expect(nombreArchivo('Recibos', '-2026-03')).toBe('recibos-2026-03.csv')
    expect(nombreArchivo('')).toBe('exportacion.csv')
    expect(nombreArchivo('---')).toBe('exportacion.csv')
  })
})
