import { Link } from 'react-router-dom'

interface ModuloPlaceholderProps {
  icono: string
  titulo: string
  descripcion: string
}

export function ModuloPlaceholder({ icono, titulo, descripcion }: ModuloPlaceholderProps) {
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/accesibilidad"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Accesibilidad
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className={icono} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">{titulo}</h1>
              <p className="text-sm text-slate-500">{descripcion}</p>
            </div>
          </div>
        </header>

        <main className="mt-6 rounded-xl bg-white p-8 text-center shadow-md ring-1 ring-mar-profundo/10">
          <i aria-hidden="true" className="bi bi-cone-striped text-3xl text-slate-300" />
          <p className="mt-3 font-medium text-slate-600">Estructura visual</p>
          <p className="mt-1 text-sm text-slate-400">
            La funcionalidad de este módulo aún no está implementada.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
            >
              Nuevo
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
            >
              Buscar
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
