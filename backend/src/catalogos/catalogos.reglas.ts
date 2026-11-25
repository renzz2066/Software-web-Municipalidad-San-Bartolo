// Catálogos y reglas por muni (specs/rentas-nucleo-v2.md, Fase 0). Lógica pura: qué grupos hay,
// qué atributos lleva cada uno y cómo se valida el valor de cada ReglaMuni.
import { GrupoCatalogo } from '@prisma/client';

export type DefAtributo =
  | { tipo: 'opcion'; etiqueta: string; opciones: readonly string[]; requerido?: boolean }
  | { tipo: 'numero'; etiqueta: string; min: number; max: number; requerido?: boolean }
  | { tipo: 'booleano'; etiqueta: string }
  | { tipo: 'texto'; etiqueta: string; max: number; requerido?: boolean };

export interface DefGrupo {
  nombre: string;
  reglas: string; // IDs de docs/rentas/reglas-negocio.md
  padre?: GrupoCatalogo; // el ítem cuelga de un ítem de ese grupo
  abreviatura?: 'opcional' | 'requerida';
  atributos: Record<string, DefAtributo>;
}

export const TIPOS_MOTIVO = ['INFORMATIVA', 'DECLARATIVA'] as const;
export const FORMATOS_CONTACTO = ['EMAIL', 'TELEFONO', 'CELULAR'] as const;
export const REGIMENES_BENEFICIO = ['INAFECTACION', 'EXONERACION', 'DEDUCCION'] as const;
export const PERSONAS_BENEFICIO = ['NATURAL', 'JURIDICA', 'CUALQUIERA'] as const;

const G = GrupoCatalogo;

export const GRUPOS: Record<GrupoCatalogo, DefGrupo> = {
  [G.TIPO_DOCUMENTO]: { nombre: 'Tipos de documento de identidad', reglas: 'P06, P07, P08', abreviatura: 'opcional', atributos: {} },
  [G.TIPO_CONTACTO]: {
    nombre: 'Tipos de contacto',
    reglas: 'P09',
    atributos: { formato: { tipo: 'opcion', etiqueta: 'Formato', opciones: FORMATOS_CONTACTO, requerido: true } },
  },
  [G.TIPO_RELACIONADO]: {
    nombre: 'Tipos de relacionado',
    reglas: 'P10',
    atributos: { unico: { tipo: 'booleano', etiqueta: 'Solo uno vigente' } },
  },
  [G.TIPO_SUCESION]: { nombre: 'Tipos de sucesión', reglas: 'P05', abreviatura: 'requerida', atributos: {} },
  [G.PERFIL_CUMPLIMIENTO]: { nombre: 'Perfiles de cumplimiento', reglas: 'P12', atributos: {} },
  [G.PERFIL_COBRANZA]: { nombre: 'Perfiles de cobranza', reglas: 'P12', atributos: {} },
  [G.CLASIFICACION_CONTRIBUYENTE]: { nombre: 'Clasificación de contribuyentes', reglas: 'P12', abreviatura: 'opcional', atributos: {} },
  [G.BENEFICIO]: {
    nombre: 'Inafectaciones, exoneraciones y deducciones',
    reglas: 'P14, P15, R06',
    atributos: {
      regimen: { tipo: 'opcion', etiqueta: 'Régimen', opciones: REGIMENES_BENEFICIO, requerido: true },
      persona: { tipo: 'opcion', etiqueta: 'Para persona', opciones: PERSONAS_BENEFICIO, requerido: true },
      porcentaje: { tipo: 'numero', etiqueta: '% de exoneración', min: 0, max: 100 },
      deduccionUit: { tipo: 'numero', etiqueta: 'Deducción (UIT)', min: 0, max: 100 },
      baseLegal: { tipo: 'texto', etiqueta: 'Base legal', max: 150 },
    },
  },
  [G.COMPONENTE_DIRECCION]: { nombre: 'Componentes de dirección', reglas: 'D04', abreviatura: 'requerida', atributos: {} },
  [G.TIPO_VIA]: { nombre: 'Tipos de vía', reglas: 'D02', abreviatura: 'requerida', atributos: {} },
  [G.TIPO_HABILITACION]: { nombre: 'Tipos de habilitación urbana', reglas: 'D02', abreviatura: 'requerida', atributos: {} },
  [G.FRECUENCIA_BARRIDO]: { nombre: 'Frecuencias de barrido', reglas: 'R02', atributos: {} },
  [G.UBICACION_PARQUE]: { nombre: 'Ubicación respecto a parques', reglas: 'R02, D03', atributos: {} },
  [G.CONDICION_PROPIEDAD]: { nombre: 'Condición de propiedad', reglas: 'R05', atributos: {} },
  [G.USO_PREDIO]: { nombre: 'Usos del predio', reglas: 'R03', atributos: {} },
  [G.SUB_USO_PREDIO]: { nombre: 'Sub-usos del predio', reglas: 'R03', padre: G.USO_PREDIO, atributos: {} },
  [G.MOTIVO_DJ]: {
    nombre: 'Motivos de declaración jurada',
    reglas: 'J06, J07',
    atributos: { tipo: { tipo: 'opcion', etiqueta: 'Tipo', opciones: TIPOS_MOTIVO, requerido: true } },
  },
  [G.SUB_MOTIVO_DJ]: { nombre: 'Sub-motivos de declaración jurada', reglas: 'J07', padre: G.MOTIVO_DJ, atributos: {} },
  [G.TIPO_DOC_ADJUNTO]: { nombre: 'Tipos de documento adjunto a la DJ', reglas: 'J13', atributos: {} },
  [G.TIPO_DOC_TRANSFERENCIA]: { nombre: 'Tipos de documento de transferencia', reglas: 'J12', atributos: {} },
};

