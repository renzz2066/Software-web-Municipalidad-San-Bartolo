// Vectores golden copiados de `backend/src/rentas/valores/plazos.spec.ts` (specs/utilitarios-v1.md, U4).
import { describe, expect, it } from 'vitest'
import { diasHabilesEntre, esHabil, masDias, siguienteHabil, sumarHabiles } from './plazos'

const sinFeriados = new Set<string>()

describe('plazos en días hábiles', () => {
  it('sábado, domingo y feriado no son hábiles', () => {
    expect(esHabil('2026-10-23', sinFeriados)).toBe(true) // viernes
    expect(esHabil('2026-10-24', sinFeriados)).toBe(false) // sábado
    expect(esHabil('2026-10-25', sinFeriados)).toBe(false) // domingo
    expect(esHabil('2026-12-25', new Set(['2026-12-25']))).toBe(false)
  })

  it('el siguiente hábil de un viernes es el lunes', () => {
    expect(siguienteHabil('2026-10-23', sinFeriados)).toBe('2026-10-26')
  })

  it('cuenta 20 hábiles desde el día siguiente saltando fines de semana', () => {
    // Notificada el lunes 2026-10-05: día 1 = martes 06, día 20 = lunes 02-nov.
    expect(sumarHabiles('2026-10-05', 20, sinFeriados)).toBe('2026-11-02')
  })

  it('un feriado dentro del plazo lo corre un día', () => {
    expect(sumarHabiles('2026-10-05', 20, new Set(['2026-10-08']))).toBe('2026-11-03')
  })

  it('masDias cruza meses y años bisiestos', () => {
    expect(masDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(masDias('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('diasHabilesEntre', () => {
  it('coincide con sumarHabiles: contar y sumar dan lo mismo', () => {
    expect(diasHabilesEntre('2026-10-05', sumarHabiles('2026-10-05', 20, sinFeriados), sinFeriados)).toBe(20)
    const conFeriado = new Set(['2026-10-08'])
    expect(diasHabilesEntre('2026-10-05', sumarHabiles('2026-10-05', 20, conFeriado), conFeriado)).toBe(20)
  })

  it('cuenta el intervalo abierto por la izquierda', () => {
    // Del viernes 23 al lunes 26 solo es hábil el lunes 26.
    expect(diasHabilesEntre('2026-10-23', '2026-10-26', sinFeriados)).toBe(1)
  })

  it('0 cuando no hay días hábiles o el rango está invertido', () => {
    expect(diasHabilesEntre('2026-10-24', '2026-10-25', sinFeriados)).toBe(0) // sábado a domingo
    expect(diasHabilesEntre('2026-10-26', '2026-10-26', sinFeriados)).toBe(0)
    expect(diasHabilesEntre('2026-10-26', '2026-10-20', sinFeriados)).toBe(0)
  })

  it('rechaza un rango mayor a 10 años en vez de girar sin fin', () => {
    expect(() => diasHabilesEntre('2020-01-01', '2035-01-01', sinFeriados)).toThrow(/10 años/)
  })
})
