import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-mar-profundo">
                Bienvenido, {user?.nombre}
              </h1>
              <p className="text-sm text-slate-500">Rol: {user?.rol}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-mar-profundo">
            Módulos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/accesibilidad"
              className="group rounded-xl bg-white p-5 shadow-md ring-1 ring-mar-profundo/10 transition hover:shadow-lg hover:ring-mar/30 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
                >
                  <i className="bi bi-shield-lock" />
                </span>
                <div>
                  <h3 className="font-semibold text-mar-profundo group-hover:text-mar">
                    Accesibilidad
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Usuarios, roles, niveles y accesos por rol.
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-mar">
                    Abrir módulo
                    <i aria-hidden="true" className="bi bi-arrow-right" />
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}