type Atributos = Record<string, string | number | boolean>;

// Devuelve los atributos limpios (solo las claves del grupo) o el mensaje de error.
export function validarAtributos(grupo: GrupoCatalogo, entrada: unknown): { atributos: Atributos | null } | { error: string } {
  const def = GRUPOS[grupo].atributos;
  const claves = Object.keys(def);
  if (entrada != null && (typeof entrada !== 'object' || Array.isArray(entrada))) {
    return { error: 'Los atributos deben ser un objeto' };
  }
  const datos = (entrada ?? {}) as Record<string, unknown>;
  const ajenas = Object.keys(datos).filter((k) => !claves.includes(k));
  if (ajenas.length) return { error: `Atributo no válido para este catálogo: ${ajenas.join(', ')}` };

  const limpio: Atributos = {};
  for (const [clave, a] of Object.entries(def)) {
    const v = datos[clave];
    const vacio = v === undefined || v === null || v === '';
    if (vacio) {
      if ('requerido' in a && a.requerido) return { error: `Falta "${a.etiqueta}"` };
      continue;
    }
    switch (a.tipo) {
      case 'opcion':
        if (typeof v !== 'string' || !a.opciones.includes(v)) return { error: `"${a.etiqueta}" debe ser ${a.opciones.join(', ')}` };
        limpio[clave] = v;
        break;
      case 'numero':
        if (typeof v !== 'number' || !Number.isFinite(v) || v < a.min || v > a.max) {
          return { error: `"${a.etiqueta}" debe ser un número entre ${a.min} y ${a.max}` };
        }
        limpio[clave] = v;
        break;
      case 'booleano':
        if (typeof v !== 'boolean') return { error: `"${a.etiqueta}" debe ser sí o no` };
        limpio[clave] = v;
        break;
      case 'texto':
        if (typeof v !== 'string' || v.trim().length > a.max) return { error: `"${a.etiqueta}" tiene máximo ${a.max} caracteres` };
        limpio[clave] = v.trim();
        break;
    }
  }
  return { atributos: Object.keys(limpio).length ? limpio : null };
}

// ---- ReglaMuni ----

export type DefRegla =
  | { tipo: 'codigos'; grupo: GrupoCatalogo }
  | { tipo: 'opcion'; opciones: readonly string[] }
  | { tipo: 'booleano' }
  | { tipo: 'cuotas' }
  | { tipo: 'ubigeo' };

