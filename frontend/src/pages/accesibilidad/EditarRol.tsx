import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '../../lib/api'

interface Subnivel {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
}

interface ModuloNivel {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  subniveles: Subnivel[]
}

interface RolDetalle {
  id: number
  nombre: string
  descripcion: string | null
  accesos: { nivelId: number }[]
}

export function EditarRol() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [modulos, setModulos] = useState<ModuloNivel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [seleccionados, setSeleccionados] = useState<number[]>([])

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      try {
        const [resRol, resNiveles] = await Promise.all([
          api.get<RolDetalle>(`/roles/${id}`),
          api.get<ModuloNivel[]>('/niveles'),
        ])
        if (cancelled) return
        const r = resRol.data
        setNombre(r.nombre)
        setDescripcion(r.descripcion ?? '')
        setSeleccionados(r.accesos.map((a) => a.nivelId))
        setModulos(resNiveles.data)
      } catch (err) {
        if (cancelled) return
        if (isAxiosError(err) && err.response?.status === 404) {
          setNotFound(true)
        } else if (isAxiosError(err) && err.response?.status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
        } else if (isAxiosError(err) && err.response?.status === 403) {
          setError('Sin permisos para editar roles.')
        } else {
          setError('No se pudo cargar el rol. Intenta nuevamente.')
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

  function toggleModulo(modulo: ModuloNivel) {
    setSeleccionados((prev) => {
      const set = new Set(prev)
      const ids = [modulo.id, ...modulo.subniveles.map((s) => s.id)]
      const todos = ids.every((nid) => set.has(nid))
      if (todos) {
        ids.forEach((nid) => set.delete(nid))
      } else {
        ids.forEach((nid) => set.add(nid))
      }
      return [...set]
    })
  }

  function toggleSubnivel(modulo: ModuloNivel, sub: Subnivel) {
    setSeleccionados((prev) => {
      const set = new Set(prev)
      if (set.has(sub.id)) {
        set.delete(sub.id)
      } else {
        // Regla jerárquica: el subnivel exige su módulo asignado
        set.add(sub.id)
        set.add(modulo.id)
      }
      return [...set]
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (seleccionados.length === 0) {
      setError('Selecciona al menos un nivel.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.patch(`/roles/${id}`, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() === '' ? null : descripcion.trim(),
        nivelIds: seleccionados,
      })
      navigate('/accesibilidad/roles', { replace: true })
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const message = (err.response?.data as { message?: string | string[] } | undefined)?.message
        if (status === 404) {
          setNotFound(true)
        } else if (status === 409) {
          setError('El rol ya existe.')
        } else if (status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
        } else if (status === 403) {
          setError('Sin permisos para editar roles.')
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
          <p className="text-sm font-medium text-slate-600">El rol no existe.</p>
          <Link
            to="/accesibilidad/roles"
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
          to="/accesibilidad/roles"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Roles
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
              <h1 className="text-lg font-bold text-mar-profundo">Editar rol</h1>
              <p className="text-sm text-slate-500">Modifica los datos y pulsa Actualizar.</p>
            </div>
          </div>
        </header>

        <main className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10 sm:p-8">
          {isLoading ? (
            <p className="py-4 text-center text-sm text-slate-500" role="status">
              Cargando rol…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="editar-rol-nombre" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                  Nombre
                </label>
                <input
                  id="editar-rol-nombre"
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="editar-rol-desc" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                  Descripción
                </label>
                <input
                  id="editar-rol-desc"
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className={inputClass}
                />
              </div>

              <fieldset>
                <legend className="mb-1 text-sm font-semibold text-mar-profundo">Niveles asignados</legend>
                <p className="mb-3 text-xs text-slate-500">
                  Un subnivel exige su módulo asignado. Al desmarcar un módulo se quitan sus subniveles.
                </p>
                <div className="space-y-3">
                  {modulos.map((modulo) => (
                    <div key={modulo.id} className="rounded-lg ring-1 ring-slate-200">
                      <label className="flex cursor-pointer items-center gap-3 bg-slate-50 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={seleccionados.includes(modulo.id)}
                          onChange={() => toggleModulo(modulo)}
                          className="h-4 w-4 accent-[#0a7ea4]"
                        />
                        <span className="text-sm font-bold text-mar-profundo">{modulo.nombre}</span>
                        <span className="rounded-md bg-mar-profundo px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          Módulo
                        </span>
                      </label>
                      <div className="space-y-1 px-4 py-3">
                        {modulo.subniveles.map((sub) => (
                          <label key={sub.id} className="flex cursor-pointer items-center gap-3 py-1 pl-6">
                            <input
                              type="checkbox"
                              checked={seleccionados.includes(sub.id)}
                              onChange={() => toggleSubnivel(modulo, sub)}
                              className="h-4 w-4 accent-[#0a7ea4]"
                            />
                            <span className="text-sm text-slate-700">{sub.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>

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
                  to="/accesibilidad/roles"
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
