import { soles } from '../contribuyentes/tipos'
import type { EstadoCuenta, LineaEstado } from './estadoCuentaApi'

function ubicacion(p: LineaEstado['predio']) {
  if (!p) return ''
  const partes = [p.via ? `${p.via.tipoVia} ${p.via.nombre}` : null, p.numero, p.manzana ? `Mz. ${p.manzana}` : null, p.lote ? `Lt. ${p.lote}` : null]
  return partes.filter(Boolean).join(' ') || `#${p.id}`
}

// Con `seleccion` (Caja) agrega una columna de casillas para elegir las cuotas a cobrar.
export interface SeleccionCuotas {
  ids: Set<number>
  alCambiar: (ids: number[], marcar: boolean) => void
}

export function TablaEstadoCuenta({ datos, seleccion }: { datos: EstadoCuenta; seleccion?: SeleccionCuotas }) {
  if (datos.lineas.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">Sin deuda pendiente al {datos.fecha}.</p>
  }
  const t = datos.totales
  const todas = datos.lineas.map((l) => l.id)
  const todasMarcadas = seleccion ? todas.every((id) => seleccion.ids.has(id)) : false
  return (
    <div className="space-y-3">
      {datos.avisos.map((a) => (
        <p key={a} role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 print:border print:border-amber-300">
          {a}
        </p>
      ))}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm print:min-w-0 print:text-xs">
          <caption className="sr-only">Estado de cuenta al {datos.fecha}</caption>
          <thead>
            <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
              {seleccion && (
                <th scope="col" className="px-2 py-2 print:hidden">
                  <input
                    type="checkbox"
                    aria-label="Elegir todas las cuotas"
                    checked={todasMarcadas}
                    onChange={() => seleccion.alCambiar(todas, !todasMarcadas)}
                    className="h-4 w-4 accent-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
                  />
                </th>
              )}
              <th scope="col" className="px-2 py-2">Año</th>
              <th scope="col" className="px-2 py-2">Tributo</th>
              <th scope="col" className="px-2 py-2">Cuota</th>
              <th scope="col" className="px-2 py-2">Vence</th>
              <th scope="col" className="px-2 py-2">Situación</th>
              <th scope="col" className="px-2 py-2 text-right">Insoluto</th>
              <th scope="col" className="px-2 py-2 text-right">Reajuste</th>
              <th scope="col" className="px-2 py-2 text-right">Mora</th>
              <th scope="col" className="px-2 py-2 text-right">Emisión</th>
              <th scope="col" className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {datos.lineas.map((l) => (
              <tr key={l.id} className={`border-b border-slate-100 ${seleccion?.ids.has(l.id) ? 'bg-mar/5' : ''}`}>
                {seleccion && (
                  <td className="px-2 py-1.5 print:hidden">
                    <input
                      type="checkbox"
                      aria-label={`Elegir ${l.tributo.nombre} ${l.anio} cuota ${l.cuota || 'anual'}`}
                      checked={seleccion.ids.has(l.id)}
                      onChange={(e) => seleccion.alCambiar([l.id], e.target.checked)}
                      className="h-4 w-4 accent-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
                    />
                  </td>
                )}
                <td className="px-2 py-1.5">{l.anio}</td>
                <td className="px-2 py-1.5">
                  {l.tributo.nombre}
                  {l.predio && <span className="block text-xs text-slate-500">{ubicacion(l.predio)}</span>}
                  {l.estado !== 'PENDIENTE' && (
                    <span className="ml-1 rounded bg-slate-100 px-1 text-xs font-semibold text-slate-600">{l.estado}</span>
                  )}
                </td>
                <td className="px-2 py-1.5">{l.cuota || 'Anual'}</td>
                <td className={`px-2 py-1.5 ${l.diasAtraso > 0 ? 'text-red-700' : ''}`}>
                  {l.vencimiento ?? '—'}
                  {l.diasAtraso > 0 && <span className="block text-xs">{l.diasAtraso} días</span>}
                </td>
                <td className="px-2 py-1.5 text-xs text-slate-600">{l.situacion ?? '—'}</td>
                <td className="px-2 py-1.5 text-right">{soles(l.insoluto)}</td>
                <td className="px-2 py-1.5 text-right">{soles(l.reajuste)}</td>
                <td className="px-2 py-1.5 text-right">{soles(l.mora)}</td>
                <td className="px-2 py-1.5 text-right">{soles(l.derechoEmision)}</td>
                <td className="px-2 py-1.5 text-right font-semibold">{soles(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-mar-profundo">
              {seleccion && <td className="print:hidden" />}
              <th scope="row" colSpan={5} className="px-2 py-2 text-left">
                Total al {datos.fecha}
              </th>
              <td className="px-2 py-2 text-right">{soles(t.insoluto)}</td>
              <td className="px-2 py-2 text-right">{soles(t.reajuste)}</td>
              <td className="px-2 py-2 text-right">{soles(t.mora)}</td>
              <td className="px-2 py-2 text-right">{soles(t.derechoEmision)}</td>
              <td className="px-2 py-2 text-right text-base">{soles(t.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
