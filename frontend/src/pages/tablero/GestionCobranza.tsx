import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatearFecha } from './auditoriaFormato'
import { mensajeError } from './cobranzaApi'
import { BarraProbabilidades, EtiquetaEstado, EtiquetaGrupo, LeyendaGrupos } from './CobranzaPiezas'
import {
  ESTADOS,
  ESTADO_TEXTO,
  nombreUsuario,
  requiereObservacion,
  soles,
  type EstadoGestion,
  type Gestion,
  type Puntaje,
} from './cobranzaFormato'
import { Dialogo } from './Dialogo'

const RUTA_FICHA = '/rentas/registro-tributario/contribuyentes'
const campoClase =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-3 focus-visible:outline-turquesa'

// P6: detalle del contribuyente en la lista + historial de gestión (solo inserción).
export function GestionCobranza({
  puntaje,
  onClose,
  onRegistrado,
}: {
  puntaje: Puntaje
  onClose: () => void
  onRegistrado: () => void
}) {
  const [historial, setHistorial] = useState<Gestion[] | null>(null)
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoGestion>(
    puntaje.estadoGestion === 'PENDIENTE' ? 'CONTACTADO' : puntaje.estadoGestion,
  )
  const [observacion, setObservacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .get<Gestion[]>('/cobranza/gestiones', { params: { anio: puntaje.anio, codigo: puntaje.codigoLegacy } })
      .then(({ data }) => !cancelled && setHistorial(data))
      .catch((err) => !cancelled && setErrorHistorial(mensajeError(err)))
    return () => {
      cancelled = true
    }
  }, [puntaje.anio, puntaje.codigoLegacy, refreshKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (requiereObservacion(estado) && !observacion.trim()) {
      setError(
        estado === 'COMPROMISO'
          ? 'Indica en la observación la fecha y el monto del compromiso de pago.'
          : 'Indica en la observación dónde y cuándo se buscó al contribuyente.',
      )
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await api.post('/cobranza/gestiones', {
        anio: puntaje.anio,
        codigo: puntaje.codigoLegacy,
        estado,
        observacion: observacion.trim() || undefined,
      })
      setObservacion('')
      setRefreshKey((k) => k + 1)
      onRegistrado()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const c = puntaje.contribuyente
  const datos: [string, string][] = [
    ['Prioridad', `${puntaje.prioridad.toLocaleString('es-PE')} · tramo ${puntaje.tramo}`],
    ['Deuda del año', soles(puntaje.deudaAnio)],
    ['Deuda anterior', soles(puntaje.deudaPendiente)],
    ['Deuda esperada no recuperada', soles(puntaje.deudaEsperada)],
  ]

  return (
    <Dialogo
      titulo={
        <>
          {c ? c.nombreCompleto : `SIMUN ${puntaje.codigoLegacy}`}
          <span className="block font-sans text-sm font-normal text-tinta-suave">
            {c ? `SIMUN ${puntaje.codigoLegacy}${c.numDoc ? ` · ${c.tipoDoc} ${c.numDoc}` : ''}` : 'Sin ficha en el sistema web'}
          </span>
        </>
      }
      onClose={onClose}
    >
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {datos.map(([etiqueta, valor]) => (
            <div key={etiqueta}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{etiqueta}</dt>
              <dd className="tabular-nums text-tinta">{valor}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-2 sm:w-48">
          <div className="flex flex-wrap items-center gap-2">
            <EtiquetaGrupo grupo={puntaje.grupo} />
            <EtiquetaEstado estado={puntaje.estadoGestion} />
          </div>
          <p className="text-xs text-slate-500">Probabilidad de no pagar</p>
          <BarraProbabilidades p={puntaje} />
          <LeyendaGrupos />
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-arena-suave px-3 py-2 text-sm text-tinta">
        <strong>Acción sugerida:</strong> {puntaje.accion}
      </p>
      {c && (
        <Link
          to={`${RUTA_FICHA}/${c.id}`}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-mar hover:underline focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-person-vcard" />
          Ver ficha y estado de cuenta
        </Link>
      )}

      <form onSubmit={handleSubmit} className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-bold text-mar-profundo">Registrar gestión</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-[14rem_1fr]">
          <div>
            <label htmlFor="g-estado" className="text-xs font-semibold text-slate-600">
              Resultado
            </label>
            <select
              id="g-estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoGestion)}
              className={campoClase}
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_TEXTO[e]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="g-obs" className="text-xs font-semibold text-slate-600">
              Observación {requiereObservacion(estado) ? '(obligatoria)' : '(opcional)'}
            </label>
            <textarea
              id="g-obs"
              rows={2}
              maxLength={500}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder={
                estado === 'COMPROMISO' ? 'Ej. Pagará S/ 500 el 15/12' : 'Ej. Se llamó al 987…, contestó el hijo'
              }
              className={campoClase}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-ladrillo/30 bg-ladrillo/5 px-3 py-2 text-sm font-medium text-ladrillo">
            {error}
          </p>
        )}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-50"
          >
            {enviando ? 'Guardando…' : 'Guardar gestión'}
          </button>
        </div>
      </form>

      <section aria-labelledby="hist-titulo" className="mt-4 border-t border-slate-100 pt-4">
        <h3 id="hist-titulo" className="text-sm font-bold text-mar-profundo">
          Historial
        </h3>
        {errorHistorial ? (
          <p role="alert" className="mt-2 text-sm text-ladrillo">
            {errorHistorial}
          </p>
        ) : !historial ? (
          <p role="status" className="mt-2 text-sm text-slate-500">
            Cargando…
          </p>
        ) : historial.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aún no se registró ninguna gestión.</p>
        ) : (
          <ol className="mt-2 max-h-56 space-y-2 overflow-y-auto">
            {historial.map((g) => (
              <li key={g.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <EtiquetaEstado estado={g.estado} />
                  <span className="text-xs text-slate-500">
                    {formatearFecha(g.createdAt)} · {nombreUsuario(g.creadoPor)}
                  </span>
                </div>
                {g.observacion && <p className="mt-1 text-slate-700">{g.observacion}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </Dialogo>
  )
}
