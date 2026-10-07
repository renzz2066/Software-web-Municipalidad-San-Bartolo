import { Link } from 'react-router-dom'

const OPCIONES = [
  {
    to: '/accesibilidad/usuarios',
    icono: 'bi bi-people',
    titulo: 'Gestión de Usuarios',
    descripcion: 'Usuarios internos del sistema.',
  },
  {
    to: '/accesibilidad/roles',
    icono: 'bi bi-person-badge',
    titulo: 'Roles',
    descripcion: 'Roles asignables a usuarios.',
  },
  {
    to: '/accesibilidad/niveles',
    icono: 'bi bi-diagram-3',
    titulo: 'Niveles',
    descripcion: 'Acciones y funciones disponibles.',
  },
  {
    to: '/accesibilidad/accesos-por-rol',
    icono: 'bi bi-key',
    titulo: 'Accesos por Roles',
    descripcion: 'Niveles habilitados por rol.',
  },
] as const

export function Accesibilidad() {
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Inicio
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-shield-lock" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Accesibilidad</h1>
              <p className="text-sm text-slate-500">
                Estructura visual. Funcionalidad pendiente.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 grid gap-4 sm:grid-cols-2">
          {OPCIONES.map((opcion) => (
            <Link
              key={opcion.to}
              to={opcion.to}
              className="group rounded-xl bg-white p-5 shadow-md ring-1 ring-mar-profundo/10 transition hover:shadow-lg hover:ring-mar/30 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-mar-profundo/5 text-xl text-mar"
              >
                <i className={opcion.icono} />
              </span>
              <h2 className="mt-3 font-semibold text-mar-profundo group-hover:text-mar">
                {opcion.titulo}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{opcion.descripcion}</p>
            </Link>
          ))}
        </main>
      </div>
    </div>
  )
}
