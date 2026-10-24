import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { soles } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { RUTA_VALORES, direccionPredio, numeroValor, type TipoValor } from '../valores/valoresApi'
import { RUTA_TRANSFERENCIAS, type ResultadoTransferencia, type TransferenciaResumen } from './transferenciasApi'

// Simular → elegir → generar memorándum de transferencia a Cobranza Coactiva (V7).

const OPCIONES: { value: TipoValor[]; label: string }[] = [
  { value: ['OP', 'RD', 'RM'], label: 'OP, RD y RM' },
  { value: ['OP', 'RD'], label: 'OP y RD' },
  { value: ['OP'], label: 'Solo OP' },
  { value: ['RD'], label: 'Solo RD' },
]

const MOTIVOS: { key: keyof ResultadoTransferencia['excluidos']; texto: string }[] = [
  { key: 'noNotificado', texto: 'sin notificar' },
  { key: 'plazoVigente', texto: 'aún no exigibles (plazo vigente)' },
  { key: 'sinDeudaPendiente', texto: 'sin deuda pendiente (fraccionada o pagada)' },
]

export function PanelTransferencia() {
  const [opcion, setOpcion] = useState(0)
  const [resultado, setResultado] = useState<ResultadoTransferencia | null>(null)
  const [elegidos, setElegidos] = useState<Set<number>>(new Set())
  const [memos, setMemos] = useState<TransferenciaResumen[]>([])
  const [isWorking, setIsWorking] = useState<'simular' | 'ejecutar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .get<TransferenciaResumen[]>('/rentas/transferencias')
      .then(({ data }) => {
        if (!cancelled) setMemos(data)
      })
      .catch((err) => {
        if (!cancelled) setError(mensajeError(err))
      })
    return () => {
      cancelled = true
    }
  }, [recarga])

  async function llamar(accion: 'simular' | 'ejecutar') {
    if (accion === 'ejecutar' && !window.confirm(`Se transferirán ${elegidos.size} valores a Cobranza Coactiva. ¿Continuar?`)) return
    setIsWorking(accion)
    setError(null)
    try {
      const { data } = await api.post<ResultadoTransferencia>(
        `/rentas/transferencias/${accion}`,
        { tipos: OPCIONES[opcion].value, ...(accion === 'ejecutar' ? { valorIds: [...elegidos] } : {}) },
        { timeout: 180_000 },
      )
      setResultado(data)
      setElegidos(new Set(accion === 'simular' ? data.valores.map((v) => v.id) : []))
      if (accion === 'ejecutar') setRecarga((k) => k + 1)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsWorking(null)
    }
  }

  function alternar(id: number) {
    setElegidos((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  const r = resultado
  const montoElegido = r ? r.valores.filter((v) => elegidos.has(v.id)).reduce((a, v) => a + Number(v.deuda), 0) : 0
  const excluidos = r ? MOTIVOS.filter((m) => r.excluidos[m.key] > 0) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="tra-tipos" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Valores
          </label>
          <select
            id="tra-tipos"
            value={opcion}
            onChange={(e) => {
              setOpcion(Number(e.target.value))
              setResultado(null)
            }}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            {OPCIONES.map((o, i) => (
              <option key={o.label} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void llamar('simular')}
          disabled={isWorking !== null}
          className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-eye mr-1" />
          {isWorking === 'simular' ? 'Buscando…' : 'Buscar valores exigibles'}
        </button>
        <button
          type="button"
          onClick={() => void llamar('ejecutar')}
          disabled={!r || r.ejecutado || elegidos.size === 0 || isWorking !== null}
          title={r && !r.ejecutado ? undefined : 'Primero busca los valores exigibles'}
          className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-send-check mr-1" />
          {isWorking === 'ejecutar' ? 'Transfiriendo…' : `Generar memorándum (${elegidos.size})`}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {r && (
        <div className="space-y-3">
          <p
            role="status"
            className={`rounded-md px-3 py-2 text-sm font-medium ${r.ejecutado ? 'bg-emerald-50 text-emerald-800' : 'bg-mar/10 text-mar-profundo'}`}
          >
            {r.ejecutado ? (
              <>
                Memorándum N° {r.numero}: {r.cantidad} valores por {soles(r.monto)} transferidos a Cobranza Coactiva.{' '}
                <Link to={`${RUTA_TRANSFERENCIAS}/${r.transferenciaId}`} className="underline">
                  Ver e imprimir
                </Link>
              </>
            ) : (
              `Al ${r.fecha}: ${r.cantidad} valores exigibles. Elegidos ${elegidos.size} por ${soles(montoElegido)}.`
            )}
          </p>
          {excluidos.length > 0 && (
            <p className="text-sm text-slate-700">
              No entran:{' '}
              {excluidos.map((m, i) => (
                <span key={m.key}>
                  {i > 0 && ' · '}
                  {r.excluidos[m.key]} {m.texto}
                </span>
              ))}
            </p>
          )}
          {!r.ejecutado && r.valores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-2 py-2">
                      <span className="sr-only">Elegir</span>
                    </th>
                    <th scope="col" className="px-2 py-2">Valor</th>
                    <th scope="col" className="px-2 py-2">Contribuyente</th>
                    <th scope="col" className="px-2 py-2">Notificado</th>
                    <th scope="col" className="px-2 py-2">Exigible</th>
                    <th scope="col" className="px-2 py-2 text-right">Deuda hoy</th>
                  </tr>
                </thead>
                <tbody>
                  {r.valores.map((v) => (
                    <tr key={v.id} className="border-b border-slate-100">
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          aria-label={`Elegir ${numeroValor(v)}`}
                          checked={elegidos.has(v.id)}
                          onChange={() => alternar(v.id)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">
                        <Link to={`${RUTA_VALORES}/${v.id}`} className="text-mar-profundo underline">
                          {numeroValor(v)}
                        </Link>
                      </td>
                      <td className="px-2 py-1.5">
                        {v.contribuyente.nombreCompleto}
                        <span className="block text-xs text-slate-500">
                          {v.contribuyente.tipoDoc} {v.contribuyente.numDoc}
                          {v.predio && ` · ${direccionPredio(v.predio)}`}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{v.fechaNotificacion}</td>
                      <td className="px-2 py-1.5">{v.fechaExigible}</td>
                      <td className="px-2 py-1.5 text-right font-medium">{soles(v.deuda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <section aria-labelledby="memos" className="border-t border-slate-200 pt-4">
        <h2 id="memos" className="mb-2 font-semibold text-mar-profundo">
          Memorándums enviados
        </h2>
        {memos.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no se transfirieron valores.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {memos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link to={`${RUTA_TRANSFERENCIAS}/${m.id}`} className="font-mono text-xs font-semibold text-mar-profundo underline">
                  MEMO N° {m.anio}-{m.numero}
                </Link>
                <span className="text-slate-600">
                  {m.fecha.slice(0, 10)} · {m.cantidad} valores · {soles(m.monto)} · {m.estado}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
