import { soles } from '../contribuyentes/tipos'
import { etiquetaCuota, type CuotaCronograma } from './fraccionamientoApi'

// Cronograma de pagos del convenio (simulación, ficha e imprimible).

export function TablaCronograma({ cuotas, totalIntereses, totalAPagar }: { cuotas: CuotaCronograma[]; totalIntereses: string; totalAPagar: string }) {
  const conEstado = cuotas.some((c) => c.estado)
  const amortizado = cuotas.reduce((a, c) => a + Number(c.amortizacion), 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="mb-2 text-left font-semibold text-mar-profundo">Cronograma de pagos</caption>
        <thead>
          <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
            <th scope="col" className="py-2 pr-2">Cuota</th>
            <th scope="col" className="py-2 pr-2">Vence</th>
            <th scope="col" className="py-2 pr-2 text-right">Amortización</th>
            <th scope="col" className="py-2 pr-2 text-right">Interés</th>
            <th scope="col" className="py-2 pr-2 text-right">Cuota a pagar</th>
            {conEstado && <th scope="col" className="py-2">Estado</th>}
          </tr>
        </thead>
        <tbody>
          {cuotas.map((c) => (
            <tr key={c.numero} className="border-b border-slate-100">
              <td className="py-1.5 pr-2">{etiquetaCuota(c.numero)}</td>
              <td className="py-1.5 pr-2">{c.vencimiento}</td>
              <td className="py-1.5 pr-2 text-right">{soles(c.amortizacion)}</td>
              <td className="py-1.5 pr-2 text-right">{soles(c.interes)}</td>
              <td className="py-1.5 pr-2 text-right font-medium">{soles(c.monto)}</td>
              {conEstado && <td className="py-1.5 text-xs">{c.estado}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-300 font-semibold text-mar-profundo">
            <td colSpan={2} className="py-2">
              Total
            </td>
            <td className="py-2 pr-2 text-right">{soles(amortizado)}</td>
            <td className="py-2 pr-2 text-right">{soles(totalIntereses)}</td>
            <td className="py-2 pr-2 text-right">{soles(totalAPagar)}</td>
            {conEstado && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
