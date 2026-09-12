import { useAuth } from '../context/AuthContext'

export function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              Bienvenido, {user?.nombre}
            </h1>
            <p className="text-sm text-slate-500">Rol: {user?.rol}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
