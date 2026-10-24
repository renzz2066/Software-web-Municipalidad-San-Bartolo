import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { hoyLocal } from '../../../lib/fechas'
import { mensajeError } from '../maestros/maestrosApi'
import { direccion } from '../predios/tipos'
import { soles } from '../contribuyentes/tipos'
import { MODALIDADES, type Modalidad } from '../valores/valoresApi'
import {
  ESTILO_ESTADO,
  ETIQUETA_ESTADO,
  type Expediente as ExpedienteApi,
  type Liquidacion,
  RUTA_EXPEDIENTES,
  RUTA_FISCALIZACION,
  RUTA_VALORES_FISCALIZACION,
  etiquetaTipo,
  useExpediente,
} from './fiscalizacionApi'

// Detalle del expediente (specs/rentas-fiscalizacion-v1.md, F1–F5): requerimiento de inspección con
// su notificación, ficha por predio y anulación. Con todas las fichas pasa a INSPECCIONADO; entonces
// se liquida (simular) y se resuelve: diferencias en cuenta corriente y RD de fiscalización.

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

function TablaLiquidacion({ liquidacion: l }: { liquidacion: Liquidacion }) {
  return (
    <div className="space-y-4">
      {l.anios.map((a) => (
        <div key={a.anio} className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="pb-1 text-left text-xs font-bold uppercase tracking-wider text-mar-profundo">
              Año {a.anio}
              {a.baseFiscalizada && <span className="ml-2 font-normal normal-case text-slate-500">base imponible fiscalizada {soles(a.baseFiscalizada)}</span>}
            </caption>
            <thead>
              <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-2 py-1.5">Tributo</th>
                <th scope="col" className="px-2 py-1.5 text-right">Declarado</th>
                <th scope="col" className="px-2 py-1.5 text-right">Fiscalizado</th>
                <th scope="col" className="px-2 py-1.5 text-right">Omitido</th>
              </tr>
            </thead>
            <tbody>
              {a.porTributo.map((t) => (
                <tr key={t.tributo} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">{t.tributo}</td>
                  <td className="px-2 py-1.5 text-right">{soles(t.declarado)}</td>
                  <td className="px-2 py-1.5 text-right">{soles(t.fiscalizado)}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${Number(t.omitido) > 0 ? 'text-red-700' : 'text-slate-500'}`}>
                    {soles(t.omitido)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Number(a.declaradoSinCalcular ?? 0) > 0 && (
            <p className="mt-1 text-xs text-slate-600">
              Lo declarado incluye {soles(a.declaradoSinCalcular!)} que aún no estaban en la cuenta corriente (predios declarados sin
              calcular): al resolver suben sin RD ni multa.
            </p>
          )}
          {a.disminuciones.length > 0 && (
            <p className="mt-1 text-xs text-amber-800">
              {a.disminuciones.length} {a.disminuciones.length === 1 ? 'cuota resulta' : 'cuotas resultan'} menor(es) que lo declarado: no se
              rebaja aquí, se atiende por descargo.
            </p>
          )}
        </div>
      ))}
      <p className="flex justify-between border-t-2 border-slate-300 pt-2 text-base font-bold text-mar-profundo">
        <span>Tributo omitido</span>
        <span>{soles(l.totalOmitido)}</span>
      </p>
    </div>
  )
}

function Resolucion({ expediente: e, alResolver }: { expediente: ExpedienteApi; alResolver: (x: ExpedienteApi) => void }) {
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null)
  const [multa178, setMulta178] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function liquidar() {
    setProcesando(true)
    setError(null)
    setConfirmando(false)
    try {
      const { data } = await api.post<Liquidacion>(`/rentas/fiscalizacion/expedientes/${e.id}/liquidar`)
      setLiquidacion(data)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setProcesando(false)
    }
  }

  async function resolver() {
    setProcesando(true)
    setError(null)
    try {
      const multas = liquidacion?.multas ?? []
      const { data } = await api.post<ExpedienteApi>(`/rentas/fiscalizacion/expedientes/${e.id}/resolver`, {
        multa178: multa178 && multas.length > 0,
      })
      alResolver(data)
    } catch (err) {
      setError(mensajeError(err))
      setConfirmando(false)
      setProcesando(false)
    }
  }

  return (
    <section aria-labelledby="liq-titulo" className="mt-6 rounded-xl bg-white p-6 shadow-md ring-2 ring-mar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="liq-titulo" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
          Liquidación de diferencias
        </h2>
        <button type="button" onClick={() => void liquidar()} disabled={procesando} className={liquidacion ? BOTON_SEC : BOTON}>
          {procesando && !confirmando ? 'Liquidando…' : liquidacion ? 'Volver a liquidar' : 'Liquidar diferencias'}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Compara lo que el cálculo determina con la ficha de inspección contra lo que ya está en la cuenta corriente, año por año. No graba
        nada hasta resolver.
      </p>
      {liquidacion && (
        <div className="mt-4">
          <TablaLiquidacion liquidacion={liquidacion} />
          {!!liquidacion.multas?.length && (
            <fieldset className="mt-4 rounded-md border border-slate-200 px-3 py-2">
              <legend className="px-1 text-xs font-bold uppercase tracking-wider text-mar-profundo">Multa por omisión</legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={multa178}
                  disabled={confirmando}
                  onChange={(x) => setMulta178(x.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
                />
                <span>
                  Emitir también la Resolución de Multa (art. {liquidacion.multas[0].codigo}: {liquidacion.multas[0].descripcion.toLowerCase()}).
                  <ul className="mt-1 text-xs text-slate-600">
                    {liquidacion.multas.map((m) => (
                      <li key={m.anio}>
                        {m.anio}: {m.porcentaje} % de {soles(m.base)} omitido = <strong>{soles(m.monto)}</strong>
                      </li>
                    ))}
                  </ul>
                </span>
              </label>
            </fieldset>
          )}
          <p className="mt-3 text-sm text-slate-600">
            {liquidacion.sinDiferencias
              ? 'No hay tributo omitido: al resolver, el expediente se cierra sin diferencias y el predio no cambia.'
              : 'Al resolver: la ficha pasa al predio como declaración jurada de fiscalización, las cuotas pendientes suben, las ya pagadas o en trámite reciben una diferencia y se emite la Resolución de Determinación por año.'}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            {confirmando && (
              <button type="button" onClick={() => setConfirmando(false)} disabled={procesando} className={BOTON_SEC}>
                Volver
              </button>
            )}
            <button type="button" onClick={() => (confirmando ? void resolver() : setConfirmando(true))} disabled={procesando} className={BOTON}>
              {procesando && confirmando
                ? 'Resolviendo…'
                : confirmando
                  ? liquidacion.sinDiferencias
                    ? 'Confirmar cierre sin diferencias'
                    : `Confirmar y emitir RD por ${soles(liquidacion.totalOmitido)}${multa178 && liquidacion.multas?.length ? ' y la multa' : ''}`
                  : 'Resolver expediente'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}

function Resultado({ expediente: e }: { expediente: ExpedienteApi }) {
  return (
    <section aria-labelledby="res-titulo" className={TARJETA}>
      <h2 id="res-titulo" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
        {e.estado === 'RESUELTO' ? 'Resolución' : 'Cerrado sin diferencias'}
      </h2>
      {e.liquidacion && (
        <div className="mt-3">
          <TablaLiquidacion liquidacion={e.liquidacion} />
        </div>
      )}
      {e.valores.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Valores emitidos</h3>
          <ul className="mt-1 divide-y divide-slate-100 text-sm">
            {e.valores.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <Link
                  to={`${RUTA_VALORES_FISCALIZACION}/${v.id}`}
                  className="font-mono font-medium text-mar hover:text-mar-profundo hover:underline focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  {v.tipo} N° {v.numero}
                </Link>
                <span className="text-slate-600">
                  {soles(v.totalDeuda)} · {v.estado.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            La notificación, la exigibilidad y la transferencia a coactivo de estas RD siguen en Control y Recaudación, como cualquier valor.
          </p>
        </>
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
              {e.estado === 'RESUELTO' && (
                <p className="mt-3 text-xs text-slate-500">La ficha ya se aplicó a cada predio como declaración jurada de fiscalización.</p>
              )}
            </section>

            {e.estado === 'INSPECCIONADO' && <Resolucion expediente={e} alResolver={setExpediente} />}
            {(e.estado === 'RESUELTO' || e.estado === 'SIN_DIFERENCIAS') && <Resultado expediente={e} />}

            {editable(e) && <Anulacion expediente={e} alAnular={setExpediente} />}
          </>
        )}
      </div>
    </div>
  )
}
