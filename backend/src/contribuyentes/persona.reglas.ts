// Reglas de la persona (specs/rentas-nucleo-v2.md, Fase 1; IDs en docs/rentas/reglas-negocio.md).
// Lógica pura: el servicio la usa y los tests la prueban sin base de datos.
import { EstadoPersona, TipoPersona } from '@prisma/client';
import { SIN_DOCUMENTO, TIPOS_DOC, documentoFicticio, validarDocumento } from './documento.js';

export interface NombrePersona {
  tipoPersona: TipoPersona;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  nombres?: string | null;
  razonSocial?: string | null;
  abreviaturaSucesion?: string | null;
}

const limpio = (v?: string | null) => (v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

// P05: el nombre completo se arma solo. Sucesión: abreviatura + apellidos (y nombres del causante,
// si se registran, para no perder datos convertidos de v1).
export function componerNombre(p: NombrePersona): string {
  const partes =
    p.tipoPersona === TipoPersona.JURIDICA
      ? [p.razonSocial]
      : [
          p.tipoPersona === TipoPersona.SUCESION ? p.abreviaturaSucesion : null,
          p.apellidoPaterno,
          p.apellidoMaterno,
          p.nombres,
        ];
  return partes.map(limpio).filter(Boolean).join(' ').slice(0, 120);
}

// Qué falta para componer el nombre según el tipo de persona.
export function errorNombre(p: NombrePersona & { tipoSucesion?: string | null }): string | null {
  switch (p.tipoPersona) {
    case TipoPersona.JURIDICA:
      return limpio(p.razonSocial) ? null : 'La razón social es obligatoria';
    case TipoPersona.SUCESION:
      if (!limpio(p.apellidoPaterno)) return 'Indica el apellido paterno del causante';
      return p.tipoSucesion ? null : 'Elige el tipo de sucesión';
    default:
      if (!limpio(p.apellidoPaterno)) return 'El apellido paterno es obligatorio';
      return limpio(p.nombres) ? null : 'Los nombres son obligatorios';
  }
}

export interface Documento {
  tipoDoc: string;
  numDoc: string;
}

// Formato de un documento. Los tipos que la muni agregue al catálogo (p. ej. CPP) se validan
// como alfanuméricos de 4 a 15 caracteres; los nacionales, con su regla (P07).
export function errorFormato(tipoDoc: string, numDoc: string): string | null {
  if ((TIPOS_DOC as readonly string[]).includes(tipoDoc)) {
    // NATURAL no impone coherencia de persona: aquí solo interesa el formato.
    const e = validarDocumento(tipoDoc, numDoc, TipoPersona.NATURAL);
    if (e && !/jurídica/.test(e)) return e;
  } else if (!/^[A-Z0-9-]{4,15}$/.test(numDoc)) {
    return `El ${tipoDoc} debe tener de 4 a 15 letras o números`;
  }
  if (documentoFicticio(tipoDoc, numDoc)) return `El ${tipoDoc} ${numDoc} parece inventado: registra el documento real o deja a la persona sin documento`;
  return null;
}

// P06, P07, P08, P17, P18. La lista vacía = sin documento (la justificación la exige el servicio).
export function errorDocumentos(tipoPersona: TipoPersona, docs: Documento[]): string | null {
  const tipos = new Set<string>();
  for (const d of docs) {
    if (d.tipoDoc === SIN_DOCUMENTO) return 'Para una persona sin documento deja la lista vacía y escribe la justificación';
    if (tipos.has(d.tipoDoc)) return `Hay dos documentos del tipo ${d.tipoDoc}`;
    tipos.add(d.tipoDoc);
    const e = errorFormato(d.tipoDoc, d.numDoc);
    if (e) return e;
  }
  const ruc = docs.find((d) => d.tipoDoc === 'RUC');
  switch (tipoPersona) {
    case TipoPersona.JURIDICA:
      if (!ruc?.numDoc.startsWith('20')) return 'Una persona jurídica se registra con RUC que empieza en 20';
      if (docs.length > 1) return 'Una persona jurídica solo lleva su RUC';
      return null;
    case TipoPersona.SUCESION:
      // P18: su documento propio es su RUC, o ninguno; el DNI del causante va aparte.
      return docs.some((d) => d.tipoDoc !== 'RUC') ? 'Una sucesión solo lleva RUC; el DNI del causante va en su propio campo' : null;
    default:
      return ruc?.numDoc.startsWith('20') ? 'Un RUC que empieza en 20 corresponde a una persona jurídica' : null;
  }
}

export interface DatosPendientes {
  numDoc: string | null;
  excepcionAprobadaAt: Date | null;
  nombreRevisado: boolean;
}

// P08 y P16: por qué la persona queda PENDIENTE. No frena la tributación.
export function pendientesDe(c: DatosPendientes): string[] {
  const p: string[] = [];
  if (!c.numDoc && !c.excepcionAprobadaAt) {
    p.push('Sin documento: registra uno o pide a un supervisor que apruebe la excepción');
  }
  if (!c.nombreRevisado) p.push('Nombre convertido del sistema anterior: revisa apellidos y nombres y guarda la ficha');
  return p;
}

// P16: INHABILITADO solo cambia por la acción de habilitar; si no, los pendientes deciden.
export function estadoCalculado(actual: EstadoPersona | null, pendientes: string[]): EstadoPersona {
  if (actual === EstadoPersona.INHABILITADO) return EstadoPersona.INHABILITADO;
  return pendientes.length ? EstadoPersona.PENDIENTE : EstadoPersona.HABILITADO;
}

// P02: habilitar no tiene restricción; vuelve a PENDIENTE si aún faltan datos.
export function estadoAlHabilitar(pendientes: string[]): EstadoPersona {
  return estadoCalculado(null, pendientes);
}

export const FORMATOS_CONTACTO = {
  EMAIL: { patron: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, error: 'no es un correo válido' },
  TELEFONO: { patron: /^[0-9+()\-\s]{6,15}$/, error: 'debe tener de 6 a 15 dígitos' },
  CELULAR: { patron: /^9\d{8}$/, error: 'debe tener 9 dígitos y empezar en 9' },
} as const;

// P09: el formato lo fija el atributo del tipo de contacto en el catálogo.
export function errorContacto(nombreTipo: string, formato: string | undefined, valor: string): string | null {
  if (!valor) return `Completa el ${nombreTipo.toLowerCase()}`;
  const f = FORMATOS_CONTACTO[formato as keyof typeof FORMATOS_CONTACTO];
  if (f && !f.patron.test(valor)) return `${nombreTipo}: ${valor} ${f.error}`;
  return valor.length > 100 ? `${nombreTipo}: máximo 100 caracteres` : null;
}

export interface RelacionadoVigente {
  tipo: string;
  vigente: boolean;
}

// P10: solo uno vigente para los tipos marcados como únicos (cónyuge).
export function errorRelacionados(lista: RelacionadoVigente[], tiposUnicos: Map<string, string>): string | null {
  for (const [codigo, nombre] of tiposUnicos) {
    if (lista.filter((r) => r.tipo === codigo && r.vigente).length > 1) return `Solo puede haber un ${nombre.toLowerCase()} vigente`;
  }
  return null;
}

// P01: mensaje del 409 al intentar inhabilitar con deuda vigente.
export function mensajeDeuda(monto: string | number): string {
  const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(monto));
  return `El contribuyente mantiene una deuda de S/ ${soles} y no puede ser inhabilitado`;
}

export interface Periodo {
  anioDesde: number;
  anioHasta: number | null;
}

// P14/P15: dos resoluciones del mismo régimen no pueden cubrir el mismo año.
export function seSolapan(a: Periodo, b: Periodo): boolean {
  const finA = a.anioHasta ?? Number.POSITIVE_INFINITY;
  const finB = b.anioHasta ?? Number.POSITIVE_INFINITY;
  return a.anioDesde <= finB && b.anioDesde <= finA;
}
