import { soles } from '../contribuyentes/tipos'

// Respuesta de POST /rentas/calculo/{simular|ejecutar} (backend/src/rentas/calculo).

export type TipoCalculo = 'PREDIAL' | 'ARBITRIOS'

export interface DetallePredio {
  predioId: number
  porcentaje: string
  arancel?: string
  terreno?: string
  construccion?: string
  otras?: string
  autoavaluo?: string
  error?: string | null
}

export interface Resultado {
  anio: number
  tributos: TipoCalculo[]
  contribuyentes: number
  predios: number
  totales: { predial: string; derechoEmision: string; arbitrios: string }
  cambios: { crear: number; actualizar: number; anular: number; sinCambio: number; protegidas: number }
  errores: string[]
  totalErrores: number
  detalle: {
    contribuyenteId: number
    predios: DetallePredio[]
    baseImponible: string
    impuestoPredial: string | null
    arbitrios: string
  }[]
  ejecutado: boolean
}

export function ResultadoCalculo({ r }: { r: Resultado }) {
  const c = r.cambios
  const hayCambios = c.crear + c.actualizar + c.anular > 0
  return (
    <div className="space-y-4">
      <p
        role="status"
        className={`rounded-md px-3 py-2 text-sm font-medium ${r.ejecutado ? 'bg-emerald-50 text-emerald-800' : 'bg-mar/10 text-mar-profundo'}`}
      >
        {r.ejecutado ? `Cálculo ${r.anio} registrado en la cuenta corriente.` : `Simulación ${r.anio}: todavía no se grabó nada.`}
      </p>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Dato titulo="Contribuyentes" valor={String(r.contribuyentes)} />
        <Dato titulo="Impuesto predial" valor={soles(r.totales.predial)} />
        <Dato titulo="Derecho de emisión" valor={soles(r.totales.derechoEmision)} />
        <Dato titulo="Arbitrios" valor={soles(r.totales.arbitrios)} />
      </dl>

      <div className="text-sm text-slate-700">
        <p className="font-semibold text-mar-profundo">Efecto en la cuenta corriente (cuotas)</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <li>Nuevas: {c.crear}</li>
          <li>Actualizadas: {c.actualizar}</li>
          <li>Anuladas: {c.anular}</li>
          <li>Sin cambio: {c.sinCambio}</li>
          <li title="Cuotas pagadas, fraccionadas o en coactivo: no se modifican">Protegidas: {c.protegidas}</li>
        </ul>
        {!hayCambios && !r.ejecutado && r.totalErrores === 0 && <p className="mt-1 text-xs text-slate-500">La cuenta corriente ya está al día para este año.</p>}
        {c.protegidas > 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Hay cuotas pagadas o en trámite que no se recalculan; si el monto cambió, la diferencia se regulariza aparte.
          </p>
        )}
      </div>

      {r.detalle.map((d) => (
        <div key={d.contribuyenteId} className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="mb-1 text-left text-sm font-semibold text-mar-profundo">Autoavalúo por predio</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-2 py-2">Predio</th>
                <th scope="col" className="px-2 py-2 text-right">Terreno</th>
                <th scope="col" className="px-2 py-2 text-right">Construcción</th>
                <th scope="col" className="px-2 py-2 text-right">Otras</th>
                <th scope="col" className="px-2 py-2 text-right">Autoavalúo</th>
                <th scope="col" className="px-2 py-2 text-right">% propiedad</th>
              </tr>
            </thead>
            <tbody>
              {d.predios.map((p) => (
                <tr key={p.predioId} className="border-b border-slate-100">
                  <td className="px-2 py-2">#{p.predioId}</td>
                  {p.error ? (
                    <td colSpan={4} className="px-2 py-2 text-red-700">
                      {p.error}
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-2 text-right">{p.terreno ? soles(p.terreno) : '—'}</td>
                      <td className="px-2 py-2 text-right">{p.construccion ? soles(p.construccion) : '—'}</td>
                      <td className="px-2 py-2 text-right">{p.otras ? soles(p.otras) : '—'}</td>
                      <td className="px-2 py-2 text-right font-semibold">{p.autoavaluo ? soles(p.autoavaluo) : '—'}</td>
                    </>
                  )}
                  <td className="px-2 py-2 text-right">{Number(p.porcentaje)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            Base imponible <strong>{soles(d.baseImponible)}</strong>
            {d.impuestoPredial && (
              <>
                {' '}
                → impuesto predial <strong>{soles(d.impuestoPredial)}</strong>
              </>
            )}
            {' '}· arbitrios <strong>{soles(d.arbitrios)}</strong>
          </p>
        </div>
      ))}

      {r.totalErrores > 0 && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">
            {r.totalErrores} predio(s) sin datos suficientes: a sus contribuyentes no se les calcula el predial (su deuda actual no se toca).
          </p>
          <ul className="mt-1 max-h-48 list-disc overflow-auto pl-5">
            {r.errores.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-md bg-mar-profundo/5 px-3 py-2 text-mar-profundo">
      <dt className="text-xs uppercase tracking-wider opacity-70">{titulo}</dt>
      <dd className="font-semibold">{valor}</dd>
    </div>
  )
}
