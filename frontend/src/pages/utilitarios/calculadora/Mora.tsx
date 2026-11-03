import { useEffect, useState } from 'react'
import type Decimal from 'decimal.js'
import { api } from '../../../lib/api'
import { hoyLocal } from '../../../lib/fechas'
import { factorReajuste, liquidar, vigente, type Tasa } from '../../../lib/liquidacion'
import { aFecha, ANIO_MAX, ANIO_MIN, mensajeUtilidad, vencimientos } from '../utilitariosApi'
import { AnioCampo, AvisoSeccion } from '../utilitariosUi'

// U2: mora y reajuste a una fecha (specs/utilitarios-v1.md). Réplica de la liquidación del backend
// con las series IPM/TIM de GET /rentas/maestros/tasas-mora/{IPM,TIM}. Solo lectura.

const dinero = (d: Decimal) =>
  `S/ ${Number(d.toFixed(2)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fechaValida = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f)

export function Mora() {
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [cuota, setCuota] = useState(2)
  const vencEsperado = vencimientos(anio)[cuota - 1]
  const [vencimiento, setVencimiento] = useState(vencEsperado)
  const [vencBase, setVencBase] = useState(vencEsperado)
  const [pago, setPago] = useState(() => hoyLocal())
  const [importe, setImporte] = useState('100')
  const [derechoEmision, setDerechoEmision] = useState('0')
  const [esPredial, setEsPredial] = useState(true)
  const [generaMora, setGeneraMora] = useState(true)

  const [ipm, setIpm] = useState<Tasa[] | null>(null)
  const [tim, setTim] = useState<Tasa[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // El vencimiento sigue a la cuota/año; el usuario puede sobreescribirlo después.
  if (vencBase !== vencEsperado) {
    setVencBase(vencEsperado)
    setVencimiento(vencEsperado)
  }

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setError(null)
      try {
        const [t, i] = await Promise.all([
          api.get<Tasa[]>('/rentas/maestros/tasas-mora/TIM'),
          api.get<Tasa[]>('/rentas/maestros/tasas-mora/IPM'),
        ])
        if (!cancelled) {
          const normalizar = (serie: Tasa[]) => serie.map((x) => ({ ...x, vigenciaDesde: aFecha(x.vigenciaDesde) }))
          setTim(normalizar(t.data))
          setIpm(normalizar(i.data))
        }
      } catch (err) {
        if (!cancelled) setError(mensajeUtilidad(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [])

  const nImporte = Number(importe.trim().replace(',', '.'))
  const nDerecho = Number(derechoEmision.trim().replace(',', '.'))
  const montosOk =
    importe.trim() !== '' && Number.isFinite(nImporte) && nImporte >= 0 && Number.isFinite(nDerecho) && nDerecho >= 0
  const anioOk = anio >= ANIO_MIN && anio <= ANIO_MAX
  const fechasOk = fechaValida(vencimiento) && fechaValida(pago)
  const listo = anioOk && montosOk && fechasOk && ipm !== null && tim !== null

  const vencimientoCuota1 = vencimientos(anio)[0]
  const r = listo
    ? liquidar(
        {
          esPredial,
          cuota,
          anio,
          importe: nImporte,
          derechoEmision: nDerecho,
          fechaVencimiento: vencimiento,
          vencimientoCuota1,
          generaMora,
        },
        pago,
        ipm!,
        tim!,
      )
    : null

  const factor = listo ? factorReajuste(ipm!, vencimientoCuota1, pago) : null
  const tasaTim = listo ? vigente(tim!, vencimiento) : null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <AnioCampo id="mora-anio" valor={anio} alCambiar={setAnio} />
        <div>
          <label htmlFor="mora-cuota" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Cuota
          </label>
          <select
            id="mora-cuota"
            value={cuota}
            onChange={(e) => setCuota(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            {[1, 2, 3, 4].map((c) => (
              <option key={c} value={c}>
                {c} (vence {vencimientos(anio)[c - 1]})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mora-importe" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Insoluto (S/)
          </label>
          <input
            id="mora-importe"
            type="text"
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
        </div>
        <div>
          <label htmlFor="mora-de" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Derecho de emisión (S/)
          </label>
          <input
            id="mora-de"
            type="text"
            inputMode="decimal"
            value={derechoEmision}
            onChange={(e) => setDerechoEmision(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
        </div>

        <div>
          <label htmlFor="mora-venc" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Vencimiento
          </label>
          <input
            id="mora-venc"
            type="date"
            value={vencimiento}
            onChange={(e) => setVencimiento(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
        </div>
        <div>
          <label htmlFor="mora-pago" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Fecha de pago
          </label>
          <input
            id="mora-pago"
            type="date"
            value={pago}
            onChange={(e) => setPago(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aplicar</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" checked={esPredial} onChange={(e) => setEsPredial(e.target.checked)} className="accent-mar" />
              Reajuste IPM (solo predial, cuotas 2-4)
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={generaMora}
                onChange={(e) => setGeneraMora(e.target.checked)}
                className="accent-mar"
              />
              Genera mora (no aplica a cuotas fraccionadas)
            </label>
          </div>
        </fieldset>

        {error && <div className="sm:col-span-2"><AvisoSeccion mensaje={error} /></div>}
        {!anioOk && (
          <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">
            El año debe estar entre {ANIO_MIN} y {ANIO_MAX}.
          </p>
        )}
        {!error && !listo && anioOk && montosOk && fechasOk && (
          <p role="status" className="text-sm text-slate-500 sm:col-span-2">
            Cargando series IPM y TIM…
          </p>
        )}
        {montosOk && !fechasOk && (
          <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">
            Revisa las fechas (formato AAAA-MM-DD).
          </p>
        )}
        {!montosOk && (
          <p role="alert" className="text-sm font-medium text-red-700 sm:col-span-2">
            El insoluto y el derecho de emisión deben ser números mayores o iguales a 0.
          </p>
        )}
      </div>

      <div>
        {r ? (
          <>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Liquidación a la fecha de pago</caption>
              <tbody>
                <tr className="border-b border-slate-100">
                  <th scope="row" className="px-2 py-2 font-medium text-slate-600">Insoluto</th>
                  <td className="px-2 py-2 text-right">{dinero(r.insoluto)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <th scope="row" className="px-2 py-2 font-medium text-slate-600">
                    Reajuste IPM{factor && factor.gt(0) ? ` (${Number(factor.times(100).toFixed(2))}%)` : ''}
                  </th>
                  <td className="px-2 py-2 text-right">{dinero(r.reajuste)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <th scope="row" className="px-2 py-2 font-medium text-slate-600">
                    Mora {tasaTim ? `(${Number(tasaTim.valor)}% mensual)` : ''}
                  </th>
                  <td className="px-2 py-2 text-right">{dinero(r.mora)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <th scope="row" className="px-2 py-2 font-medium text-slate-600">Derecho de emisión</th>
                  <td className="px-2 py-2 text-right">{dinero(r.derechoEmision)}</td>
                </tr>
                <tr className="border-t-2 border-slate-300">
                  <th scope="row" className="px-2 py-3 text-base font-semibold text-mar-profundo">Total a pagar</th>
                  <td className="px-2 py-3 text-right text-base font-bold text-mar-profundo">{dinero(r.total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              {r.diasAtraso} día(s) de atraso al {pago}.
            </p>
          </>
        ) : (
          !error && <p className="text-sm text-slate-500">Completa los datos para ver la liquidación.</p>
        )}

        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Cálculo referencial con las series IPM/TIM registradas. La liquidación oficial la emite el Estado de
          Cuenta o Caja al cobrar.
        </p>
      </div>
    </div>
  )
}
