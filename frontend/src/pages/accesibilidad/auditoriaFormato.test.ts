import { describe, expect, it } from 'vitest'
import {
  calcularDiff,
  etiquetaUsuario,
  formatearValor,
  rangoPorDefecto,
  type AuditoriaItem,
} from './auditoriaFormato'

const base: AuditoriaItem = {
  id: '1',
  usuarioId: null,
  usuario: null,
  usuarioNombre: null,
  accion: 'UPDATE',
  tabla: 'usuarios',
  registroId: '1',
  modulo: null,
  ip: null,
  userAgent: null,
  datosAntes: null,
  datosDespues: null,
  detalle: null,
  createdAt: '2026-10-19T15:00:00.000Z',
}

describe('calcularDiff', () => {
  it('CREATE: todos los campos agregados', () => {
    expect(calcularDiff(null, { usuario: 'ana', activo: true })).toEqual([
      { campo: 'usuario', tipo: 'agregado', despues: 'ana' },
      { campo: 'activo', tipo: 'agregado', despues: true },
    ])
  })

  it('DELETE: todos los campos quitados', () => {
    expect(calcularDiff({ id: 3 }, null)).toEqual([{ campo: 'id', tipo: 'quitado', antes: 3 }])
  })

  it('UPDATE: cambiado conserva antes y después, incluso null y la marca de contraseña', () => {
    expect(
      calcularDiff({ oficinaId: 2, password: '[CAMBIADO]' }, { oficinaId: null, password: '[CAMBIADO]' }),
    ).toEqual([
      { campo: 'oficinaId', tipo: 'cambiado', antes: 2, despues: null },
      { campo: 'password', tipo: 'cambiado', antes: '[CAMBIADO]', despues: '[CAMBIADO]' },
    ])
  })

  it('datos no-objeto o vacíos → sin filas', () => {
    expect(calcularDiff([1, 2], 'x')).toEqual([])
    expect(calcularDiff({}, {})).toEqual([])
  })
})

describe('formatearValor', () => {
  it('null/undefined, booleanos y objetos legibles', () => {
    expect(formatearValor(null)).toBe('vacío')
    expect(formatearValor(undefined)).toBe('vacío')
    expect(formatearValor(false)).toBe('no')
    expect(formatearValor({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(formatearValor(0)).toBe('0')
  })
})

describe('rangoPorDefecto', () => {
  it('últimos 7 días en hora de Lima (UTC-5), no en UTC', () => {
    // 2026-10-20 03:00 UTC = 2026-10-19 22:00 en Lima
    expect(rangoPorDefecto(new Date('2026-10-20T03:00:00Z'))).toEqual({
      desde: '2026-10-13',
      hasta: '2026-10-19',
    })
  })
})

describe('etiquetaUsuario', () => {
  it('usuario conocido → nombre y login', () => {
    const item = {
      ...base,
      usuarioId: 1,
      usuario: { id: 1, usuario: 'admin', nombres: 'Ana', apellidos: 'Pérez' },
    }
    expect(etiquetaUsuario(item)).toEqual({ tipo: 'usuario', texto: 'Ana Pérez (admin)' })
  })

  it('LOGIN_FALLIDO sin usuario → intento con el texto tecleado', () => {
    expect(etiquetaUsuario({ ...base, accion: 'LOGIN_FALLIDO', usuarioNombre: 'xyz' })).toEqual({
      tipo: 'intento',
      texto: 'xyz',
    })
  })

  it('cambio sin usuario → SISTEMA con rol de BD si existe', () => {
    expect(etiquetaUsuario({ ...base, detalle: { dbUsuario: 'postgres' } })).toEqual({
      tipo: 'sistema',
      dbUsuario: 'postgres',
    })
    expect(etiquetaUsuario(base)).toEqual({ tipo: 'sistema', dbUsuario: null })
  })
})
