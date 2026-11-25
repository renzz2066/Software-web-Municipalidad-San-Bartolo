import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { aCsv, descargarCsv, nombreArchivo } from '../../lib/exportarCsv'
import { PageHeader } from '../../components/layout/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { formatearFecha } from './auditoriaFormato'
import { mensajeError } from './cobranzaApi'
import { BarraProbabilidades, EtiquetaEstado, EtiquetaGrupo, LeyendaGrupos } from './CobranzaPiezas'
import {
  ESTADOS,
  ESTADO_TEXTO,
  GRUPOS,
  GRUPO_BARRA,
  GRUPO_TEXTO,
  TRAMO_TEXTO,
  accionCorta,
  porcentaje,
  soles,
  type Puntaje,
  type Resumen,
} from './cobranzaFormato'
import { GestionCobranza } from './GestionCobranza'
import { ImportarPuntajes } from './ImportarPuntajes'

interface Pagina {
  items: Puntaje[]
  total: number
  page: number
  pageSize: number
  anio: number | null
}

const RUTA_FICHA = '/rentas/registro-tributario/contribuyentes'
const FILTROS = ['tramo', 'grupo', 'accion', 'estado', 'q'] as const
type Filtros = Record<(typeof FILTROS)[number], string>
const TAMANOS = [20, 50, 100]

const campoClase =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-3 focus-visible:outline-turquesa'

function leerFiltros(params: URLSearchParams): Filtros {
  return Object.fromEntries(FILTROS.map((f) => [f, params.get(f) ?? ''])) as Filtros
}

function entero(valor: string | null, porDefecto: number) {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : porDefecto
}

