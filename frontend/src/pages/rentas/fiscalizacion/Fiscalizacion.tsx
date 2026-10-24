import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { BuscadorContribuyente } from '../contribuyentes/BuscadorContribuyente'
import { mensajeError } from '../maestros/maestrosApi'
import { direccion } from '../predios/tipos'
import {
  ESTILO_ESTADO,
  ETIQUETA_ESTADO,
  type EstadoFiscalizacion,
  type Expediente,
  type ExpedienteListado,
  type OpcionesApertura,
  RUTA_EXPEDIENTES,
  TIPOS,
  type TipoFiscalizacion,
  etiquetaTipo,
} from './fiscalizacionApi'

// Rentas → Fiscalización Tributaria (specs/rentas-fiscalizacion-v1.md, F1): expedientes y apertura.
// Cada expediente sigue en su detalle: requerimiento, fichas de inspección y (fase C) resolución.

const CAMPO = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ETIQUETA = 'block text-xs font-semibold uppercase tracking-wider text-slate-500'
const ESTADOS = Object.keys(ETIQUETA_ESTADO) as EstadoFiscalizacion[]

function Apertura({ alCancelar }: { alCancelar: () => void }) {
  const navigate = useNavigate()
  const [contribuyenteId, setContribuyenteId] = useState<number | null>(null)
  const [opciones, setOpciones] = useState<OpcionesApertura | null>(null)
  const [tipo, setTipo] = useState<TipoFiscalizacion>('ORDINARIA')
  const [fiscalizadorId, setFiscalizadorId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [predios, setPredios] = useState<Set<number>>(new Set())
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (!contribuyenteId) return
    let cancelled = false
    async function cargar() {
      setError(null)
      setOpciones(null)
      try {
        const { data } = await api.get<OpcionesApertura>('/rentas/fiscalizacion/opciones', { params: { contribuyenteId } })
        if (cancelled) return
        setOpciones(data)
        setPredios(new Set(data.predios.map((p) => p.id)))
        const anios = data.aniosConParametros
        setDesde(String(anios[0] ?? ''))
        setHasta(String(anios[anios.length - 1] ?? ''))
        setFiscalizadorId(data.fiscalizadores.length === 1 ? String(data.fiscalizadores[0].id) : '')
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [contribuyenteId])

  async function abrir() {
    if (!fiscalizadorId) return setError('Elige el fiscalizador')
    if (predios.size === 0) return setError('Elige al menos un predio a fiscalizar')
    if (!desde || !hasta) return setError('No hay años con parámetros en Maestros para fiscalizar')
    if (Number(desde) > Number(hasta)) return setError('El año inicial no puede ser mayor que el final')
    setProcesando(true)
    setError(null)
    try {
      const { data } = await api.post<Expediente>('/rentas/fiscalizacion/expedientes', {
        tipo,
        contribuyenteId,
        fiscalizadorId: Number(fiscalizadorId),
        anioDesde: Number(desde),
        anioHasta: Number(hasta),
        predioIds: [...predios],
        observacion: observacion.trim() || undefined,
      })
      navigate(`${RUTA_EXPEDIENTES}/${data.id}`)
    } catch (err) {
      setError(mensajeError(err))
      setProcesando(false)
    }
  }

  const anios = opciones?.aniosConParametros ?? []
  return (
    <section aria-labelledby="apertura" className="mt-6 rounded-xl bg-white p-6 shadow-md ring-2 ring-mar">
      <h2 id="apertura" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
        Apertura de expediente
      </h2>
      {!opciones ? (
        <div className="mt-3 max-w-xl">
          <BuscadorContribuyente id="fis-contribuyente" label="Contribuyente a fiscalizar" alElegir={(c) => setContribuyenteId(c.id)} />
          {contribuyenteId && !error && (
            <p role="status" className="mt-2 text-sm text-slate-500">
              Cargando predios…
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <p className="text-sm">
            <span className="font-semibold text-mar-profundo">{opciones.contribuyente.nombreCompleto}</span>{' '}
            <span className="font-mono text-xs text-slate-500">
              {opciones.contribuyente.tipoDoc} {opciones.contribuyente.numDoc}
            </span>
            <button type="button" onClick={() => setOpciones(null)} className="ml-2 text-xs font-medium text-mar hover:underline">
              cambiar
            </button>
          </p>
          {opciones.sinDeclaracion && (
            <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              El contribuyente no tiene declaraciones juradas: se pueden fiscalizar hasta 6 años (Código Tributario art. 43).
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="fis-tipo" className={ETIQUETA}>
                Tipo
              </label>
              <select id="fis-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoFiscalizacion)} className={CAMPO}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fis-fiscalizador" className={ETIQUETA}>
                Fiscalizador
              </label>
              <select id="fis-fiscalizador" value={fiscalizadorId} onChange={(e) => setFiscalizadorId(e.target.value)} className={CAMPO}>
                <option value="">Selecciona…</option>
                {opciones.fiscalizadores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fis-desde" className={ETIQUETA}>
                Desde el año
              </label>
              <select id="fis-desde" value={desde} onChange={(e) => setDesde(e.target.value)} className={CAMPO}>
                {anios.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fis-hasta" className={ETIQUETA}>
                Hasta el año
              </label>
              <select id="fis-hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} className={CAMPO}>
                {anios.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Años no prescritos: {opciones.rango.desde}–{opciones.rango.hasta}. Solo se listan los que tienen UIT y escala predial en
            Maestros.
            {opciones.fiscalizadores.length === 0 && ' No hay fiscalizadores activos: regístralos en Maestros → Fiscalización.'}
          </p>
          <fieldset>
            <legend className={ETIQUETA}>Predios a fiscalizar</legend>
            {opciones.predios.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">El contribuyente no tiene predios activos.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {opciones.predios.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={predios.has(p.id)}
                        onChange={(e) =>
                          setPredios((s) => {
                            const n = new Set(s)
                            if (e.target.checked) n.add(p.id)
                            else n.delete(p.id)
                            return n
                          })
                        }
                        className="h-4 w-4 accent-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
                      />
                      {direccion({ ...p, urbanizacion: null })}
                      {p.usoPredio && <span className="text-xs text-slate-500">· {p.usoPredio}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <div>
            <label htmlFor="fis-obs" className={ETIQUETA}>
              Motivo u observación (opcional)
            </label>
            <textarea id="fis-obs" rows={2} maxLength={500} value={observacion} onChange={(e) => setObservacion(e.target.value)} className={CAMPO} />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={alCancelar}
          className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          Cancelar
        </button>
        {opciones && (
          <button
            type="button"
            onClick={() => void abrir()}
            disabled={procesando}
            className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
          >
            {procesando ? 'Abriendo…' : 'Abrir expediente'}
          </button>
        )}
      </div>
    </section>
  )
}

export function Fiscalizacion() {
  const [params, setParams] = useSearchParams()
  const estado = (params.get('estado') ?? '') as EstadoFiscalizacion | ''
  const [abriendo, setAbriendo] = useState(false)
  const [expedientes, setExpedientes] = useState<ExpedienteListado[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setError(null)
      try {
        const { data } = await api.get<ExpedienteListado[]>('/rentas/fiscalizacion/expedientes', { params: { estado: estado || undefined } })
        if (!cancelled) setExpedientes(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [estado])

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/rentas"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Rentas
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-search" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-mar-profundo">Fiscalización Tributaria</h1>
              <p className="text-sm text-slate-500">
                Expedientes de fiscalización de predios: requerimiento de inspección, ficha de lo verificado en campo y
                determinación de diferencias contra lo declarado.
              </p>
            </div>
            {!abriendo && (
              <button
                type="button"
                onClick={() => setAbriendo(true)}
                className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <i aria-hidden="true" className="bi bi-folder-plus mr-1" />
                Abrir expediente
              </button>
            )}
          </div>
        </header>

        {abriendo && <Apertura alCancelar={() => setAbriendo(false)} />}

        <main className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-mar-profundo">Expedientes</h2>
            <div>
              <label htmlFor="fis-estado" className={ETIQUETA}>
                Estado
              </label>
              <select
                id="fis-estado"
                value={estado}
                onChange={(e) => setParams(e.target.value ? { estado: e.target.value } : {})}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <option value="">Todos</option>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETA_ESTADO[e]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            {error ? (
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
            ) : !expedientes ? (
              <p role="status" className="text-sm text-slate-500">
                Cargando expedientes…
              </p>
            ) : expedientes.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-500">Sin expedientes.</p>
            ) : (
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Expedientes de fiscalización</caption>
                <thead>
                  <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-2 py-2">Expediente</th>
                    <th scope="col" className="px-2 py-2">Contribuyente</th>
                    <th scope="col" className="px-2 py-2">Años</th>
                    <th scope="col" className="px-2 py-2">Fiscalizador</th>
                    <th scope="col" className="px-2 py-2">Inspección</th>
                    <th scope="col" className="px-2 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {expedientes.map((x) => (
                    <tr key={x.id} className="border-b border-slate-100">
                      <td className="whitespace-nowrap px-2 py-1.5">
                        <Link
                          to={`${RUTA_EXPEDIENTES}/${x.id}`}
                          className="font-mono font-medium text-mar hover:text-mar-profundo hover:underline focus-visible:outline-3 focus-visible:outline-turquesa"
                        >
                          FIS {x.numero}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {etiquetaTipo(x.tipo)} · {x.fechaApertura}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        {x.contribuyente.nombreCompleto}
                        <span className="block font-mono text-xs text-slate-500">
                          {x.contribuyente.tipoDoc} {x.contribuyente.numDoc} · {x.predios} {x.predios === 1 ? 'predio' : 'predios'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {x.anioDesde === x.anioHasta ? x.anioDesde : `${x.anioDesde}–${x.anioHasta}`}
                      </td>
                      <td className="px-2 py-1.5">{x.fiscalizador}</td>
                      <td className="whitespace-nowrap px-2 py-1.5">{x.inspeccion ? `${x.inspeccion.fecha} ${x.inspeccion.hora}` : '—'}</td>
                      <td className="px-2 py-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[x.estado]}`}>{ETIQUETA_ESTADO[x.estado]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
