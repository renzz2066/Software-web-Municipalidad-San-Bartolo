// Validación de documentos de identidad (specs/rentas-nucleo-v1.md, C1). Lógica pura.
import { TipoPersona } from '@prisma/client';

export const TIPOS_DOC = ['DNI', 'RUC', 'CE', 'PASAPORTE'] as const;
export type TipoDoc = (typeof TIPOS_DOC)[number];

const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS_RUC = ['10', '15', '16', '17', '20'];

// Dígito verificador SUNAT (módulo 11).
export function rucValido(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc) || !PREFIJOS_RUC.includes(ruc.slice(0, 2))) {
    return false;
  }
  const suma = PESOS_RUC.reduce((acc, peso, i) => acc + peso * Number(ruc[i]), 0);
  const dv = (11 - (suma % 11)) % 10;
  return dv === Number(ruc[10]);
}

// Devuelve el mensaje de error o null si el documento es coherente con el tipo de persona.
export function validarDocumento(tipoDoc: string, numDoc: string, tipoPersona: TipoPersona): string | null {
  switch (tipoDoc) {
    case 'DNI':
      if (!/^\d{8}$/.test(numDoc)) return 'El DNI debe tener 8 dígitos';
      break;
    case 'RUC':
      if (!rucValido(numDoc)) return 'El RUC no es válido (11 dígitos y dígito verificador)';
      break;
    case 'CE':
      if (!/^[A-Z0-9]{9,12}$/.test(numDoc)) return 'El carné de extranjería debe tener de 9 a 12 caracteres';
      break;
    case 'PASAPORTE':
      if (!/^[A-Z0-9]{6,12}$/.test(numDoc)) return 'El pasaporte debe tener de 6 a 12 caracteres';
      break;
    default:
      return 'Tipo de documento no válido';
  }
  if (tipoPersona === TipoPersona.JURIDICA && !(tipoDoc === 'RUC' && numDoc.startsWith('20'))) {
    return 'Una persona jurídica se registra con RUC que empieza en 20';
  }
  if (tipoPersona === TipoPersona.NATURAL && tipoDoc === 'RUC' && numDoc.startsWith('20')) {
    return 'Un RUC que empieza en 20 corresponde a una persona jurídica';
  }
  return null;
}

// Normaliza para guardar y buscar: sin espacios, en mayúsculas.
export function normalizarDocumento(numDoc: string): string {
  return numDoc.replace(/\s+/g, '').toUpperCase();
}