export interface DefReglaMuni {
  regla: string;
  descripcion: string;
  def: DefRegla;
  defecto: unknown;
}

export const INICIO_AFECTACION_ARBITRIOS = ['MES_DEL_HECHO', 'MES_SIGUIENTE'] as const;

// Valores nacionales por defecto. Ninguna de estas reglas la fija la ley: cada muni las ajusta
// según su ordenanza (docs/rentas/reglas-negocio.md, "Cómo se decide qué regla aplicar").
export const REGLAS_MUNI: Record<string, DefReglaMuni> = {
  // El distrito propio no lo fija una ordenanza, pero es un dato de cada base (no un if por muni):
  // decide qué domicilio es "del distrito" (catálogo de direcciones) y cuál es foráneo (P11).
  'muni.ubigeo': {
    regla: 'P11',
    descripcion: 'Ubigeo del distrito de la municipalidad: sus direcciones van al catálogo de direcciones únicas.',
    def: { tipo: 'ubigeo' },
    defecto: '150129',
  },
  'dj.motivosReabribles': {
    regla: 'J05',
    descripcion: 'Motivos de DJ que se pueden reabrir (de LIQUIDADA a PENDIENTE).',
    def: { tipo: 'codigos', grupo: G.MOTIVO_DJ },
    defecto: ['INSCRIPCION', 'COMPRA', 'MODIFICACION', 'ACTUALIZACION_DATOS'],
  },
  'arbitrios.inicioAfectacion': {
    regla: 'J11',
    descripcion: 'Mes desde el que afectan los arbitrios tras una adquisición o un nuevo uso.',
    def: { tipo: 'opcion', opciones: INICIO_AFECTACION_ARBITRIOS },
    defecto: 'MES_SIGUIENTE',
  },
  'dj.prorrogaPresentacion': {
    regla: 'J16',
    descripcion: 'Se permite registrar prórrogas de presentación de DJ (se aprueban o rechazan).',
    def: { tipo: 'booleano' },
    defecto: true,
  },
  'arbitrios.cuotas': {
    regla: 'L07',
    descripcion: 'Meses que agrupa cada cuota de arbitrios (por defecto, 4 trimestrales).',
    def: { tipo: 'cuotas' },
    defecto: [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
    ],
  },
};

// Cuotas de arbitrios (L07): cada mes 1..12 una sola vez, en orden y sin huecos entre cuotas.
export function errorCuotas(valor: unknown): string | null {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > 12) return 'Indica de 1 a 12 cuotas';
  let esperado = 1;
  for (const [i, cuota] of valor.entries()) {
    if (!Array.isArray(cuota) || cuota.length === 0) return `La cuota ${i + 1} no tiene meses`;
    for (const mes of cuota) {
      if (mes !== esperado) return `Los meses deben ir del 1 al 12, en orden y sin repetirse (cuota ${i + 1})`;
      esperado += 1;
    }
  }
  return esperado === 13 ? null : 'Las cuotas deben cubrir los 12 meses';
}

// Valida la forma del valor. Los códigos de un catálogo los comprueba el servicio contra la base.
export function errorValorRegla(clave: string, valor: unknown): string | null {
  const def = REGLAS_MUNI[clave]?.def;
  if (!def) return 'Regla no válida';
  switch (def.tipo) {
    case 'codigos':
      if (!Array.isArray(valor) || valor.some((c) => typeof c !== 'string' || !c.trim())) return 'Indica una lista de códigos';
      if (new Set(valor).size !== valor.length) return 'Hay códigos repetidos';
      return null;
    case 'opcion':
      return typeof valor === 'string' && def.opciones.includes(valor) ? null : `El valor debe ser ${def.opciones.join(', ')}`;
    case 'booleano':
      return typeof valor === 'boolean' ? null : 'El valor debe ser sí o no';
    case 'cuotas':
      return errorCuotas(valor);
    case 'ubigeo':
      return typeof valor === 'string' && /^\d{6}$/.test(valor) ? null : 'El ubigeo tiene 6 dígitos';
  }
}
