import { useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { ResultadoCalculo, type Resultado, type TipoCalculo } from './ResultadoCalculo'

// Simular → revisar → ejecutar. Sin contribuyenteId es masivo (nivel rentas.calculo-masivo).

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = [ANIO_ACTUAL + 1, ANIO_ACTUAL, ANIO_ACTUAL - 1]

const OPCIONES: { value: TipoCalculo[]; label: string }[] = [
  { value: ['PREDIAL', 'ARBITRIOS'], label: 'Predial y arbitrios' },
  { value: ['PREDIAL'], label: 'Solo predial' },
  { value: ['ARBITRIOS'], label: 'Solo arbitrios' },
]

export function PanelCalculo({ contribuyenteId, alEjecutar }: { contribuyenteId?: number; alEjecutar?: () => void }) {
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [opcion, setOpcion] = useState(0)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [isWorking, setIsWorking] = useState<'simular' | 'ejecutar' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function llamar(accion: 'simular' | 'ejecutar') {
    if (
      accion === 'ejecutar' &&
      !window.confirm(
        contribuyenteId
          ? `Se registrará la deuda ${anio} de este contribuyente. ¿Continuar?`
          : `Se registrará la deuda ${anio} de TODOS los contribuyentes y los parámetros del año quedarán bloqueados. ¿Continuar?`,
      )
    ) {
      return
    }
    setIsWorking(accion)
    setError(null)
    try {
      const { data } = await api.post<Resultado>(
        `/rentas/calculo/${accion}`,
        { anio, contribuyenteId, tributos: OPCIONES[opcion].value },
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
  const puedeEjecutar = resultado && !resultado.ejecutado && resultado.anio === anio

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="calc-anio" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Año fiscal
          </label>
          <select
            id="calc-anio"
            value={anio}
            onChange={(e) => cambiar(() => setAnio(Number(e.target.value)))}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            {ANIOS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="calc-tributos" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tributos
          </label>
          <select
            id="calc-tributos"
            value={opcion}
            onChange={(e) => cambiar(() => setOpcion(Number(e.target.value)))}
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
          {isWorking === 'simular' ? 'Simulando…' : 'Simular'}
        </button>
        <button
          type="button"
          onClick={() => void llamar('ejecutar')}
          disabled={!puedeEjecutar || isWorking !== null}
          title={puedeEjecutar ? undefined : 'Primero simula para revisar el resultado'}
          className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-check2-circle mr-1" />
          {isWorking === 'ejecutar' ? 'Registrando…' : 'Ejecutar cálculo'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {resultado && <ResultadoCalculo r={resultado} />}
    </div>
  )
}
