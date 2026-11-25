import { describe, expect, it } from 'vitest'
import { accionCorta, anchosBarra, porcentaje, requiereObservacion } from './cobranzaFormato'

describe('anchosBarra', () => {
  it('reparte el 100 % aunque las probabilidades vengan redondeadas', () => {
    const a = anchosBarra({ pPuntual: 0.2207, pTardio: 0.3655, pIncobrable: 0.4139 })
    expect(a.PUNTUAL + a.TARDIO + a.INCOBRABLE).toBeCloseTo(100)
    expect(a.INCOBRABLE).toBeCloseTo(41.4, 0)
  })

  it('no divide entre cero', () => {
    const a = anchosBarra({ pPuntual: 0, pTardio: 0, pIncobrable: 0 })
    expect(a.INCOBRABLE).toBe(100)
  })
})

describe('formatos', () => {
  it('porcentaje en formato peruano', () => {
    expect(porcentaje(0.4139)).toBe('41.4 %')
  })

  it('acorta las acciones conocidas y deja las demás', () => {
    expect(accionCorta('Gestión intensiva (llamada, visita, OP/RD)')).toBe('Gestión intensiva')
    expect(accionCorta('Otra acción')).toBe('Otra acción')
  })

  it('pide observación en compromiso y no ubicado', () => {
    expect(requiereObservacion('COMPROMISO')).toBe(true)
    expect(requiereObservacion('PAGO')).toBe(false)
  })
})
