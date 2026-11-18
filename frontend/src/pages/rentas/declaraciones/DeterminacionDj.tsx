import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { api } from '../../../lib/api'
import { RUTA_BASE } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import type { DjDetalle } from './djApi'
import {
  CONCEPTO,
  ESTILO_DETERMINACION,
  ETIQUETA_DETERMINACION,
  MESES,
  soles,
  type Determinacion,
  type Previa,
  type ResultadoLiquidacion,
  type Tributo,
} from './determinacionApi'

// Determinar (C6) → revisar HR, PU/PR y arbitrios por mes → elegir años y tributos (L08) → ver qué
// cambia en la cuenta → liquidar ("Generar Cta.", C7). Una DJ que baja un período liquidado queda en
// revisión (J14) y la resuelve un supervisor distinto de quien la registró (J17).

const SUPERVISION = ['SUPERVISOR', 'ADMIN']
const OPCIONES: { valor: Tributo[]; etiqueta: string }[] = [
  { valor: ['PREDIAL', 'ARBITRIOS'], etiqueta: 'Impuesto predial y arbitrios' },
  { valor: ['PREDIAL'], etiqueta: 'Solo impuesto predial' },
  { valor: ['ARBITRIOS'], etiqueta: 'Solo arbitrios' },
]
const BOTON = 'rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'

