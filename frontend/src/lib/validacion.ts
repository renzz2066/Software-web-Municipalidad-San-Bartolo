// Verificación de DNI/RUC para Utilitarios (specs/utilitarios-v1.md, U3).
// Misma regla SUNAT módulo 11 que `backend/src/contribuyentes/documento.ts` y que la validación
// previa de `pages/rentas/contribuyentes/tipos.ts`; `validacion.test.ts` las ata a ambas.
const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
const PREFIJOS_RUC = ['10', '15', '16', '17', '20']

export type TipoVerificado = 'DNI' | 'RUC' | 'DESCONOCIDO'

export interface Verificacion {
  tipo: TipoVerificado
  doc: string
  valido: boolean
  mensaje: string
}

// Normaliza igual que el formulario de contribuyentes: sin espacios y en mayúsculas.
export const normalizarDocumento = (texto: string) => texto.replace(/\s+/g, '').toUpperCase()

/** Dígito verificador SUNAT (módulo 11) para los 10 primeros dígitos; null si no son 10. */
export function dvEsperado(primeros10: string): number | null {
  if (!/^\d{10}$/.test(primeros10)) return null
  const suma = PESOS_RUC.reduce((acc, peso, i) => acc + peso * Number(primeros10[i]), 0)
  return (11 - (suma % 11)) % 10
}

export function rucValido(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc) || !PREFIJOS_RUC.includes(ruc.slice(0, 2))) return false
  return dvEsperado(ruc.slice(0, 10)) === Number(ruc[10])
}

// El DNI lo asigna RENIEC de forma correlativa: no lleva dígito verificador, solo longitud.
export const dniValido = (dni: string) => /^\d{8}$/.test(dni)

export function verificarDocumento(entrada: string): Verificacion {
  const doc = normalizarDocumento(entrada)
  if (!doc) return { tipo: 'DESCONOCIDO', doc, valido: false, mensaje: 'Escribe un DNI o un RUC' }
  if (dniValido(doc)) {
    return { tipo: 'DNI', doc, valido: true, mensaje: 'DNI válido: 8 dígitos (RENIEC no usa dígito verificador)' }
  }
  if (/^\d{11}$/.test(doc)) {
    if (!PREFIJOS_RUC.includes(doc.slice(0, 2))) {
      return {
        tipo: 'RUC',
        doc,
        valido: false,
        mensaje: 'RUC inválido: el prefijo debe ser 10, 15, 16, 17 o 20',
      }
    }
    if (rucValido(doc)) return { tipo: 'RUC', doc, valido: true, mensaje: 'RUC válido: dígito verificador correcto' }
    const esperado = dvEsperado(doc.slice(0, 10))
    return {
      tipo: 'RUC',
      doc,
      valido: false,
      mensaje: `RUC inválido: el dígito verificador debía ser ${esperado} y es ${doc[10]}`,
    }
  }
  if (/^\d+$/.test(doc)) {
    return {
      tipo: 'DESCONOCIDO',
      doc,
      valido: false,
      mensaje: `Longitud no válida: el DNI tiene 8 dígitos y el RUC 11 (este tiene ${doc.length})`,
    }
  }
  return {
    tipo: 'DESCONOCIDO',
    doc,
    valido: false,
    mensaje: 'Solo se verifica DNI (8 dígitos) o RUC (11 dígitos)',
  }
}
