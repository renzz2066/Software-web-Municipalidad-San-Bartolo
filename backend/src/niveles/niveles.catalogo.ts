import { TipoNivel } from '@prisma/client';

export interface NivelDef {
  codigo: string;
  tipo: TipoNivel;
  nombre: string;
  descripcion?: string;
  padre?: string;
  orden?: number;
}

// Expande un módulo y sus funcionalidades (orden = posición en la lista).
function modulo(
  codigo: string,
  nombre: string,
  descripcion: string,
  orden: number,
  hijos: [slug: string, nombre: string][],
): NivelDef[] {
  return [
    { codigo, tipo: TipoNivel.MODULO, nombre, descripcion, orden },
    ...hijos.map(([slug, nombreHijo], i) => ({
      codigo: `${codigo}.${slug}`,
      tipo: TipoNivel.FUNCIONALIDAD,
      nombre: nombreHijo,
      padre: codigo,
      orden: i + 1,
    })),
  ];
}

// Catálogo de niveles del sistema (2 capas: MODULO -> FUNCIONALIDAD).
// El sistema los registra automáticamente; no se crean a mano.
// Al agregar un módulo o funcionalidad nuevo, añade aquí su nodo.
export const NIVELES_CATALOGO: NivelDef[] = [
  {
    codigo: 'accesibilidad',
    tipo: TipoNivel.MODULO,
    nombre: 'Accesibilidad',
    descripcion: 'Usuarios, roles, niveles y accesos por rol.',
    orden: 8, // "Seguridad" en SIMUN
  },
  {
    codigo: 'accesibilidad.usuarios',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Gestión de Usuarios',
    descripcion: 'Administración de usuarios del sistema.',
    padre: 'accesibilidad',
    orden: 1,
  },
  {
    codigo: 'accesibilidad.roles',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Roles',
    descripcion: 'Roles asignables a los usuarios.',
    padre: 'accesibilidad',
    orden: 2,
  },
  {
    codigo: 'accesibilidad.niveles',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Niveles',
    descripcion: 'Catálogo de accesos del sistema.',
    padre: 'accesibilidad',
    orden: 3,
  },
  {
    codigo: 'accesibilidad.accesos-por-rol',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Accesos por Roles',
    descripcion: 'Niveles habilitados para cada rol.',
    padre: 'accesibilidad',
    orden: 4,
  },
  {
    codigo: 'accesibilidad.auditoria',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Auditoría',
    descripcion: 'Movimientos y sesiones registrados (solo ADMIN).',
    padre: 'accesibilidad',
    orden: 5,
  },

  // Esqueleto de módulos SIMUN (specs/modulos-esqueleto-v1.md): sin funciones aún.
  ...modulo('rentas', 'Rentas', 'Registro tributario, recaudación y fiscalización.', 1, [
    ['registro-tributario', 'Registro Tributario'],
    ['control-recaudacion', 'Control y Recaudación'],
    ['fiscalizacion', 'Fiscalización Tributaria'],
    ['maestros', 'Maestros'],
    ['descargos', 'Descargos'],
  ]),
  ...modulo('licencias', 'Licencia de Funcionamiento', 'Licencias y declaraciones juradas.', 2, [
    ['registro', 'Registro de Licencias/DDJJ'],
  ]),
  ...modulo('coactivo', 'Cobranza Coactiva', 'Expedientes y valores en cobranza coactiva.', 3, [
    ['recepcion', 'Recepción y Transferencias'],
    ['asignar-valores', 'Asignar Valores'],
    ['calificar-valores', 'Calificar Valores'],
    ['expedientes', 'Gestión de Expedientes'],
    ['consultas', 'Consultas'],
    ['desafectacion', 'Desafectación de Valores'],
    ['estado-cuenta', 'Estado de Cuenta Corriente'],
    ['maestros', 'Maestros'],
    ['configuracion', 'Unidad Responsable'],
  ]),
  ...modulo('caja', 'Caja', 'Cobros, extornos y reportes de caja.', 4, [
    ['cancelaciones', 'Cancelaciones del Día'],
    ['extornos', 'Extorno'],
    ['reportes', 'Reportes'],
  ]),
  ...modulo('utilitarios', 'Utilitarios', 'Herramientas de apoyo.', 5, [
    ['calculadora', 'Calculadora'],
  ]),
  ...modulo('multas', 'Multas Administrativas', 'Registro de multas administrativas.', 6, [
    ['registro', 'Registro de Multas'],
  ]),
  ...modulo('tablero', 'Tablero Gerencial', 'Indicadores para gerencia.', 7, [
    ['resumen', 'Resumen'],
  ]),
];
