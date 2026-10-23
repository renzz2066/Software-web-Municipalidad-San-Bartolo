import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { soles } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { direccionPredio } from '../valores/valoresApi'
import { RUTA_CONVENIOS, type DeudaFraccionable, type SimulacionConvenio } from './fraccionamientoApi'
import { TablaCronograma } from './TablaCronograma'

// Elegir deudas → simular cronograma → grabar convenio (V6). El preconvenio de SIMUN es la simulación.

const CAMPO = 'mt-1 w-36 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ETIQUETA = 'block text-xs font-semibold uppercase tracking-wider text-slate-500'

export function NuevoConvenio({ contribuyenteId, alGrabar }: { contribuyenteId: number; alGrabar: () => void }) {
  const [deudas, setDeudas] = useState<DeudaFraccionable[] | null>(null)
  const [elegidas, setElegidas] = useState<Set<number>>(new Set())
  const [cuotaInicial, setCuotaInicial] = useState('')
  const [numCuotas, setNumCuotas] = useState('6')
  const [simulacion, setSimulacion] = useState<SimulacionConvenio | null>(null)
  const [isWorking, setIsWorking] = useState<'simular' | 'ejecutar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<{ deudas: DeudaFraccionable[] }>('/rentas/convenios/deudas', { params: { contribuyenteId } })
        if (!cancelled) setDeudas(data.deudas)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [contribuyenteId, recarga])

  const totalElegido = useMemo(
    () => (deudas ?? []).filter((d) => elegidas.has(d.id)).reduce((a, d) => a + Number(d.total), 0),
    [deudas, elegidas],
  )

  function alternar(id: number) {
    setElegidas((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
    setSimulacion(null)
  }

  function todas(marcar: boolean) {
    setElegidas(new Set(marcar ? (deudas ?? []).map((d) => d.id) : []))
    setSimulacion(null)
  }

  async function llamar(accion: 'simular' | 'ejecutar') {
    if (elegidas.size === 0) {
      setError('Elige al menos una deuda')
      return
    }
    const inicial = Number(cuotaInicial || 0)
    const n = Number(numCuotas)
    if (!Number.isFinite(inicial) || inicial < 0) {
      setError('La cuota inicial debe ser un monto válido')
      return
    }
    if (!Number.isInteger(n) || n < 1) {
      setError('El número de cuotas debe ser un entero mayor que 0')
      return
    }
    if (
      accion === 'ejecutar' &&
      !window.confirm(`Se grabará el convenio por ${soles(simulacion?.totalAPagar ?? 0)} en ${n} cuotas más la inicial. ¿Continuar?`)
    ) {
      return
    }
    setIsWorking(accion)
    setError(null)
    try {
      const { data } = await api.post<SimulacionConvenio>(`/rentas/convenios/${accion}`, {
        contribuyenteId,
        cuentaIds: [...elegidas],
        cuotaInicial: inicial,
        numCuotas: n,
      })
      setSimulacion(data)
      if (accion === 'ejecutar') {
        setElegidas(new Set())
        setRecarga((k) => k + 1)
        alGrabar()
      }
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsWorking(null)
    }
  }

  const cambiar = (fn: () => void) => {
    fn()
    setSimulacion(null)
  }
  const puedeGrabar = simulacion && !simulacion.ejecutado

  if (!deudas) {
    return error ? (
      <p role="alert" className="text-sm font-medium text-red-700">
        {error}
      </p>
    ) : (
      <p role="status" className="text-sm text-slate-500">
        Cargando deudas…
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {deudas.length === 0 ? (
        <p className="text-sm text-slate-500">No hay deuda pendiente para fraccionar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Elegir todas las deudas"
                    checked={elegidas.size === deudas.length}
                    onChange={(e) => todas(e.target.checked)}
                    className="h-4 w-4"
                  />
                </th>
                <th scope="col" className="px-2 py-2">Año</th>
                <th scope="col" className="px-2 py-2">Tributo</th>
                <th scope="col" className="px-2 py-2">Cuota</th>
                <th scope="col" className="px-2 py-2">Vence</th>
                <th scope="col" className="px-2 py-2">En valor</th>
                <th scope="col" className="px-2 py-2 text-right">Deuda hoy</th>
              </tr>
            </thead>
            <tbody>
              {deudas.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`Elegir ${d.tributo.nombre} ${d.anio} cuota ${d.cuota}`}
                      checked={elegidas.has(d.id)}
                      onChange={() => alternar(d.id)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-2 py-1.5">{d.anio}</td>
                  <td className="px-2 py-1.5">
                    {d.tributo.nombre}
                    {d.predio && <span className="block text-xs text-slate-500">{direccionPredio(d.predio)}</span>}
                  </td>
                  <td className="px-2 py-1.5">{d.cuota}</td>
                  <td className="px-2 py-1.5">{d.vencimiento ?? '—'}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{d.valor ? `${d.valor.tipo} ${d.valor.anio}-${d.valor.numero}` : '—'}</td>
                  <td className="px-2 py-1.5 text-right">{soles(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <p className="pb-2 text-sm text-slate-700">
          Elegidas: {elegidas.size} · <strong>{soles(totalElegido)}</strong>
        </p>
        <div>
          <label htmlFor="conv-inicial" className={ETIQUETA}>
            Cuota inicial (S/)
          </label>
          <input
            id="conv-inicial"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={cuotaInicial}
            onChange={(e) => cambiar(() => setCuotaInicial(e.target.value))}
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="conv-cuotas" className={ETIQUETA}>
            N.° de cuotas
          </label>
          <input
            id="conv-cuotas"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={numCuotas}
            onChange={(e) => cambiar(() => setNumCuotas(e.target.value))}
            className={CAMPO}
          />
        </div>
        <button
          type="button"
          onClick={() => void llamar('simular')}
          disabled={isWorking !== null || elegidas.size === 0}
          className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-eye mr-1" />
          {isWorking === 'simular' ? 'Simulando…' : 'Simular cronograma'}
        </button>
        <button
          type="button"
          onClick={() => void llamar('ejecutar')}
          disabled={!puedeGrabar || isWorking !== null}
          title={puedeGrabar ? undefined : 'Primero simula el cronograma'}
          className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-check2-circle mr-1" />
          {isWorking === 'ejecutar' ? 'Grabando…' : 'Grabar convenio'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {simulacion && (
        <div className="space-y-3">
          <p
            role="status"
            className={`rounded-md px-3 py-2 text-sm font-medium ${simulacion.ejecutado ? 'bg-emerald-50 text-emerald-800' : 'bg-mar/10 text-mar-profundo'}`}
          >
            {simulacion.ejecutado ? (
              <>
                Convenio N° {simulacion.numero} grabado.{' '}
                <Link to={`${RUTA_CONVENIOS}/${simulacion.convenioId}`} className="underline">
                  Ver e imprimir
                </Link>
              </>
            ) : (
              `Simulación al ${simulacion.fecha}: todavía no se grabó nada.`
            )}
          </p>
          <p className="text-sm text-slate-700">
            Deuda a fraccionar {soles(simulacion.total)} · cuota inicial mínima {soles(simulacion.cuotaInicialMinima)} · hasta{' '}
            {simulacion.cuotasMax} cuotas · interés {simulacion.interesMensual}% mensual
            {simulacion.ordenanza && ` (${simulacion.ordenanza})`}
          </p>
          <TablaCronograma cuotas={simulacion.cronograma} totalIntereses={simulacion.totalIntereses} totalAPagar={simulacion.totalAPagar} />
        </div>
      )}
    </div>
  )
}
