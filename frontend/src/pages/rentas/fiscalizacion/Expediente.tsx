import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { hoyLocal } from '../../../lib/fechas'
import { mensajeError } from '../maestros/maestrosApi'
import { direccion } from '../predios/tipos'
import { MODALIDADES, type Modalidad } from '../valores/valoresApi'
import {
  ESTILO_ESTADO,
  ETIQUETA_ESTADO,
  type Expediente as ExpedienteApi,
  RUTA_EXPEDIENTES,
  RUTA_FISCALIZACION,
  etiquetaTipo,
  useExpediente,
} from './fiscalizacionApi'

// Detalle del expediente (specs/rentas-fiscalizacion-v1.md, F1–F3): requerimiento de inspección con
// su notificación, ficha por predio y anulación. Con todas las fichas pasa a INSPECCIONADO.

const CAMPO = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ETIQUETA = 'block text-xs font-semibold uppercase tracking-wider text-slate-500'
const TARJETA = 'mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10'
const BOTON = 'rounded-md bg-mar-profundo px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'
const BOTON_SEC =
  'rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'

const editable = (e: ExpedienteApi) => e.estado === 'ABIERTO' || e.estado === 'INSPECCIONADO'

function Requerimiento({ expediente: e, alGuardar }: { expediente: ExpedienteApi; alGuardar: (x: ExpedienteApi) => void }) {
  const [editando, setEditando] = useState(!e.inspeccion && editable(e))
  const [fecha, setFecha] = useState(e.inspeccion?.fecha ?? '')
  const [hora, setHora] = useState(e.inspeccion?.hora ?? '09:00')
  const [notificado, setNotificado] = useState(!!e.notificacion)
  const [nFecha, setNFecha] = useState(e.notificacion?.fecha ?? hoyLocal())
  const [modalidad, setModalidad] = useState<Modalidad>(e.notificacion?.modalidad ?? 'PERSONAL')
  const [dni, setDni] = useState(e.notificacion?.dni ?? '')
  const [nombre, setNombre] = useState(e.notificacion?.nombre ?? '')
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function guardar() {
    if (!fecha || !hora) return setError('Indica la fecha y la hora de la inspección')
    setProcesando(true)
    setError(null)
    try {
      const { data } = await api.patch<ExpedienteApi>(`/rentas/fiscalizacion/expedientes/${e.id}/requerimiento`, {
        fechaInspeccion: fecha,
        horaInspeccion: hora,
        notificacion: notificado ? { fecha: nFecha, modalidad, dni: dni.trim() || undefined, nombre: nombre.trim() || undefined } : null,
      })
      alGuardar(data)
      setEditando(false)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setProcesando(false)
    }
  }

  return (
    <section aria-labelledby="req-titulo" className={TARJETA}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="req-titulo" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
          Requerimiento de inspección
        </h2>
        <div className="flex gap-2">
          {e.inspeccion && (
            <Link to={`${RUTA_EXPEDIENTES}/${e.id}/requerimiento`} className={BOTON_SEC}>
              <i aria-hidden="true" className="bi bi-printer mr-1" />
              Imprimir requerimiento
            </Link>
          )}
          {!editando && editable(e) && (
            <button type="button" onClick={() => setEditando(true)} className={BOTON_SEC}>
              {e.inspeccion ? 'Editar' : 'Programar'}
            </button>
          )}
        </div>
      </div>

      {!editando ? (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Inspección</dt>
          <dd>{e.inspeccion ? `${e.inspeccion.fecha} a las ${e.inspeccion.hora}` : 'Sin programar'}</dd>
          <dt className="text-slate-500">Notificación</dt>
          <dd>
            {e.notificacion
              ? `${e.notificacion.fecha} · ${MODALIDADES.find((m) => m.value === e.notificacion!.modalidad)?.label ?? e.notificacion.modalidad}${
                  e.notificacion.nombre ? ` · recibió ${e.notificacion.nombre} (${e.notificacion.dni})` : ''
                }`
              : 'Sin notificar'}
          </dd>
        </dl>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="req-fecha" className={ETIQUETA}>
                Fecha de la visita
              </label>
              <input id="req-fecha" type="date" min={e.fechaApertura} value={fecha} onChange={(x) => setFecha(x.target.value)} className={CAMPO} />
            </div>
            <div>
              <label htmlFor="req-hora" className={ETIQUETA}>
                Hora
              </label>
              <input id="req-hora" type="time" value={hora} onChange={(x) => setHora(x.target.value)} className={CAMPO} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notificado}
              onChange={(x) => setNotificado(x.target.checked)}
              className="h-4 w-4 accent-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
            />
            El requerimiento ya fue notificado
          </label>
          {notificado && (
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label htmlFor="req-nfecha" className={ETIQUETA}>
                  Fecha de notificación
                </label>
                <input id="req-nfecha" type="date" max={hoyLocal()} value={nFecha} onChange={(x) => setNFecha(x.target.value)} className={CAMPO} />
              </div>
              <div>
                <label htmlFor="req-modalidad" className={ETIQUETA}>
                  Modalidad
                </label>
                <select id="req-modalidad" value={modalidad} onChange={(x) => setModalidad(x.target.value as Modalidad)} className={CAMPO}>
                  {MODALIDADES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {modalidad === 'PERSONAL' && (
                <>
                  <div>
                    <label htmlFor="req-dni" className={ETIQUETA}>
                      DNI / CE de quien recibe
                    </label>
                    <input id="req-dni" maxLength={12} value={dni} onChange={(x) => setDni(x.target.value)} className={CAMPO} />
                  </div>
                  <div>
                    <label htmlFor="req-nombre" className={ETIQUETA}>
                      Nombre de quien recibe
                    </label>
                    <input id="req-nombre" maxLength={100} value={nombre} onChange={(x) => setNombre(x.target.value)} className={CAMPO} />
                  </div>
                </>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {e.inspeccion && (
              <button type="button" onClick={() => setEditando(false)} disabled={procesando} className={BOTON_SEC}>
                Cancelar
              </button>
            )}
            <button type="button" onClick={() => void guardar()} disabled={procesando} className={BOTON}>
              {procesando ? 'Guardando…' : 'Guardar requerimiento'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Anulacion({ expediente: e, alAnular }: { expediente: ExpedienteApi; alAnular: (x: ExpedienteApi) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function anular() {
    if (motivo.trim().length < 10) return setError('Indica el motivo de la anulación (mínimo 10 caracteres)')
    setProcesando(true)
    setError(null)
    try {
      const { data } = await api.post<ExpedienteApi>(`/rentas/fiscalizacion/expedientes/${e.id}/anular`, { motivo: motivo.trim() })
      alAnular(data)
    } catch (err) {
      setError(mensajeError(err))
      setProcesando(false)
    }
  }

  if (!abierto) {
    return (
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          Anular expediente
        </button>
      </div>
    )
  }
  return (
    <section aria-labelledby="anular-titulo" className="mt-6 rounded-xl bg-white p-6 shadow-md ring-2 ring-red-300">
      <h2 id="anular-titulo" className="text-sm font-bold uppercase tracking-wider text-red-800">
        Anular expediente FIS {e.numero}
      </h2>
      <label htmlFor="anular-motivo" className={`mt-3 ${ETIQUETA}`}>
        Motivo
      </label>
      <textarea id="anular-motivo" rows={2} maxLength={200} value={motivo} onChange={(x) => setMotivo(x.target.value)} className={CAMPO} />
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setAbierto(false)} disabled={procesando} className={BOTON_SEC}>
          Volver
        </button>
        <button
          type="button"
          onClick={() => void anular()}
          disabled={procesando}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {procesando ? 'Anulando…' : 'Confirmar anulación'}
        </button>
      </div>
    </section>
  )
}

export function Expediente() {
  const { id } = useParams()
  const { expediente: e, setExpediente, error } = useExpediente(id)

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to={RUTA_FISCALIZACION}
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Fiscalización Tributaria
        </Link>

        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : !e ? (
          <p role="status" className="mt-4 text-sm text-slate-500">
            Cargando expediente…
          </p>
        ) : (
          <>
            <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Expediente de fiscalización</p>
                  <h1 className="font-mono text-xl font-bold text-mar-profundo">FIS {e.numero}</h1>
                  <p className="text-sm text-slate-600">
                    {etiquetaTipo(e.tipo)} · años {e.anioDesde === e.anioHasta ? e.anioDesde : `${e.anioDesde} a ${e.anioHasta}`}
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-sm font-semibold ${ESTILO_ESTADO[e.estado]}`}>{ETIQUETA_ESTADO[e.estado]}</span>
              </div>
              <dl className="mt-4 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
                <dt className="text-slate-500">Contribuyente</dt>
                <dd>
                  <span className="font-medium">{e.contribuyente.nombreCompleto}</span>{' '}
                  <span className="font-mono text-xs text-slate-500">
                    {e.contribuyente.tipoDoc} {e.contribuyente.numDoc}
                  </span>
                </dd>
                <dt className="text-slate-500">Fiscalizador</dt>
                <dd>{e.fiscalizador.nombre}</dd>
                <dt className="text-slate-500">Domicilio fiscal</dt>
                <dd>{e.contribuyente.direccionFiscal ?? '—'}</dd>
                <dt className="text-slate-500">Apertura</dt>
                <dd>
                  {e.fechaApertura}
                  {e.abiertoPor && ` · ${e.abiertoPor}`}
                </dd>
              </dl>
              {e.observacion && <p className="mt-3 text-sm text-slate-600">{e.observacion}</p>}
              {e.estado === 'ANULADO' && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">Anulado. Motivo: {e.motivoAnulacion}</p>
              )}
            </header>

            <Requerimiento key={`${e.inspeccion?.fecha}-${e.notificacion?.fecha}`} expediente={e} alGuardar={setExpediente} />

            <section aria-labelledby="predios-titulo" className={TARJETA}>
              <h2 id="predios-titulo" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
                Predios y fichas de inspección
              </h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {e.predios.map((p) => (
                  <li key={p.predioId} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-medium text-mar-profundo">{direccion(p.predio)}</span>
                      <span className="block text-xs text-slate-500">
                        Declarado: terreno {p.predio.areaTerreno ?? '—'} m², construido {p.predio.areaConstruida ?? '—'} m², {p.predio.pisos.length}{' '}
                        {p.predio.pisos.length === 1 ? 'piso' : 'pisos'}
                        {p.ficha &&
                          ` · Fiscalizado: terreno ${p.ficha.predio.areaTerreno} m², ${p.ficha.pisos.reduce((a, x) => a + Number(x.areaConstruida), 0).toFixed(2)} m² construidos`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {p.ficha ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">Ficha registrada</span>
                      ) : (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">Sin ficha</span>
                      )}
                      {editable(e) && (
                        <Link to={`${RUTA_EXPEDIENTES}/${e.id}/fichas/${p.predioId}`} className={BOTON_SEC}>
                          {p.ficha ? 'Editar ficha' : 'Registrar ficha'}
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {e.estado === 'INSPECCIONADO' && (
                <p role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Todas las fichas están registradas: el expediente queda listo para liquidar las diferencias.
                </p>
              )}
            </section>

            {editable(e) && <Anulacion expediente={e} alAnular={setExpediente} />}
          </>
        )}
      </div>
    </div>
  )
}
