import { soles } from '../rentas/contribuyentes/tipos'
import { type Cierre, etiquetaMedio } from './cajaApi'

// Cuerpo imprimible del cierre de caja (K5): por medio de pago, por tributo y arqueo.

export function DetalleCierre({ cierre: c }: { cierre: Cierre }) {
  const medios = Object.entries(c.totalesPorMedio)
  const diferencia = c.diferencia === null ? null : Number(c.diferencia)
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Municipalidad Distrital de San Bartolo · Caja</p>
          <h2 className="text-lg font-bold text-mar-profundo">Cierre de caja del {c.fecha}</h2>
          <p className="text-sm text-slate-600">
            Cajero: {c.cajero.nombre ?? c.cajero.usuario} ({c.cajero.usuario})
          </p>
        </div>
        <div className="text-right text-sm">
          {c.cerrado ? (
            <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              CERRADO {c.cerradoEn && new Date(c.cerradoEn).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
            </span>
          ) : (
            <span className="rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">ABIERTO · cifras en vivo</span>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-arena-claro p-3 print:border print:border-slate-200">
          <dt className="text-xs uppercase tracking-wider text-slate-500">Recibos</dt>
          <dd className="text-xl font-bold text-mar-profundo">{c.cantidadRecibos}</dd>
        </div>
        <div className="rounded-lg bg-arena-claro p-3 print:border print:border-slate-200">
          <dt className="text-xs uppercase tracking-wider text-slate-500">Extornos</dt>
          <dd className="text-xl font-bold text-mar-profundo">{c.cantidadExtornos}</dd>
        </div>
        <div className="rounded-lg bg-arena-claro p-3 print:border print:border-slate-200">
          <dt className="text-xs uppercase tracking-wider text-slate-500">Total neto</dt>
          <dd className="text-xl font-bold text-mar-profundo">{soles(c.total)}</dd>
        </div>
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <table className="w-full text-left text-sm">
          <caption className="pb-1 text-left text-xs font-bold uppercase tracking-wider text-mar-profundo">Por medio de pago</caption>
          <tbody>
            {medios.length === 0 && (
              <tr>
                <td className="py-1 text-slate-500">Sin movimientos.</td>
              </tr>
            )}
            {medios.map(([m, v]) => (
              <tr key={m} className="border-b border-slate-100">
                <th scope="row" className="py-1 font-normal">
                  {etiquetaMedio(m)}
                </th>
                <td className="py-1 text-right font-medium">{soles(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full text-left text-sm">
          <caption className="pb-1 text-left text-xs font-bold uppercase tracking-wider text-mar-profundo">Por tributo</caption>
          <tbody>
            {c.totalesPorTributo.length === 0 && (
              <tr>
                <td className="py-1 text-slate-500">Sin movimientos.</td>
              </tr>
            )}
            {c.totalesPorTributo.map((t) => (
              <tr key={t.codigo} className="border-b border-slate-100">
                <th scope="row" className="py-1 font-normal">
                  {t.nombre}
                </th>
                <td className="py-1 text-right font-medium">{soles(t.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-sm">
        <dt className="text-slate-500">Efectivo esperado</dt>
        <dd className="font-medium">{soles(c.efectivoEsperado)}</dd>
        {c.cerrado && (
          <>
            <dt className="text-slate-500">Efectivo contado</dt>
            <dd className="font-medium">{c.efectivoDeclarado === null ? 'Sin arqueo' : soles(c.efectivoDeclarado)}</dd>
            {diferencia !== null && (
              <>
                <dt className="text-slate-500">Diferencia</dt>
                <dd className={`font-semibold ${diferencia < 0 ? 'text-red-700' : diferencia > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {diferencia === 0 ? 'Cuadra' : `${diferencia > 0 ? 'Sobrante' : 'Faltante'} ${soles(Math.abs(diferencia))}`}
                </dd>
              </>
            )}
          </>
        )}
      </dl>

      {c.cerrado && (
        <div className="hidden grid-cols-2 gap-8 pt-12 text-center text-xs text-slate-600 print:grid">
          <p className="border-t border-slate-400 pt-1">Cajero</p>
          <p className="border-t border-slate-400 pt-1">Tesorería</p>
        </div>
      )}
    </div>
  )
}
