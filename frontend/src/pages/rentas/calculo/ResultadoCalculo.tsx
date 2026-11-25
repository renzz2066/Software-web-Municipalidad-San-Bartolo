import { soles } from '../contribuyentes/tipos'

// Respuesta de POST /rentas/calculo/{simular|ejecutar}: la determinación anual (backend/src/rentas/calculo/
// masiva.service.ts; specs/rentas-nucleo-v2.md, Fase 6, J09).

export type TipoCalculo = 'PREDIAL' | 'ARBITRIOS'

export interface DetallePredio {
  predioId: number
  porcentaje: string
  arancel?: string
  terreno?: string
  construccion?: string
  otras?: string
  autoavaluo?: string
  origen?: string // de dónde salió lo declarado: DJ, determinación anterior o padrón
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
  // Quienes no se determinan: DJ pendiente que toca el año, año ya determinado desde una DJ, o una
  // baja de deuda con valor, coactivo o convenio (L09).
  excluidos?: { djPendiente: number; rigeDj: number; bloqueados: number }
  sinCambioPersonas?: number
  detalle: {
    contribuyenteId: number
    predios: DetallePredio[]
    baseImponible: string
    impuestoPredial: string | null
    arbitrios: string
    beneficios?: string[]
    avisos?: string[]
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
        {r.ejecutado ? `Determinación ${r.anio} liquidada en la cuenta corriente.` : `Simulación ${r.anio}: todavía no se grabó nada.`}
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
          <li title="Cuotas pendientes que se rehacen con el monto nuevo (L10)">Anuladas: {c.anular}</li>
          <li>Sin cambio: {c.sinCambio}</li>
        </ul>
        {!hayCambios && !r.ejecutado && r.totalErrores === 0 && <p className="mt-1 text-xs text-slate-500">La cuenta corriente ya está al día para este año.</p>}
        <p className="mt-1 text-xs text-slate-500">Lo pagado no se toca: si el monto sube, la diferencia va como cuota de ajuste; si baja, el exceso pasa a las cuotas nuevas (L10).</p>
        {r.excluidos && r.excluidos.djPendiente + r.excluidos.rigeDj + r.excluidos.bloqueados > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
            {r.excluidos.rigeDj > 0 && <li>{r.excluidos.rigeDj} contribuyente(s) ya tienen el {r.anio} determinado desde su DJ: se corrige con otra DJ.</li>}
            {r.excluidos.djPendiente > 0 && <li>{r.excluidos.djPendiente} contribuyente(s) tienen una DJ pendiente que toca el {r.anio}: se determina al liquidarla.</li>}
            {r.excluidos.bloqueados > 0 && (
              <li className="text-amber-800">{r.excluidos.bloqueados} contribuyente(s) bajarían una deuda con valor, coactivo o convenio: no se tocan (L09; ver la lista de abajo).</li>
            )}
          </ul>
        )}
        {(r.sinCambioPersonas ?? 0) > 0 && <p className="mt-1 text-xs text-slate-500">{r.sinCambioPersonas} contribuyente(s) ya tenían esta misma determinación.</p>}
      </div>

      {r.detalle.map((d) => (
        <div key={d.contribuyenteId} className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="mb-1 text-left text-sm font-semibold text-mar-profundo">Autoavalúo por predio</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-2 py-2">Predio</th>
                <th scope="col" className="px-2 py-2">Origen</th>
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
                  <td className="px-2 py-2 text-xs text-slate-600">{p.origen ?? '—'}</td>
                  {p.error ? (
                    <td colSpan={4} className="px-2 py-2 text-ladrillo">
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
          {[...(d.beneficios ?? []), ...(d.avisos ?? [])].map((t, i) => (
            <p key={i} className="mt-1 text-xs text-slate-600">
              {t}
            </p>
          ))}
        </div>
      ))}

      {r.totalErrores > 0 && (
        <div role="alert" className="rounded-md bg-ladrillo/5 p-3 text-sm text-ladrillo">
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