// Priorización de cobranza (specs/prediccion-cobranza-v1.md): lista del modelo de 3 grupos.
export function PriorizacionCobranza() {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'ADMIN'
  const [searchParams, setSearchParams] = useSearchParams()
  const [borrador, setBorrador] = useState<Filtros>(() => leerFiltros(searchParams))
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [pagina, setPagina] = useState<Pagina | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [seleccionado, setSeleccionado] = useState<Puntaje | null>(null)
  const [importando, setImportando] = useState(false)
  const [exportando, setExportando] = useState(false)

  const consulta = searchParams.toString()
  const page = entero(searchParams.get('page'), 1)
  const pageSize = TAMANOS.includes(entero(searchParams.get('pageSize'), 20))
    ? entero(searchParams.get('pageSize'), 20)
    : 20

  // La URL manda: F5 y "volver" reconstruyen el formulario
  const [consultaPrevia, setConsultaPrevia] = useState(consulta)
  if (consulta !== consultaPrevia) {
    setConsultaPrevia(consulta)
    setBorrador(leerFiltros(searchParams))
  }

  useEffect(() => {
    let cancelled = false
    api
      .get<Resumen>('/cobranza/resumen')
      .then(({ data }) => !cancelled && setResumen(data))
      .catch((err) => !cancelled && setError(mensajeError(err)))
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  function parametros(): Record<string, string | number> {
    const params = new URLSearchParams(consulta)
    const query: Record<string, string | number> = {}
    for (const f of FILTROS) {
      const valor = params.get(f)?.trim()
      if (valor) query[f] = valor
    }
    return query
  }

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await api.get<Pagina>('/cobranza/puntajes', { params: { ...parametros(), page, pageSize } })
        if (!cancelled) setPagina(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
    // parametros() deriva de `consulta`
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    irA({ ...borrador, q: borrador.q.trim(), page: '1' })
  }

  async function handleExportar() {
    setExportando(true)
    try {
      const { data } = await api.get<Puntaje[]>('/cobranza/puntajes/exportar', { params: parametros() })
      const filas = data.map((p) => ({
        ...p,
        nombre: p.contribuyente?.nombreCompleto ?? '',
        documento: p.contribuyente?.numDoc ?? '',
        grupoTexto: GRUPO_TEXTO[p.grupo],
        estadoTexto: ESTADO_TEXTO[p.estadoGestion],
      }))
      const num = (v: unknown) => String(v).replace('.', ',')
      const csv = aCsv(filas, [
        { clave: 'prioridad', titulo: 'Prioridad' },
        { clave: 'tramo', titulo: 'Tramo' },
        { clave: 'codigoLegacy', titulo: 'Código SIMUN' },
        { clave: 'nombre', titulo: 'Contribuyente' },
        { clave: 'documento', titulo: 'Documento' },
        { clave: 'grupoTexto', titulo: 'Grupo' },
        { clave: 'pPuntual', titulo: 'P. puntual', formato: num },
        { clave: 'pTardio', titulo: 'P. tardío', formato: num },
        { clave: 'pIncobrable', titulo: 'P. incobrable', formato: num },
        { clave: 'deudaAnio', titulo: 'Deuda del año', formato: num },
        { clave: 'deudaPendiente', titulo: 'Deuda anterior', formato: num },
        { clave: 'deudaEsperada', titulo: 'Deuda esperada', formato: num },
        { clave: 'accion', titulo: 'Acción sugerida' },
        { clave: 'estadoTexto', titulo: 'Gestión' },
      ])
      descargarCsv(nombreArchivo('priorizacion-cobranza', `-${pagina?.anio ?? ''}`), csv)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setExportando(false)
    }
  }

  const lote = resumen?.lote ?? null
  const totalPaginas = pagina ? Math.max(1, Math.ceil(pagina.total / pagina.pageSize)) : 1
  const totalLista = lote?.filas ?? 0
  const hayFiltros = FILTROS.some((f) => searchParams.get(f))

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Priorización de Cobranza"
          descripcion="A quién cobrar primero según el modelo de 3 grupos (Puntual, Tardío, Incobrable), ordenado por la deuda que se espera no recuperar."
          volverA={{ etiqueta: 'Tablero Gerencial', ruta: '/tablero' }}
          accion={esAdmin ? { etiqueta: 'Importar puntajes', icono: 'bi bi-upload', onClick: () => setImportando(true) } : undefined}
        />

        {resumen && !lote ? (
          <div className="mt-6 rounded-panel border border-borde bg-white p-10 text-center">
            <i aria-hidden="true" className="bi bi-sort-down text-3xl text-tinta-suave" />
            <p className="mt-2 text-sm text-tinta-suave">Todavía no se importó ninguna lista del modelo.</p>
            {esAdmin ? (
              <button
                type="button"
                onClick={() => setImportando(true)}
                className="mt-4 rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                Importar puntajes
              </button>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Pide a un administrador que la importe.</p>
            )}
          </div>
        ) : (
          <>
            {lote && resumen && <PanelResumen resumen={resumen} />}

            <details className="mt-4 rounded-panel border border-borde bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa">
                ¿Cómo leer esta lista?
              </summary>
              <div className="mt-3 space-y-2 text-sm text-tinta">
                <p>
                  El modelo estima, con lo que se sabía al 1 de enero, la probabilidad de que cada contribuyente sea{' '}
                  <strong>Puntual</strong> (paga con 90 días de atraso como máximo), <strong>Tardío</strong> (paga,
                  pero después de 90 días y antes de un año) o <strong>Incobrable</strong> (alguna cuota sigue
                  impaga al año de vencer).
                </p>
                <p>
                  <strong>Deuda esperada</strong> = probabilidad de ser incobrable × deuda del año × la parte que un
                  incobrable suele dejar sin pagar. La lista se ordena por esa cifra: arriba están quienes más dinero
                  harían perder si no se les gestiona. Por eso un contribuyente puntual con mucha deuda puede salir
                  arriba, con la acción &quot;Seguimiento preventivo&quot;.
                </p>
                <p>
                  <strong>Tramos:</strong> A = primer 5 % de la lista, B = del 5 % al 20 %, C = el resto. En las
                  pruebas de la tesis (2022-2023), gestionar solo los tramos A y B cubrió el 76-77 % de la deuda que
                  no se recuperó, frente al 70 % de la regla &quot;fue moroso el año anterior&quot; y al 20 % de elegir
                  al azar.
                </p>
                <LeyendaGrupos />
              </div>
            </details>

            <form
              onSubmit={handleBuscar}
              aria-label="Filtros de la lista"
              className="mt-4 rounded-panel border border-borde bg-white p-4 sm:p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label htmlFor="f-tramo" className="text-xs font-semibold text-slate-600">
                    Tramo
                  </label>
                  <select id="f-tramo" value={borrador.tramo} onChange={(e) => setBorrador({ ...borrador, tramo: e.target.value })} className={campoClase}>
                    <option value="">Todos</option>
                    {(['A', 'B', 'C'] as const).map((t) => (
                      <option key={t} value={t}>
                        {TRAMO_TEXTO[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="f-grupo" className="text-xs font-semibold text-slate-600">
                    Grupo
                  </label>
                  <select id="f-grupo" value={borrador.grupo} onChange={(e) => setBorrador({ ...borrador, grupo: e.target.value })} className={campoClase}>
                    <option value="">Todos</option>
                    {GRUPOS.map((g) => (
                      <option key={g} value={g}>
                        {GRUPO_TEXTO[g]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="f-accion" className="text-xs font-semibold text-slate-600">
                    Acción sugerida
                  </label>
                  <select id="f-accion" value={borrador.accion} onChange={(e) => setBorrador({ ...borrador, accion: e.target.value })} className={campoClase}>
                    <option value="">Todas</option>
                    {(resumen?.acciones ?? []).map((a) => (
                      <option key={a.accion} value={a.accion} title={a.accion}>
                        {accionCorta(a.accion)} ({a.contribuyentes.toLocaleString('es-PE')})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="f-estado" className="text-xs font-semibold text-slate-600">
                    Gestión
                  </label>
                  <select id="f-estado" value={borrador.estado} onChange={(e) => setBorrador({ ...borrador, estado: e.target.value })} className={campoClase}>
                    <option value="">Todas</option>
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {ESTADO_TEXTO[e]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="f-q" className="text-xs font-semibold text-slate-600">
                    Buscar
                  </label>
                  <input
                    id="f-q"
                    type="search"
                    maxLength={80}
                    placeholder="Código SIMUN, DNI o nombre"
                    value={borrador.q}
                    onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
                    className={campoClase}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSearchParams({ page: '1', pageSize: String(pageSize) })}
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

            <main className="mt-4 rounded-panel border border-borde bg-white">
              {isLoading && !pagina ? (
                <p className="p-8 text-center text-sm text-slate-500" role="status">
                  Cargando lista…
                </p>
              ) : error ? (
                <div className="p-8 text-center">
                  <p role="alert" className="text-sm font-medium text-ladrillo">
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
                <div className="p-8 text-center">
                  <i aria-hidden="true" className="bi bi-funnel text-2xl text-tinta-suave" />
                  <p className="mt-2 text-sm text-slate-500">Ningún contribuyente cumple esos filtros.</p>
                  {hayFiltros && (
                    <button
                      type="button"
                      onClick={() => setSearchParams({ page: '1', pageSize: String(pageSize) })}
                      className="mt-3 rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 focus-visible:outline-3 focus-visible:outline-turquesa"
                    >
                      Quitar filtros
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto" aria-busy={isLoading}>
                    <table className="w-full min-w-[860px] text-left text-sm">
                      <caption className="sr-only">
                        Lista de cobranza ordenada por prioridad. Pulsa Enter sobre una fila para ver el detalle y
                        registrar una gestión.
                      </caption>
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                          <th scope="col" className="px-4 py-3 text-right" title="Debajo, el tramo: A primer 5 %, B 5-20 %, C resto">
                            Prioridad
                          </th>
                          <th scope="col" className="px-3 py-3">Contribuyente</th>
                          <th scope="col" className="px-3 py-3">Grupo</th>
                          <th scope="col" className="px-3 py-3 text-right" title="Probabilidad de ser incobrable; la barra muestra los 3 grupos">
                            Prob. de no pagar
                          </th>
                          <th scope="col" className="px-3 py-3 text-right" title="Deuda emitida del año; debajo, la de años anteriores pendiente al 1 de enero">
                            Deuda del año
                          </th>
                          <th scope="col" className="px-3 py-3 text-right">Deuda esperada</th>
                          <th scope="col" className="px-3 py-3">Acción sugerida</th>
                          <th scope="col" className="px-4 py-3">Gestión</th>
                        </tr>
                      </thead>
                      <tbody className={isLoading ? 'opacity-60' : ''}>
                        {pagina.items.map((p) => (
                          <tr
                            key={p.id}
                            tabIndex={0}
                            onClick={() => setSeleccionado(p)}
                            onKeyDown={(e) => {
                              if (e.target !== e.currentTarget) return
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setSeleccionado(p)
                              }
                            }}
                            className="cursor-pointer border-b border-slate-100 align-top transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                          >
                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-tinta">
                              {p.prioridad.toLocaleString('es-PE')}
                              <p className="text-xs font-normal text-slate-500">tramo {p.tramo}</p>
                            </td>
                            <td className="min-w-44 max-w-64 px-3 py-3">
                              {p.contribuyente ? (
                                <>
                                  <Link
                                    to={`${RUTA_FICHA}/${p.contribuyente.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="font-medium text-mar hover:underline focus-visible:outline-3 focus-visible:outline-turquesa"
                                  >
                                    {p.contribuyente.nombreCompleto}
                                  </Link>
                                  <p className="font-mono text-xs text-slate-500">
                                    SIMUN {p.codigoLegacy}
                                    {p.contribuyente.numDoc ? ` · ${p.contribuyente.numDoc}` : ''}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="font-mono text-xs font-semibold text-tinta">SIMUN {p.codigoLegacy}</p>
                                  <p className="whitespace-nowrap text-xs text-slate-500">Sin ficha en el sistema web</p>
                                </>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <EtiquetaGrupo grupo={p.grupo} />
                            </td>
                            <td className="px-3 py-3">
                              <BarraProbabilidades p={p} />
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                              {soles(p.deudaAnio)}
                              {p.deudaPendiente > 0 && (
                                <p className="text-xs text-slate-500">+ {soles(p.deudaPendiente)} anterior</p>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-serif font-bold tabular-nums text-ladrillo">
                              {soles(p.deudaEsperada)}
                            </td>
                            <td className="max-w-40 px-3 py-3 text-xs text-slate-700" title={p.accion}>
                              {accionCorta(p.accion)}
                            </td>
                            <td className="px-4 py-3">
                              <EtiquetaEstado estado={p.estadoGestion} corto />
                              {p.ultimaGestionAt && (
                                <p className="mt-1 whitespace-nowrap text-xs text-slate-500">
                                  {formatearFecha(p.ultimaGestionAt).slice(0, 10)}
                                </p>
                              )}
                            </td>
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
                      {pagina.total.toLocaleString('es-PE')} de {totalLista.toLocaleString('es-PE')} contribuyentes · página {page} de {totalPaginas}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleExportar()}
                        disabled={exportando}
                        className="rounded-md border border-mar-profundo/30 px-3 py-1 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                      >
                        <i aria-hidden="true" className="bi bi-filetype-csv mr-1" />
                        {exportando ? 'Exportando…' : 'Exportar CSV'}
                      </button>
                      <label htmlFor="f-tamano" className="ml-2 text-xs font-semibold text-slate-600">
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
                        onClick={() => irA({ page: String(page - 1) })}
                        disabled={page <= 1}
                        className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => irA({ page: String(page + 1) })}
                        disabled={page >= totalPaginas}
                        className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                      >
                        Siguiente
                      </button>
                    </div>
                  </nav>
                </>
              )}
            </main>
          </>
        )}
      </div>

      {seleccionado && (
        <GestionCobranza
          puntaje={seleccionado}
          onClose={() => setSeleccionado(null)}
          onRegistrado={() => setRefreshKey((k) => k + 1)}
        />
      )}
      {importando && (
        <ImportarPuntajes
          onClose={() => setImportando(false)}
          onImportado={() => {
            setSearchParams({ page: '1', pageSize: String(pageSize) })
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

function Cifra({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-panel border border-borde bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{etiqueta}</p>
      <p className="mt-1 font-serif text-2xl font-bold tabular-nums text-mar-profundo">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-tinta-suave">{detalle}</p>}
    </div>
  )
}

// P4: resumen del lote vigente
function PanelResumen({ resumen }: { resumen: Resumen }) {
  const lote = resumen.lote!
  const porGrupo = resumen.porGrupo ?? []
  const total = lote.filas || 1
  const tramoAB = (resumen.porTramo ?? []).filter((t) => t.tramo !== 'C').reduce((s, t) => s + t.contribuyentes, 0)
  const gestionados = resumen.gestiones?.gestionados ?? 0
  const sinFicha = lote.filas - lote.enlazados

  return (
    <section aria-label="Resumen de la lista" className="mt-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          etiqueta={`Lista ${lote.anio}`}
          valor={lote.filas.toLocaleString('es-PE')}
          detalle={`contribuyentes · ${lote.modelo}`}
        />
        <Cifra
          etiqueta="Deuda esperada no recuperada"
          valor={soles(resumen.deudaEsperadaTotal ?? 0, 0)}
          detalle="si no se gestiona a nadie"
        />
        <Cifra
          etiqueta="Tramos A y B"
          valor={porcentaje(resumen.concentracionTop20 ?? 0)}
          detalle={`de esa deuda en ${tramoAB.toLocaleString('es-PE')} contribuyentes (20 %)`}
        />
        <Cifra
          etiqueta="Gestionados"
          valor={gestionados.toLocaleString('es-PE')}
          detalle={`${resumen.gestiones?.PAGO ?? 0} pagaron · ${resumen.gestiones?.COMPROMISO ?? 0} con compromiso`}
        />
      </div>

      <div className="rounded-panel border border-borde bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Grupo más probable</p>
          <p className="text-xs text-slate-500">
            Importado el {formatearFecha(lote.createdAt).slice(0, 10)} desde <span className="font-mono">{lote.archivo}</span>
          </p>
        </div>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={porGrupo.map((g) => `${GRUPO_TEXTO[g.grupo]}: ${g.contribuyentes}`).join(', ')}>
          {GRUPOS.map((g) => {
            const n = porGrupo.find((x) => x.grupo === g)?.contribuyentes ?? 0
            return <span key={g} className={GRUPO_BARRA[g]} style={{ width: `${(n / total) * 100}%` }} />
          })}
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {GRUPOS.map((g) => {
            const d = porGrupo.find((x) => x.grupo === g)
            return (
              <div key={g} className="flex items-start gap-2">
                <span aria-hidden="true" className={`mt-1.5 inline-block h-2 w-3 shrink-0 rounded-sm ${GRUPO_BARRA[g]}`} />
                <div>
                  <dt className="font-semibold text-tinta">
                    {GRUPO_TEXTO[g]}: {(d?.contribuyentes ?? 0).toLocaleString('es-PE')}{' '}
                    <span className="font-normal text-slate-500">({porcentaje((d?.contribuyentes ?? 0) / total, 0)})</span>
                  </dt>
                  <dd className="text-xs text-tinta-suave">Deuda esperada {soles(d?.deudaEsperada ?? 0, 0)}</dd>
                </div>
              </div>
            )
          })}
        </dl>
      </div>

      {sinFicha > 0 && (
        <p className="rounded-panel border border-aviso/30 bg-aviso-fondo px-4 py-3 text-sm text-aviso">
          <i aria-hidden="true" className="bi bi-info-circle mr-1" />
          {lote.enlazados.toLocaleString('es-PE')} de {lote.filas.toLocaleString('es-PE')} contribuyentes tienen ficha en
          el sistema web. Los otros {sinFicha.toLocaleString('es-PE')} aún no se migran desde SIMUN: se muestran con su
          código y se enlazan solos en cuanto se registre su ficha con ese código SIMUN.
        </p>
      )}
    </section>
  )
}
