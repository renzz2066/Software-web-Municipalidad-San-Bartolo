import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'

interface RolDetalle {
  id: number
  nombre: string
  descripcion: string | null
}

export function EditarRol() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      try {
        const { data } = await api.get<RolDetalle>(`/roles/${id}`)
        if (cancelled) return
        setNombre(data.nombre)
        setDescripcion(data.descripcion ?? '')
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setIsSubmitting(true)
    try {
      await api.patch(`/roles/${id}`, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() === '' ? null : descripcion.trim(),
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
      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-content">
          <PageHeader
            titulo="Editar rol"
            volverA={{ etiqueta: 'Roles', ruta: '/accesibilidad/roles' }}
          />
          <div className="mx-auto mt-6 max-w-2xl rounded-panel border border-borde bg-white p-8 text-center">
            <p className="text-sm font-medium text-ladrillo">El rol no existe.</p>
            <Link
              to="/accesibilidad/roles"
              className="mt-3 inline-block text-sm font-medium text-mar hover:text-mar-profundo"
            >
              Volver al listado
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Editar rol"
          descripcion="Modifica los datos y pulsa Actualizar."
          volverA={{ etiqueta: 'Roles', ruta: '/accesibilidad/roles' }}
        />

        <main className="mx-auto mt-6 max-w-2xl rounded-panel border border-borde bg-white p-6 sm:p-8">
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

              <p className="mt-3 rounded-lg bg-mar/5 px-4 py-3 text-sm text-slate-600 ring-1 ring-mar/20">
                Los accesos se asignan en{' '}
                <Link
                  to="/accesibilidad/accesos-por-rol"
                  className="font-semibold text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  Accesos por Roles
                </Link>
                .
              </p>

              {error && (
                <p role="alert" className="rounded-lg border border-ladrillo/30 bg-ladrillo/5 px-3 py-2.5 text-sm font-medium text-ladrillo">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-gradient-to-r from-mar-profundo to-mar px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-turquesa"
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
