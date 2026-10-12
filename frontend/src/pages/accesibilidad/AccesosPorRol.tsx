import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '../../lib/api'

interface RolResumen {
  id: number
  nombre: string
  descripcion: string | null
}

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

interface Matriz {
  roles: RolResumen[]
  modulos: ModuloNivel[]
  seleccion: { rolId: number; nivelIds: number[] } | null
}

function iguales(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

export function AccesosPorRol() {
  const [roles, setRoles] = useState<RolResumen[]>([])
  const [modulos, setModulos] = useState<ModuloNivel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedRolId, setSelectedRolId] = useState<number | null>(null)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [guardados, setGuardados] = useState<number[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [exito, setExito] = useState(false)

  function aplicarMatriz(data: Matriz) {
    setRoles(data.roles)
    setModulos(data.modulos)
    setSelectedRolId(data.seleccion?.rolId ?? null)
    setSeleccionados(data.seleccion?.nivelIds ?? [])
    setGuardados(data.seleccion?.nivelIds ?? [])
  }

  function mapearError(err: unknown, defecto: string) {
    if (isAxiosError(err) && err.response?.status === 401) {
      setError('Sesión vencida. Vuelve a ingresar.')
    } else if (isAxiosError(err) && err.response?.status === 403) {
      setError('Sin permisos para ver accesos.')
    } else if (isAxiosError(err) && err.response?.status === 404) {
      setError('El rol ya no existe.')
    } else {
      setError(defecto)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await api.get<Matriz>('/niveles/matriz')
        if (!cancelled) aplicarMatriz(data)
      } catch (err) {
        if (!cancelled) mapearError(err, 'No se pudo conectar con el servidor. Intenta nuevamente.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void cargar()
    return () => {
      cancelled = true
    }
  }, [])

  async function cambiarRol(rolId: number) {
    if (rolId === selectedRolId || isSaving) return
    setIsSwitching(true)
    setError(null)
    setExito(false)
    try {
      const { data } = await api.get<Matriz>('/niveles/matriz', { params: { rolId } })
      setRoles(data.roles)
      setModulos(data.modulos)
      setSelectedRolId(data.seleccion?.rolId ?? null)
      setSeleccionados(data.seleccion?.nivelIds ?? [])
      setGuardados(data.seleccion?.nivelIds ?? [])
    } catch (err) {
      mapearError(err, 'No se pudo cargar los accesos. Intenta nuevamente.')
    } finally {
      setIsSwitching(false)
    }
  }

  const modificado = !iguales(seleccionados, guardados)
  const rolSeleccionado = roles.find((r) => r.id === selectedRolId) ?? null

  function toggleModulo(modulo: ModuloNivel) {
    setExito(false)
    setSeleccionados((prev) => {
      const set = new Set(prev)
      const ids = [modulo.id, ...modulo.subniveles.map((s) => s.id)]
      const todos = ids.every((id) => set.has(id))
      if (todos) {
        ids.forEach((id) => set.delete(id))
      } else {
        ids.forEach((id) => set.add(id))
      }
      return [...set]
    })
  }

  function toggleSubnivel(modulo: ModuloNivel, sub: Subnivel) {
    setExito(false)
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

  async function handleGrabar() {
    if (selectedRolId === null || seleccionados.length === 0) return
    setError(null)
    setExito(false)
    setIsSaving(true)
    try {
      const { data } = await api.put<{ nivelIds: number[] }>(`/roles/${selectedRolId}/accesos`, {
        nivelIds: seleccionados,
      })
      setSeleccionados(data.nivelIds)
      setGuardados(data.nivelIds)
      setExito(true)
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const message = (err.response?.data as { message?: string | string[] } | undefined)?.message
        if (status === 404) {
          setError('El rol ya no existe.')
        } else if (status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
        } else if (status === 403) {
          setError('Sin permisos para asignar accesos.')
        } else if (status === 400 && message) {
          setError(Array.isArray(message) ? message[0] : message)
        } else {
          setError('No se pudo conectar con el servidor. Intenta nuevamente.')
        }
      } else {
        setError('No se pudo conectar con el servidor. Intenta nuevamente.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancelar() {
    setSeleccionados(guardados)
    setError(null)
    setExito(false)
  }

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
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
              <i className="bi bi-key" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Accesos por Roles</h1>
              <p className="text-sm text-slate-500">
                Único lugar donde se asignan niveles a los roles.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6">
          {isLoading ? (
            <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500 shadow-md ring-1 ring-mar-profundo/10" role="status">
              Cargando accesos…
            </p>
          ) : error && roles.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center shadow-md ring-1 ring-mar-profundo/10">
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
              <Link
                to="/"
                className="mt-3 inline-block text-sm font-medium text-mar hover:text-mar-profundo"
              >
                Volver al inicio
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <section
                aria-label="Roles"
                className="rounded-xl bg-white p-4 shadow-md ring-1 ring-mar-profundo/10"
              >
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-mar-profundo">
                  Roles
                </h2>
                <ul className="space-y-1">
                  {roles.map((rol) => {
                    const active = rol.id === selectedRolId
                    return (
                      <li key={rol.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          disabled={isSwitching || isSaving}
                          onClick={() => void cambiarRol(rol.id)}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-60 ${
                            active
                              ? 'bg-mar-profundo text-white'
                              : 'text-mar-profundo hover:bg-slate-100'
                          }`}
                        >
                          {rol.nombre}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section
                aria-label="Niveles del rol"
                className="rounded-xl bg-white p-4 shadow-md ring-1 ring-mar-profundo/10 sm:p-6"
              >
                <h2 className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
                  Niveles de {rolSeleccionado ? <span>{rolSeleccionado.nombre}</span> : '…'}
                </h2>
                <p className="mb-3 mt-1 text-xs text-slate-500">
                  Un subnivel exige su módulo asignado. Al desmarcar un módulo se quitan sus subniveles.
                </p>

                {isSwitching ? (
                  <p className="py-4 text-center text-sm text-slate-500" role="status">
                    Cargando accesos…
                  </p>
                ) : (
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
                )}

                {error && (
                  <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}
                {exito && (
                  <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700">
                    Accesos guardados. Aplican cuando cada usuario vuelva a ingresar.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!modificado || isSaving || isSwitching || seleccionados.length === 0}
                    onClick={handleGrabar}
                    title={seleccionados.length === 0 ? 'Selecciona al menos un nivel' : undefined}
                    className="rounded-lg bg-gradient-to-r from-mar-profundo to-mar px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    {isSaving ? 'Grabando…' : 'Grabar'}
                  </button>
                  <button
                    type="button"
                    disabled={!modificado || isSaving || isSwitching}
                    onClick={handleCancelar}
                    className="rounded-lg bg-slate-200 px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    Cancelar
                  </button>
                  {modificado && (
                    <span className="text-xs font-medium text-amber-600">
                      Tienes cambios sin grabar.
                    </span>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
