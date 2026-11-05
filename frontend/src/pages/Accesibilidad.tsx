import { Link } from 'react-router-dom'
import { useAccesos } from '../context/AccesosContext'
import { PageHeader } from '../components/layout/PageHeader'

const OPCIONES = [
  {
    to: '/accesibilidad/usuarios',
    codigo: 'accesibilidad.usuarios',
    icono: 'bi bi-people',
    titulo: 'Gestión de Usuarios',
    descripcion: 'Usuarios internos del sistema.',
  },
  {
    to: '/accesibilidad/roles',
    codigo: 'accesibilidad.roles',
    icono: 'bi bi-person-badge',
    titulo: 'Roles',
    descripcion: 'Roles asignables a usuarios.',
  },
  {
    to: '/accesibilidad/niveles',
    codigo: 'accesibilidad.niveles',
    icono: 'bi bi-diagram-3',
    titulo: 'Niveles',
    descripcion: 'Acciones y funciones disponibles.',
  },
  {
    to: '/accesibilidad/accesos-por-rol',
    codigo: 'accesibilidad.accesos-por-rol',
    icono: 'bi bi-key',
    titulo: 'Accesos por Roles',
    descripcion: 'Niveles habilitados por rol.',
  },
] as const

export function Accesibilidad() {
  const { tiene, isLoading } = useAccesos()
  const visibles = OPCIONES.filter((opcion) => isLoading || tiene(opcion.codigo))
  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Accesibilidad"
          descripcion="Estructura visual. Funcionalidad pendiente."
          volverA={{ etiqueta: 'Inicio', ruta: '/' }}
        />

        <main className="mt-6 grid gap-4 sm:grid-cols-2">
          {visibles.length === 0 && !isLoading ? (
            <p className="rounded-panel border border-borde bg-white p-6 text-center text-sm text-slate-500 sm:col-span-2">
              Tu rol no tiene accesos asignados en este módulo.
            </p>
          ) : (
            visibles.map((opcion) => (
            <Link
              key={opcion.to}
              to={opcion.to}
              className="group rounded-panel border border-borde bg-white p-5 transition-colors duration-150 hover:bg-arena-suave focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-mar-profundo/5 text-xl text-mar"
              >
                <i className={opcion.icono} />
              </span>
              <h2 className="mt-3 font-serif font-semibold text-mar-profundo group-hover:text-mar">
                {opcion.titulo}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{opcion.descripcion}</p>
            </Link>
            ))
          )}
        </main>
      </div>
    </div>
  )
}
