import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError, type Zona } from '../maestros/maestrosApi'
import { ResultadoEmision } from './ResultadoEmision'
import type { ResultadoEmision as Resultado, TipoValor } from './valoresApi'

// Simular → revisar → emitir OP/RD (V1). Sin contribuyenteId es emisión masiva.

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - i)

const OPCIONES: { value: TipoValor[]; label: string }[] = [
  { value: ['OP', 'RD'], label: 'OP (predial) y RD (arbitrios)' },
  { value: ['OP'], label: 'Solo OP (predial)' },
  { value: ['RD'], label: 'Solo RD (arbitrios)' },
]

const CAMPO = 'mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ETIQUETA = 'block text-xs font-semibold uppercase tracking-wider text-slate-500'

export function PanelEmision({ contribuyenteId, alEjecutar }: { contribuyenteId?: number; alEjecutar?: () => void }) {
  const masivo = contribuyenteId === undefined
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [opcion, setOpcion] = useState(0)
  const [soloVencidas, setSoloVencidas] = useState(true)
  const [montoMinimo, setMontoMinimo] = useState('0')
  const [zonaId, setZonaId] = useState('')
  const [zonas, setZonas] = useState<Zona[]>([])
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [isWorking, setIsWorking] = useState<'simular' | 'ejecutar' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!masivo) return
    let cancelled = false
    api
      .get<Zona[]>('/rentas/maestros/zonas')
      .then(({ data }) => {
        if (!cancelled) setZonas(data)
      })
      .catch(() => {
        // Sin zonas el filtro simplemente no se ofrece.
      })
    return () => {
      cancelled = true
    }
  }, [masivo])

  async function llamar(accion: 'simular' | 'ejecutar') {
    const minimo = Number(montoMinimo || 0)
    if (!Number.isFinite(minimo) || minimo < 0) {
      setError('El monto mínimo debe ser un número mayor o igual a 0')
      return
    }
    if (
      accion === 'ejecutar' &&
      !window.confirm(
        `Se emitirán ${resultado?.valores ?? 0} valores por S/ ${resultado?.total ?? '0.00'} con numeración definitiva. ¿Continuar?`,
      )
    ) {
      return
    }
    setIsWorking(accion)
    setError(null)
    try {
      const { data } = await api.post<Resultado>(
        `/rentas/valores/${accion}`,
        {
          anio,
          tipos: OPCIONES[opcion].value,
          contribuyenteId,
          zonaId: zonaId ? Number(zonaId) : undefined,
          soloVencidas,
          montoMinimo: minimo,
        },
        { timeout: 180_000 },
      )
      setResultado(data)
      if (accion === 'ejecutar') alEjecutar?.()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsWorking(null)
    }
  }

  const cambiar = (fn: () => void) => {
    fn()
    setResultado(null)
  }
  const puedeEjecutar = resultado && !resultado.ejecutado && resultado.valores > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="emi-anio" className={ETIQUETA}>
            Año fiscal
          </label>
          <select id="emi-anio" value={anio} onChange={(e) => cambiar(() => setAnio(Number(e.target.value)))} className={CAMPO}>
            {ANIOS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="emi-tipos" className={ETIQUETA}>
            Valores
          </label>
          <select id="emi-tipos" value={opcion} onChange={(e) => cambiar(() => setOpcion(Number(e.target.value)))} className={CAMPO}>
            {OPCIONES.map((o, i) => (
              <option key={o.label} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {masivo && zonas.length > 0 && (
          <div>
            <label htmlFor="emi-zona" className={ETIQUETA}>
              Zona
            </label>
            <select id="emi-zona" value={zonaId} onChange={(e) => cambiar(() => setZonaId(e.target.value))} className={CAMPO}>
              <option value="">Todas</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.codigo} · {z.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="emi-minimo" className={ETIQUETA}>
            Monto mínimo por valor (S/)
          </label>
          <input
            id="emi-minimo"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={montoMinimo}
            onChange={(e) => cambiar(() => setMontoMinimo(e.target.value))}
            className={`${CAMPO} w-36`}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={soloVencidas}
            onChange={(e) => cambiar(() => setSoloVencidas(e.target.checked))}
            className="h-4 w-4 rounded border-slate-300 focus-visible:outline-3 focus-visible:outline-turquesa"
          />
          Solo cuotas vencidas
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void llamar('simular')}
          disabled={isWorking !== null}
          className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-eye mr-1" />
          {isWorking === 'simular' ? 'Simulando…' : 'Simular'}
        </button>
        <button
          type="button"
          onClick={() => void llamar('ejecutar')}
          disabled={!puedeEjecutar || isWorking !== null}
          title={puedeEjecutar ? undefined : 'Primero simula para revisar qué se emitirá'}
          className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-file-earmark-check mr-1" />
          {isWorking === 'ejecutar' ? 'Emitiendo…' : 'Emitir valores'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {resultado && <ResultadoEmision r={resultado} />}
    </div>
  )
}