export function DeterminacionDj({ dj, alCambiar }: { dj: DjDetalle; alCambiar: (dj: DjDetalle) => void }) {
  const { user } = useAuth()
  const [dets, setDets] = useState<Determinacion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [anios, setAnios] = useState<number[]>([])
  const [opcion, setOpcion] = useState(0)
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [resultado, setResultado] = useState<ResultadoLiquidacion | null>(null)
  const [justificacion, setJustificacion] = useState('')

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        const { data } = await api.get<Determinacion[]>(`/declaraciones/${dj.id}/determinacion`)
        if (!vivo) return
        setDets(data)
        setAnios(data.filter((d) => d.estado === 'DETERMINADA').map((d) => d.anio))
      } catch (err) {
        if (vivo) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [dj.id, dj.estado])

  async function ejecutar<T>(clave: string, fn: () => Promise<T>) {
    setOcupado(clave)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      setError(mensajeError(err))
      return null
    } finally {
      setOcupado(null)
    }
  }

  async function determinar() {
    const r = await ejecutar('determinar', () => api.post<{ dj: DjDetalle; determinaciones: Determinacion[] }>(`/declaraciones/${dj.id}/determinar`, {}, { timeout: 120_000 }))
    if (!r) return
    setPrevia(null)
    setResultado(null)
    setDets(r.data.determinaciones)
    setAnios(r.data.determinaciones.filter((d) => d.estado === 'DETERMINADA').map((d) => d.anio))
    alCambiar(r.data.dj)
  }

  async function verPrevia() {
    const r = await ejecutar('previa', () => api.post<Previa>(`/declaraciones/${dj.id}/previa-liquidacion`, { anios, tributos: OPCIONES[opcion].valor }, { timeout: 120_000 }))
    if (r) setPrevia(r.data)
  }

  async function liquidar() {
    const texto = dj.tipo === 'INFORMATIVA' ? 'Se aplicará la DJ al padrón (informativa: no genera cuenta).' : `Se generará la cuenta de ${anios.join(', ') || 'ningún año'} (${OPCIONES[opcion].etiqueta.toLowerCase()}).`
    if (!window.confirm(`${texto} ¿Continuar?`)) return
    const r = await ejecutar('liquidar', () => api.post<ResultadoLiquidacion>(`/declaraciones/${dj.id}/liquidar`, { anios, tributos: OPCIONES[opcion].valor }, { timeout: 120_000 }))
    if (!r) return
    setResultado(r.data)
    setPrevia(null)
    setDets(r.data.determinaciones)
    alCambiar(r.data.dj)
  }

  async function resolver(accion: 'APROBAR' | 'RECHAZAR') {
    const r = await ejecutar(accion, () => api.post<{ dj: DjDetalle; determinaciones: Determinacion[] }>(`/declaraciones/${dj.id}/revision`, { accion, justificacion: justificacion.trim() }))
    if (!r) return
    setJustificacion('')
    setDets(r.data.determinaciones)
    alCambiar(r.data.dj)
  }

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const vence = dj.revisionVence?.slice(0, 10) ?? null
  const plazoVencido = Boolean(vence && hoy > vence)
  const determinable = dj.estado === 'PENDIENTE' || dj.estado === 'EN_REVISION'
  const porLiquidar = (dets ?? []).filter((d) => d.estado === 'DETERMINADA')
  const determinada = porLiquidar.length > 0
  const liquidable = dj.estado === 'PENDIENTE' || (dj.estado === 'EN_REVISION' && plazoVencido)
  // J15: si todo rige desde el año próximo, no hay años que determinar y se liquida solo el padrón.
  const anioActual = Number(hoy.slice(0, 4))
  const sinAnios = (dets?.length ?? 0) === 0 && dj.anexos.length > 0 && dj.anexos.every((a) => a.anioAfectacion > anioActual && Number(a.fechaAfectacionArbitrios.slice(0, 4)) > anioActual)
  const resuelve = SUPERVISION.includes(user?.rol ?? '') && user?.id !== dj.creadoPorId

  return (
    <section className="mt-6 rounded-panel border border-borde bg-white" aria-labelledby="det-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 id="det-titulo" className="font-serif text-lg text-mar-profundo">
            Determinación y liquidación
          </h2>
          <p className="text-xs text-slate-500">
            {dj.liquidadaAt
              ? `Liquidada el ${dj.liquidadaAt.slice(0, 10)}${dj.liquidadaPor ? ` por ${dj.liquidadaPor.usuario}` : ''}.`
              : 'Un resultado por año, desde el primero que toca la DJ hasta el actual (J15), con todos los predios de la persona.'}
          </p>
        </div>
        {determinable && (
          <button type="button" disabled={ocupado !== null} onClick={() => void determinar()} className={`${BOTON} border border-mar-profundo/30 text-mar-profundo hover:bg-mar/5`}>
            <i aria-hidden="true" className="bi bi-calculator mr-1" />
            {ocupado === 'determinar' ? 'Determinando…' : determinada ? 'Volver a determinar' : 'Determinar'}
          </button>
        )}
      </div>

      {dj.estado === 'EN_REVISION' && (
        <div className="border-b border-slate-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            <i aria-hidden="true" className="bi bi-hourglass-split mr-1" />
            La DJ baja la obligación de un período ya liquidado: queda en revisión y no genera cuenta (J14).{' '}
            {plazoVencido ? (
              <strong>El plazo venció el {vence}: surte efecto, se puede liquidar y ya no se puede rechazar.</strong>
            ) : (
              <>
                Un supervisor distinto de quien la registró la resuelve hasta el <strong>{vence}</strong> (45 días hábiles).
              </>
            )}
          </p>
          {resuelve ? (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm">
                <span className="block text-xs">Justificación (mínimo 10 caracteres)</span>
                <input
                  value={justificacion}
                  maxLength={250}
                  onChange={(e) => setJustificacion(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
                />
              </label>
              <button type="button" disabled={ocupado !== null || justificacion.trim().length < 10} onClick={() => void resolver('APROBAR')} className={`${BOTON} bg-mar-profundo text-white hover:brightness-110`}>
                Aprobar
              </button>
              {!plazoVencido && (
                <button type="button" disabled={ocupado !== null || justificacion.trim().length < 10} onClick={() => void resolver('RECHAZAR')} className={`${BOTON} border border-ladrillo/40 text-ladrillo hover:bg-ladrillo/5`}>
                  Rechazar
                </button>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs">{user?.id === dj.creadoPorId ? 'Registraste esta DJ: la revisión la resuelve otro supervisor (J17).' : 'La resuelve un supervisor.'}</p>
          )}
        </div>
      )}
      {dj.revisionResueltaAt && (
        <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
          Revisión resuelta el {dj.revisionResueltaAt.slice(0, 10)} por {dj.revisionResueltaPor?.usuario ?? '—'}: {dj.revisionJustificacion}
        </p>
      )}

      {error && (
        <p role="alert" className="px-4 pt-3 text-sm font-medium text-ladrillo">
          {error}
        </p>
      )}

      <div className="space-y-4 p-4">
        {dets === null ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : dets.length === 0 ? (
          <p className="text-sm text-slate-500">
            <i aria-hidden="true" className="bi bi-calculator mr-1" />
            {determinable ? 'Aún no se determina. Determinar no escribe la cuenta: solo calcula para revisar.' : 'Esta DJ no tiene determinación.'}
          </p>
        ) : (
          dets.map((d) => <TarjetaAnio key={d.id} d={d} />)
        )}

        {determinable && (determinada || sinAnios) && (
          <div className="rounded-panel border border-borde bg-arena-claro/40 p-4">
            <h3 className="font-semibold text-mar-profundo">Liquidar (Generar Cta.)</h3>
            {dj.tipo === 'INFORMATIVA' && <p className="mt-1 text-xs text-slate-600">Es informativa: se aplica al padrón y no genera cuenta (J07).</p>}
            {sinAnios && <p className="mt-1 text-xs text-slate-600">La DJ rige desde el año próximo: no hay años que liquidar todavía. Al liquidarla se aplica al padrón y la deuda sale en la determinación anual.</p>}
            <fieldset className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <legend className="mb-1 block w-full text-xs font-semibold uppercase tracking-wider text-slate-500">Años</legend>
              {porLiquidar.map((d) => (
                <label key={d.anio} className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={anios.includes(d.anio)}
                    onChange={(e) => {
                      setPrevia(null)
                      setAnios((a) => (e.target.checked ? [...a, d.anio].sort() : a.filter((x) => x !== d.anio)))
                    }}
                    className="h-4 w-4 accent-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
                  />
                  {d.anio}
                </label>
              ))}
              {dj.tipo !== 'INFORMATIVA' && (
                <label className="ml-auto text-sm">
                  <span className="sr-only">Tributos</span>
                  <select
                    value={opcion}
                    onChange={(e) => {
                      setPrevia(null)
                      setOpcion(Number(e.target.value))
                    }}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    {OPCIONES.map((o, i) => (
                      <option key={o.etiqueta} value={i}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
            <p className="mt-2 text-xs text-slate-500">Los años que no elijas no generan cuenta y su determinación se descarta (L08).</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={ocupado !== null || anios.length === 0 || dj.tipo === 'INFORMATIVA'} onClick={() => void verPrevia()} className={`${BOTON} border border-mar-profundo/30 text-mar-profundo hover:bg-mar/5`}>
                <i aria-hidden="true" className="bi bi-eye mr-1" />
                {ocupado === 'previa' ? 'Revisando…' : 'Ver qué cambia en la cuenta'}
              </button>
              <button
                type="button"
                disabled={ocupado !== null || !liquidable || (anios.length === 0 && porLiquidar.length > 0)}
                title={liquidable ? undefined : 'La DJ está en revisión: la aprueba un supervisor (J14)'}
                onClick={() => void liquidar()}
                className={`${BOTON} bg-mar-profundo text-white hover:brightness-110`}
              >
                <i aria-hidden="true" className="bi bi-check2-circle mr-1" />
                {ocupado === 'liquidar' ? 'Liquidando…' : 'Liquidar'}
              </button>
            </div>
            {previa && <TablaPlan titulo="Vista previa" plan={previa} />}
          </div>
        )}
        {resultado && <TablaPlan titulo="Resultado de la liquidación" plan={resultado} />}
      </div>
    </section>
  )
}

function TarjetaAnio({ d }: { d: Determinacion }) {
  return (
    <article className="rounded-panel border border-borde" aria-label={`Determinación ${d.anio}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h3 className="font-serif text-base text-mar-profundo">HR {d.anio}</h3>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO_DETERMINACION[d.estado]}`}>
          {ETIQUETA_DETERMINACION[d.estado]}
          {d.estado === 'LIQUIDADA' && !d.liquidaPredial && !d.liquidaArbitrios && ' · sin cuenta'}
          {d.estado === 'LIQUIDADA' && d.liquidaPredial !== d.liquidaArbitrios && ` · solo ${d.liquidaPredial ? 'predial' : 'arbitrios'}`}
        </span>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2 text-sm sm:grid-cols-6">
        <Cifra etiqueta="Base imponible" valor={soles(d.baseImponible)} />
        <Cifra etiqueta="Deducción (P15)" valor={soles(d.deduccion)} />
        <Cifra etiqueta="Base afecta" valor={soles(d.baseAfecta)} />
        <Cifra etiqueta="Impuesto predial" valor={d.predialCalculable ? soles(d.impuesto) : 'Sin calcular'} alerta={!d.predialCalculable} />
        <Cifra etiqueta="Derecho de emisión" valor={soles(d.derechoEmision)} />
        <Cifra etiqueta="Arbitrios" valor={soles(d.arbitrios)} />
      </dl>
      {d.cuotasPredial.length > 0 && (
        <p className="px-3 pb-2 text-xs text-slate-600">
          Cuotas del predial:{' '}
          {d.cuotasPredial.map((c) => `${c.cuota}) ${soles(Number(c.importe) + Number(c.derechoEmision))} al ${c.vence}`).join(' · ')}
        </p>
      )}
      {[
        ...d.errores.map((t) => ['text-ladrillo', 'bi-exclamation-octagon', t]),
        ...[...new Set(d.avisos)].map((t) => ['text-amber-800', 'bi-exclamation-triangle', t]),
        ...d.beneficios.map((t) => ['text-emerald-800', 'bi-award', t]),
      ].map(([clase, icono, t], i) => (
        <p key={i} className={`px-3 pb-1 text-xs ${clase}`}>
          <i aria-hidden="true" className={`bi ${icono} mr-1`} />
          {t}
        </p>
      ))}
      {d.saldoAFavor.length > 0 && (
        <p className="px-3 pb-1 text-xs text-emerald-800">
          Saldo a favor (L10): {d.saldoAFavor.map((s) => `${CONCEPTO[s.tributo] ?? s.tributo}${s.predioId ? ` #${s.predioId}` : ''} ${soles(s.importe)}`).join(' · ')}
        </p>
      )}

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Predios del año {d.anio} (PU/PR)</caption>
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="min-w-[220px] px-3 py-1.5">Predio</th>
              <th scope="col" className="min-w-[120px] px-2 py-1.5">Origen</th>
              <th scope="col" className="px-2 py-1.5 text-right">%</th>
              <th scope="col" className="px-2 py-1.5 text-right">Terreno</th>
              <th scope="col" className="px-2 py-1.5 text-right">Construcción</th>
              <th scope="col" className="px-2 py-1.5 text-right">Obras</th>
              <th scope="col" className="px-2 py-1.5 text-right">Autoavalúo</th>
              <th scope="col" className="px-2 py-1.5 text-right">Valor afecto</th>
              <th scope="col" className="px-3 py-1.5 text-right">Arbitrios</th>
            </tr>
          </thead>
          <tbody>
            {d.predios.map((p) => (
              <tr key={p.predioId} className="border-t border-slate-100 align-top">
                <td className="px-3 py-1.5">
                  <Link to={`${RUTA_BASE}/predios/${p.predioId}`} className="text-mar hover:underline">
                    {p.tipo === 'RUSTICO' ? 'PR' : 'PU'} #{p.predioId}
                  </Link>
                  <span className="block text-xs text-slate-500">{p.direccion}</span>
                  {p.error && <span className="block text-xs text-ladrillo">{p.error}</span>}
                  {!p.afectoPredial && <span className="block text-xs text-slate-500">Sin predial este año (J10)</span>}
                  {Number(p.exoneracion) > 0 && <span className="block text-xs text-emerald-800">{Number(p.exoneracion) === 100 ? 'Inafecto' : `Exonerado ${Number(p.exoneracion)}%`} (R06)</span>}
                </td>
                <td className="px-2 py-1.5 text-xs text-slate-600">{p.origen}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right tabular-nums">{Number(p.porcentaje)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right tabular-nums">{p.afectoPredial ? soles(p.terreno) : '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right tabular-nums">{p.afectoPredial ? soles(p.construccion) : '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right tabular-nums">{p.afectoPredial ? soles(p.obras) : '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right tabular-nums">{p.afectoPredial ? soles(p.autoavaluo) : '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap text-right tabular-nums">{soles(p.valorAfecto)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums">{soles(p.arbitrios)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 text-xs text-slate-500">
              <td colSpan={9} className="px-3 py-1.5">
                {d.predios.length} predio{d.predios.length === 1 ? '' : 's'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {d.arbitriosPorMes.length > 0 && (
        <details className="border-t border-slate-100">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa">Arbitrios por mes (L07)</summary>
          <div className="relative overflow-x-auto pb-2">
            <table className="w-full min-w-[900px] text-xs">
              <caption className="sr-only">Arbitrios por predio, concepto y mes de {d.anio}</caption>
              <thead className="bg-slate-50 text-left uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-1.5">Predio · concepto</th>
                  {MESES.map((m) => (
                    <th key={m} scope="col" className="px-1.5 py-1.5 text-right">
                      {m}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-1.5 text-right">Cuotas</th>
                </tr>
              </thead>
              <tbody>
                {d.arbitriosPorMes.map((a) => (
                  <tr key={`${a.predioId}-${a.concepto}`} className="border-t border-slate-100">
                    <th scope="row" className="px-3 py-1 text-left font-normal">
                      #{a.predioId} · {CONCEPTO[a.concepto] ?? a.concepto}
                      <span className="block text-slate-500">{a.usos.join(', ')}</span>
                    </th>
                    {a.meses.map((v, i) => (
                      <td key={i} className="px-1.5 py-1 whitespace-nowrap text-right tabular-nums text-slate-700">
                        {Number(v) ? Number(v).toFixed(2) : '·'}
                      </td>
                    ))}
                    <td className="px-3 py-1 whitespace-nowrap text-right tabular-nums">{a.cuotas.map((c) => `${c.cuota}) ${Number(c.importe).toFixed(2)}`).join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </article>
  )
}

function TablaPlan({ titulo, plan }: { titulo: string; plan: Previa }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</h4>
      {plan.informativa ? (
        <p className="mt-1 text-sm text-slate-700">Informativa: no genera cuenta.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="mt-1 w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-2 py-1">Año</th>
                <th scope="col" className="px-2 py-1 text-right">Cuotas nuevas</th>
                <th scope="col" className="px-2 py-1 text-right">Monto nuevo</th>
                <th scope="col" className="px-2 py-1 text-right">Ajustes</th>
                <th scope="col" className="px-2 py-1 text-right">Se anulan</th>
                <th scope="col" className="px-2 py-1 text-right">Sin cambio</th>
                <th scope="col" className="px-2 py-1 text-right">Saldo a favor</th>
              </tr>
            </thead>
            <tbody>
              {plan.porAnio.map((a) => (
                <tr key={a.anio} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-1">
                    {a.anio}
                    {[...a.bloqueos, ...a.errores].map((b, i) => (
                      <span key={i} className="block text-xs text-ladrillo">
                        {b}
                      </span>
                    ))}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{a.crear}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{soles(a.montoNuevo)}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{a.ajustes}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{a.anular}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{a.sinCambio}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-right tabular-nums">{soles(a.saldoAFavor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {plan.avisos.map((a, i) => (
        <p key={i} className="mt-1 text-xs text-amber-800">
          <i aria-hidden="true" className="bi bi-exclamation-triangle mr-1" />
          {a}
        </p>
      ))}
    </div>
  )
}

function Cifra({ etiqueta, valor, alerta = false }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className={`text-right font-serif tabular-nums sm:text-left ${alerta ? 'text-ladrillo' : 'text-slate-800'}`}>{valor}</dd>
    </div>
  )
}
