import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { api } from '../../lib/api'
import { AuditoriaDetalle, CeldaUsuario } from './AuditoriaDetalle'
import {
  ACCIONES,
  ACCION_ESTILO,
  ACCION_TEXTO,
  TABLAS_AUDITADAS,
  formatearFecha,
  rangoPorDefecto,
  type AuditoriaItem,
} from './auditoriaFormato'

interface UsuarioOpcion {
  id: number
  usuario: string
  nombres: string
  apellidos: string
  activo: boolean
}

interface Pagina {
  items: AuditoriaItem[]
  total: number
  page: number
  pageSize: number
}

const FILTROS = ['usuarioId', 'accion', 'tabla', 'desde', 'hasta', 'registroId'] as const
type Filtros = Record<(typeof FILTROS)[number], string>
const TAMANOS = [20, 50, 100]

function leerFiltros(params: URLSearchParams): Filtros {
  return Object.fromEntries(FILTROS.map((f) => [f, params.get(f) ?? ''])) as Filtros
}

function entero(valor: string | null, porDefecto: number) {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : porDefecto
}

const campoClase =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-3 focus-visible:outline-turquesa'

export function Auditoria() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [borrador, setBorrador] = useState<Filtros>(() => leerFiltros(searchParams))
  const [errorFiltro, setErrorFiltro] = useState<string | null>(null)
  const [pagina, setPagina] = useState<Pagina | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [usuarios, setUsuarios] = useState<UsuarioOpcion[] | null>(null)
  const [seleccionado, setSeleccionado] = useState<AuditoriaItem | null>(null)

  const consulta = searchParams.toString()
  const page = entero(searchParams.get('page'), 1)
  const pageSize = TAMANOS.includes(entero(searchParams.get('pageSize'), 20))
    ? entero(searchParams.get('pageSize'), 20)
    : 20

  // D6: al entrar sin nada en la URL, últimos 7 días. "Limpiar" deja `page=1`, así no se reaplica.
  useEffect(() => {
    if (consulta === '') {
      setSearchParams({ ...rangoPorDefecto(), page: '1' }, { replace: true })
    }
  }, [consulta, setSearchParams])

  // La URL manda: F5 y "volver" reconstruyen el formulario (ajuste en render, sin effect)
  const [consultaPrevia, setConsultaPrevia] = useState(consulta)
  if (consulta !== consultaPrevia) {
    setConsultaPrevia(consulta)
    setBorrador(leerFiltros(searchParams))
  }

  // Si falla (sin nivel de usuarios), el filtro cae a un campo numérico
  useEffect(() => {
    api
      .get<UsuarioOpcion[]>('/users')
      .then(({ data }) => setUsuarios(data))
      .catch(() => setUsuarios(null))
  }, [])

  useEffect(() => {
    if (consulta === '') return
    let cancelled = false
    const params = new URLSearchParams(consulta)

    async function cargar() {
      setIsLoading(true)
      setError(null)
      try {
        const query: Record<string, string | number> = { page, pageSize }
        for (const f of FILTROS) {
          const valor = params.get(f)?.trim()
          if (valor) query[f] = valor
        }
        const { data } = await api.get<Pagina>('/auditoria', { params: query })
        if (!cancelled) setPagina(data)
      } catch (err) {
        if (cancelled) return
        const status = isAxiosError(err) ? err.response?.status : undefined
        const message = isAxiosError(err)
          ? (err.response?.data as { message?: string | string[] } | undefined)?.message
          : undefined
        if (status === 400 && message) {
          setError(Array.isArray(message) ? message[0] : message)
        } else if (status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
        } else if (status === 403) {
          setError('Solo administradores pueden ver la auditoría.')
        } else {
          setError('No se pudo conectar con el servidor. Intenta nuevamente.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void cargar()
    return () => {
      cancelled = true
    }
  }, [consulta, page, pageSize, refreshKey])

  function irA(cambios: Record<string, string>) {
    const params = new URLSearchParams(consulta)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor)
      else params.delete(clave)
    }
    setSearchParams(params)
  }

  function handleBuscar(event: FormEvent) {
    event.preventDefault()
    if (borrador.desde && borrador.hasta && borrador.desde > borrador.hasta) {
      setErrorFiltro('La fecha "Desde" no puede ser posterior a "Hasta".')
      return
    }
    setErrorFiltro(null)
    irA({ ...borrador, registroId: borrador.registroId.trim(), page: '1' })
  }

  function handleLimpiar() {
    setErrorFiltro(null)
    setSearchParams({ page: '1', pageSize: String(pageSize) })
  }

  function actualizar(campo: keyof Filtros, valor: string) {
    setBorrador((b) => ({ ...b, [campo]: valor }))
  }

  const totalPaginas = pagina ? Math.max(1, Math.ceil(pagina.total / pagina.pageSize)) : 1

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
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
              <i className="bi bi-journal-text" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Auditoría</h1>
              <p className="text-sm text-slate-500">
                Movimientos de datos y sesiones registrados. Solo lectura.
              </p>
            </div>
          </div>
        </header>

        <form
          onSubmit={handleBuscar}
          aria-label="Filtros de auditoría"
          className="mt-6 rounded-xl bg-white p-4 shadow-md ring-1 ring-mar-profundo/10 sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="f-usuario" className="text-xs font-semibold text-slate-600">
                Usuario
              </label>
              {usuarios ? (
                <select
                  id="f-usuario"
                  value={borrador.usuarioId}
                  onChange={(e) => actualizar('usuarioId', e.target.value)}
                  className={campoClase}
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {`${u.nombres} ${u.apellidos}`.trim()} ({u.usuario})
                      {u.activo ? '' : ' (inactivo)'}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="f-usuario"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="ID de usuario"
                  value={borrador.usuarioId}
                  onChange={(e) => actualizar('usuarioId', e.target.value)}
                  className={campoClase}
                />
              )}
            </div>
            <div>
              <label htmlFor="f-accion" className="text-xs font-semibold text-slate-600">
                Acción
              </label>
              <select
                id="f-accion"
                value={borrador.accion}
                onChange={(e) => actualizar('accion', e.target.value)}
                className={campoClase}
              >
                <option value="">Todas</option>
                {ACCIONES.map((a) => (
                  <option key={a} value={a}>
                    {ACCION_TEXTO[a]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-tabla" className="text-xs font-semibold text-slate-600">
                Tabla
              </label>
              <select
                id="f-tabla"
                value={borrador.tabla}
                onChange={(e) => actualizar('tabla', e.target.value)}
                className={campoClase}
              >
                <option value="">Todas</option>
                {TABLAS_AUDITADAS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-desde" className="text-xs font-semibold text-slate-600">
                Desde
              </label>
              <input
                id="f-desde"
                type="date"
                value={borrador.desde}
                onChange={(e) => actualizar('desde', e.target.value)}
                className={campoClase}
              />
            </div>
            <div>
              <label htmlFor="f-hasta" className="text-xs font-semibold text-slate-600">
                Hasta
              </label>
              <input
                id="f-hasta"
                type="date"
                value={borrador.hasta}
                onChange={(e) => actualizar('hasta', e.target.value)}
                className={campoClase}
              />
            </div>
            <div>
              <label htmlFor="f-registro" className="text-xs font-semibold text-slate-600">
                ID de registro
              </label>
              <input
                id="f-registro"
                type="text"
                maxLength={50}
                placeholder="Ej. 3 o 1:12"
                value={borrador.registroId}
                onChange={(e) => actualizar('registroId', e.target.value)}
                className={campoClase}
              />
            </div>
          </div>

          {errorFiltro && (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {errorFiltro}
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={handleLimpiar}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Limpiar
            </button>
            <button
              type="submit"
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <i aria-hidden="true" className="bi bi-search mr-1" />
              Buscar
            </button>
          </div>
        </form>

        <main className="mt-6 rounded-xl bg-white shadow-md ring-1 ring-mar-profundo/10">
          {isLoading && !pagina ? (
            <p className="p-8 text-center text-sm text-slate-500" role="status">
              Cargando auditoría…
            </p>
          ) : error ? (
            <div className="p-8 text-center">
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="mt-3 rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                Reintentar
              </button>
            </div>
          ) : !pagina || pagina.items.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Sin movimientos con esos filtros.</p>
          ) : (
            <>
              <div className="overflow-x-auto" aria-busy={isLoading}>
                <table className="w-full min-w-[860px] text-left text-sm">
                  <caption className="sr-only">
                    Registros de auditoría. Pulsa Enter sobre una fila para ver el detalle.
                  </caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      {['Fecha', 'Usuario', 'Acción', 'Tabla', 'Registro', 'Módulo', 'IP'].map((t) => (
                        <th key={t} scope="col" className="px-4 py-3">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={isLoading ? 'opacity-60' : ''}>
                    {pagina.items.map((item) => (
                      <tr
                        key={item.id}
                        tabIndex={0}
                        onClick={() => setSeleccionado(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSeleccionado(item)
                          }
                        }}
                        className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatearFecha(item.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <CeldaUsuario item={item} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACCION_ESTILO[item.accion]}`}
                          >
                            {ACCION_TEXTO[item.accion] ?? item.accion}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.tabla}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.registroId ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{item.modulo ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.ip ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <nav
                aria-label="Paginación"
                className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600"
              >
                <p aria-live="polite">
                  {pagina.total} {pagina.total === 1 ? 'registro' : 'registros'} · página {page} de{' '}
                  {totalPaginas}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="f-tamano" className="text-xs font-semibold text-slate-600">
                    Por página
                  </label>
                  <select
                    id="f-tamano"
                    value={pageSize}
                    onChange={(e) => irA({ pageSize: e.target.value, page: '1' })}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    {TAMANOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={page <= 1 || isLoading}
                    onClick={() => irA({ page: String(page - 1) })}
                    className="rounded-md bg-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    <i aria-hidden="true" className="bi bi-chevron-left mr-1" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPaginas || isLoading}
                    onClick={() => irA({ page: String(page + 1) })}
                    className="rounded-md bg-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    Siguiente
                    <i aria-hidden="true" className="bi bi-chevron-right ml-1" />
                  </button>
                </div>
              </nav>
            </>
          )}
        </main>

        {seleccionado && (
          <AuditoriaDetalle item={seleccionado} onClose={() => setSeleccionado(null)} />
        )}
      </div>
    </div>
  )
}
