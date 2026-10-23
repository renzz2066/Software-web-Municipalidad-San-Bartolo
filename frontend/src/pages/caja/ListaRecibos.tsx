import { Link } from 'react-router-dom'
import { soles } from '../rentas/contribuyentes/tipos'
import { etiquetaMedio, horaLima, type ReciboListado, RUTA_RECIBOS } from './cajaApi'

// Tabla de recibos (cobro del día y extornos); el recibo se abre con `state.volverA` para regresar.

export function ListaRecibos({ recibos, volverA, mostrarCajero = false }: { recibos: ReciboListado[]; volverA: string; mostrarCajero?: boolean }) {
  if (recibos.length === 0) {
    return <p className="p-4 text-center text-sm text-slate-500">Sin recibos.</p>
  }
  const vigentes = recibos.filter((r) => r.estado === 'CANCELADO')
  const total = vigentes.reduce((a, r) => a + Number(r.total), 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">Recibos</caption>
        <thead>
          <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
            <th scope="col" className="px-2 py-2">Recibo</th>
            <th scope="col" className="px-2 py-2">Fecha</th>
            <th scope="col" className="px-2 py-2">Contribuyente</th>
            {mostrarCajero && <th scope="col" className="px-2 py-2">Cajero</th>}
            <th scope="col" className="px-2 py-2">Medio</th>
            <th scope="col" className="px-2 py-2 text-right">Total</th>
            <th scope="col" className="px-2 py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {recibos.map((r) => (
            <tr key={r.id} className={`border-b border-slate-100 ${r.estado === 'EXTORNADO' ? 'text-slate-400' : ''}`}>
              <td className="whitespace-nowrap px-2 py-1.5">
                <Link
                  to={`${RUTA_RECIBOS}/${r.id}`}
                  state={{ volverA }}
                  className="font-mono font-medium text-mar hover:text-mar-profundo hover:underline focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  {r.numero}
                </Link>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {r.fechaCaja} <span className="text-xs text-slate-500">{horaLima(r.fecha)}</span>
              </td>
              <td className="px-2 py-1.5">
                {r.contribuyente.nombreCompleto}
                <span className="block font-mono text-xs text-slate-500">
                  {r.contribuyente.tipoDoc} {r.contribuyente.numDoc} · {r.cuotas} {r.cuotas === 1 ? 'cuota' : 'cuotas'}
                </span>
              </td>
              {mostrarCajero && <td className="px-2 py-1.5">{r.cajero}</td>}
              <td className="px-2 py-1.5">{etiquetaMedio(r.medioPago)}</td>
              <td className={`whitespace-nowrap px-2 py-1.5 text-right font-medium ${r.estado === 'EXTORNADO' ? 'line-through' : ''}`}>{soles(r.total)}</td>
              <td className="px-2 py-1.5">
                {r.estado === 'EXTORNADO' ? (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">EXTORNADO</span>
                ) : (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">COBRADO</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold text-mar-profundo">
            <th scope="row" colSpan={mostrarCajero ? 5 : 4} className="px-2 py-2 text-left">
              {vigentes.length} cobrados{recibos.length > vigentes.length && ` · ${recibos.length - vigentes.length} extornados`}
            </th>
            <td className="px-2 py-2 text-right">{soles(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
