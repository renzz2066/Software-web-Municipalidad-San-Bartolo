import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '../../lib/api'

interface RolOpcion {
  id: number
  nombre: string
  descripcion: string | null
}

interface UsuarioDetalle {
  id: number
  usuario: string
  nombres: string
  apellidos: string
  rol: { id: number; nombre: string }
  activo: boolean
}

export function EditarUsuario() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [roles, setRoles] = useState<RolOpcion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [usuario, setUsuario] = useState('')
  const [nombres, setNombres] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rolId, setRolId] = useState('')
  const [activo, setActivo] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      try {
        const [resUsuario, resRoles] = await Promise.all([
          api.get<UsuarioDetalle>(`/users/${id}`),
          api.get<RolOpcion[]>('/roles'),
        ])
        if (cancelled) return
        const u = resUsuario.data
        setUsuario(u.usuario)
        setNombres(u.nombres)
        setApellidos(u.apellidos)
        setRolId(String(u.rol.id))
        setActivo(u.activo)
        setRoles(resRoles.data)
      } catch (err) {
        if (cancelled) return
        if (isAxiosError(err) && err.response?.status === 404) {
          setNotFound(true)
        } else if (isAxiosError(err) && err.response?.status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
        } else if (isAxiosError(err) && err.response?.status === 403) {
          setError('Sin permisos para editar usuarios.')
        } else {
          setError('No se pudo cargar el usuario. Intenta nuevamente.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void cargar()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!usuario.trim() || !nombres.trim() || !apellidos.trim()) {
      setError('Completa usuario, nombres y apellidos.')
      return
    }
    const cambiaPassword = password !== '' || confirmPassword !== ''
    if (cambiaPassword) {
      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.')
        return
      }
    }
    if (!rolId) {
      setError('Selecciona un rol.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.patch(`/users/${id}`, {
        usuario: usuario.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        ...(cambiaPassword ? { password, confirmPassword } : {}),
        rolId: Number(rolId),
        activo,
      })
      navigate('/accesibilidad/usuarios', { replace: true })
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const message = (err.response?.data as { message?: string | string[] } | undefined)?.message
        if (status === 404) {
          setNotFound(true)
        } else if (status === 409) {
          setError('El usuario ya existe.')
        } else if (status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
        } else if (status === 403) {
          setError('Sin permisos para editar usuarios.')
        } else if (status === 400 && message) {
          setError(Array.isArray(message) ? message[0] : message)
        } else {
          setError('No se pudo conectar con el servidor. Intenta nuevamente.')
        }
      } else {
        setError('No se pudo conectar con el servidor. Intenta nuevamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-mar focus:ring-2 focus:ring-turquesa/40 focus-visible:outline-3 focus-visible:outline-turquesa'

  if (notFound) {
    return (
      <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
        <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 text-center shadow-md ring-1 ring-mar-profundo/10">
          <p className="text-sm font-medium text-slate-600">El usuario no existe.</p>
          <Link
            to="/accesibilidad/usuarios"
            className="mt-3 inline-block text-sm font-medium text-mar hover:text-mar-profundo"
          >
            Volver al listado
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/accesibilidad/usuarios"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Gestión de Usuarios
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-pencil-square" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Editar usuario</h1>
              <p className="text-sm text-slate-500">Modifica los datos y pulsa Actualizar.</p>
            </div>
          </div>
        </header>

        <main className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10 sm:p-8">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-slate-500" role="status">
              Cargando usuario…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="editar-usuario" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                  Usuario
                </label>
                <input
                  id="editar-usuario"
                  type="text"
                  required
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="editar-nombres" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                    Nombres
                  </label>
                  <input
                    id="editar-nombres"
                    type="text"
                    required
                    value={nombres}
                    onChange={(e) => setNombres(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="editar-apellidos" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                    Apellidos
                  </label>
                  <input
                    id="editar-apellidos"
                    type="text"
                    required
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="editar-password" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                    Contraseña
                  </label>
                  <input
                    id="editar-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Vacía para no cambiarla"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="editar-confirm" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                    Verificar contraseña
                  </label>
                  <input
                    id="editar-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Vacía para no cambiarla"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="editar-rol" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                  Rol
                </label>
                <select
                  id="editar-rol"
                  required
                  value={rolId}
                  onChange={(e) => setRolId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecciona un rol</option>
                  {roles.map((rol) => (
                    <option key={rol.id} value={rol.id} title={rol.descripcion ?? undefined}>
                      {rol.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                <label htmlFor="editar-activo" className="text-sm font-semibold text-mar-profundo">
                  Estado: {activo ? 'Activo' : 'Inactivo'}
                </label>
                <button
                  id="editar-activo"
                  type="button"
                  role="switch"
                  aria-checked={activo}
                  onClick={() => setActivo((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-3 focus-visible:outline-turquesa ${
                    activo ? 'bg-mar' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      activo ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-gradient-to-r from-mar-profundo to-mar px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  {isSubmitting ? 'Actualizando…' : 'Actualizar'}
                </button>
                <Link
                  to="/accesibilidad/usuarios"
                  className="rounded-lg bg-slate-200 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300 focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  Cancelar
                </Link>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}
