// Esqueleto de módulos SIMUN (specs/modulos-esqueleto-v1.md).
// Los códigos deben coincidir con backend/src/niveles/niveles.catalogo.ts.
// Ruta del módulo: /<codigo>; ruta del submódulo: /<codigo>/<slug>.

export interface Submodulo {
  slug: string
  titulo: string
  icono: string
}

export interface Modulo {
  codigo: string
  titulo: string
  descripcion: string
  icono: string
  submodulos: Submodulo[]
}

export const MODULOS: Modulo[] = [
  {
    codigo: 'rentas',
    titulo: 'Rentas',
    descripcion: 'Registro tributario, recaudación y fiscalización.',
    icono: 'bi bi-house-door',
    submodulos: [
      { slug: 'registro-tributario', titulo: 'Registro Tributario', icono: 'bi bi-journal-text' },
      { slug: 'control-recaudacion', titulo: 'Control y Recaudación', icono: 'bi bi-graph-up-arrow' },
      { slug: 'fiscalizacion', titulo: 'Fiscalización Tributaria', icono: 'bi bi-search' },
      { slug: 'maestros', titulo: 'Maestros', icono: 'bi bi-table' },
      { slug: 'descargos', titulo: 'Descargos', icono: 'bi bi-file-earmark-minus' },
    ],
  },
  {
    codigo: 'licencias',
    titulo: 'Licencia de Funcionamiento',
    descripcion: 'Licencias y declaraciones juradas.',
    icono: 'bi bi-buildings',
    submodulos: [
      { slug: 'registro', titulo: 'Registro de Licencias/DDJJ', icono: 'bi bi-file-earmark-text' },
    ],
  },
  {
    codigo: 'coactivo',
    titulo: 'Cobranza Coactiva',
    descripcion: 'Expedientes y valores en cobranza coactiva.',
    icono: 'bi bi-hammer',
    submodulos: [
      { slug: 'recepcion', titulo: 'Recepción y Transferencias', icono: 'bi bi-inbox' },
      { slug: 'asignar-valores', titulo: 'Asignar Valores', icono: 'bi bi-person-check' },
      { slug: 'calificar-valores', titulo: 'Calificar Valores', icono: 'bi bi-check2-square' },
      { slug: 'expedientes', titulo: 'Gestión de Expedientes', icono: 'bi bi-folder2-open' },
      { slug: 'consultas', titulo: 'Consultas', icono: 'bi bi-search' },
      { slug: 'desafectacion', titulo: 'Desafectación de Valores', icono: 'bi bi-x-circle' },
      { slug: 'estado-cuenta', titulo: 'Estado de Cuenta Corriente', icono: 'bi bi-receipt' },
      { slug: 'maestros', titulo: 'Maestros', icono: 'bi bi-table' },
      { slug: 'configuracion', titulo: 'Unidad Responsable', icono: 'bi bi-gear' },
    ],
  },
  {
    codigo: 'caja',
    titulo: 'Caja',
    descripcion: 'Cobros, extornos y reportes de caja.',
    icono: 'bi bi-cash-coin',
    submodulos: [
      { slug: 'cancelaciones', titulo: 'Cancelaciones del Día', icono: 'bi bi-cash-stack' },
      { slug: 'extornos', titulo: 'Extorno', icono: 'bi bi-arrow-counterclockwise' },
      { slug: 'reportes', titulo: 'Reportes', icono: 'bi bi-bar-chart' },
    ],
  },
  {
    codigo: 'utilitarios',
    titulo: 'Utilitarios',
    descripcion: 'Herramientas de apoyo.',
    icono: 'bi bi-tools',
    submodulos: [{ slug: 'calculadora', titulo: 'Calculadora', icono: 'bi bi-calculator' }],
  },
  {
    codigo: 'multas',
    titulo: 'Multas Administrativas',
    descripcion: 'Registro de multas administrativas.',
    icono: 'bi bi-exclamation-octagon',
    submodulos: [{ slug: 'registro', titulo: 'Registro de Multas', icono: 'bi bi-file-earmark-text' }],
  },
  {
    codigo: 'tablero',
    titulo: 'Tablero Gerencial',
    descripcion: 'Indicadores para gerencia.',
    icono: 'bi bi-speedometer2',
    submodulos: [{ slug: 'resumen', titulo: 'Resumen', icono: 'bi bi-clipboard-data' }],
  },
]
