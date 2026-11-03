// Vectores golden de `backend/src/contribuyentes/documento.spec.ts` (DNI/RUC) más la paridad con la
// validación que ya usa el formulario de contribuyentes (specs/utilitarios-v1.md, U3).
import { describe, expect, it } from 'vitest'
import { errorDocumento } from '../pages/rentas/contribuyentes/tipos'
import { dvEsperado, dniValido, normalizarDocumento, rucValido, verificarDocumento } from './validacion'

describe('rucValido', () => {
  it('acepta RUC con dígito verificador correcto', () => {
    expect(rucValido('20131312955')).toBe(true) // SUNAT
    expect(rucValido('20100047218')).toBe(true) // BCP
  })

  it('rechaza dígito verificador, prefijo o longitud incorrectos', () => {
    expect(rucValido('20131312956')).toBe(false)
    expect(rucValido('30131312955')).toBe(false)
    expect(rucValido('2013131295')).toBe(false)
    expect(rucValido('2013131295A')).toBe(false)
  })

  it('el mismo resultado que la validación previa del formulario', () => {
    const docs = ['20131312955', '20100047218', '20131312956', '30131312955', '2013131295', '2013131295A']
    for (const doc of docs) {
      expect(rucValido(doc)).toBe(errorDocumento('RUC', doc, 'NATURAL') === null)
    }
  })
})

describe('dvEsperado', () => {
  it('devuelve el dígito verificador que debería tener', () => {
    expect(dvEsperado('2013131295')).toBe(5)
    expect(dvEsperado('2010004721')).toBe(8)
  })

  it('null si no son 10 dígitos', () => {
    expect(dvEsperado('201313129')).toBeNull()
    expect(dvEsperado('2013131295A')).toBeNull()
  })
})

describe('dniValido', () => {
  it('8 dígitos: RENIEC no usa dígito verificador', () => {
    expect(dniValido('12345678')).toBe(true)
    expect(dniValido('1234567')).toBe(false)
    expect(dniValido("1234567'")).toBe(false)
    expect(dniValido('abcdefgh')).toBe(false)
  })
})

describe('normalizarDocumento', () => {
  it('quita espacios y pasa a mayúsculas', () => {
    expect(normalizarDocumento(' ab 12 34 56 ')).toBe('AB123456')
  })
})

describe('verificarDocumento', () => {
  it('DNI correcto', () => {
    const r = verificarDocumento('12345678')
    expect(r).toMatchObject({ tipo: 'DNI', doc: '12345678', valido: true })
  })

  it('RUC correcto', () => {
    const r = verificarDocumento('20131312955')
    expect(r).toMatchObject({ tipo: 'RUC', valido: true })
    expect(r.mensaje).toMatch(/dígito verificador correcto/)
  })

  it('RUC con dígito equivocado dice cuál debía ser', () => {
    const r = verificarDocumento('20131312956')
    expect(r.valido).toBe(false)
    expect(r.mensaje).toBe('RUC inválido: el dígito verificador debía ser 5 y es 6')
  })

  it('RUC con prefijo no admitido', () => {
    expect(verificarDocumento('30131312955').mensaje).toMatch(/prefijo/)
  })

  it('longitud incorrecta distingue DNI de RUC', () => {
    expect(verificarDocumento('1234567').mensaje).toMatch(/8 dígitos y el RUC 11 \(este tiene 7\)/)
    expect(verificarDocumento('2013131295').mensaje).toMatch(/este tiene 10/)
  })

  it('entrada vacía o no numérica', () => {
    expect(verificarDocumento('   ')).toMatchObject({ tipo: 'DESCONOCIDO', valido: false })
    expect(verificarDocumento('AB12').mensaje).toMatch(/Solo se verifica DNI/)
  })

  it('normaliza espacios antes de verificar', () => {
    expect(verificarDocumento(' 20 1313 12955 ').doc).toBe('20131312955')
    expect(verificarDocumento(' 20 1313 12955 ').valido).toBe(true)
  })
})
