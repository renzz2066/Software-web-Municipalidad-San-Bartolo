import { Link } from 'react-router-dom'
import { RUTA_BASE, soles } from '../contribuyentes/tipos'
import { direccionPredio, type ResultadoEmision as Resultado } from './valoresApi'

// Resultado de POST /rentas/valores/{simular|ejecutar}.

const MOTIVOS: { key: keyof Resultado['excluidas']; texto: string }[] = [
  { key: 'noVencidas', texto: 'aún no vencidas' },
  { key: 'yaEnValor', texto: 'ya están en un valor vigente' },
  { key: 'recalculoPendiente', texto: 'con deuda por recalcular' },
  { key: 'bajoMinimo', texto: 'en valores bajo el monto mínimo' },
]

export function ResultadoEmision({ r }: { r: Resultado }) {
  const excluidas = MOTIVOS.filter((m) => r.excluidas[m.key] > 0)
  return (
    <div className="space-y-4">
      <p
        role="status"
        className={`rounded-md px-3 py-2 text-sm font-medium ${r.ejecutado ? 'bg-emerald-50 text-emerald-800' : 'bg-mar/10 text-mar-profundo'}`}
      >
        {r.ejecutado
          ? `Emitidos ${r.valores} valores con fecha ${r.fecha}.${Object.entries(r.emitidos ?? {})
              .map(([tipo, [desde, hasta]]) => ` ${tipo} ${desde}${desde !== hasta ? ` a ${hasta}` : ''}.`)
              .join('')}`
          : `Simulación al ${r.fecha}: todavía no se emitió nada.`}
      </p>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Dato titulo="Valores" valor={String(r.valores)} />
        <Dato titulo="Contribuyentes" valor={String(r.contribuyentes)} />
        <Dato titulo="Órdenes de pago" valor={`${r.porTipo.OP?.cantidad ?? 0} · ${soles(r.porTipo.OP?.total ?? 0)}`} />
        <Dato titulo="Resoluciones" valor={`${r.porTipo.RD?.cantidad ?? 0} · ${soles(r.porTipo.RD?.total ?? 0)}`} />
      </dl>
      <p className="text-sm text-slate-700">
        {r.ejecutado ? 'Total emitido' : 'Total a emitir'} (insoluto + reajuste + interés al {r.fecha}):{' '}
        <strong>{soles(r.total)}</strong>
      </p>

      {excluidas.length > 0 && (
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-mar-profundo">Cuotas que no entran</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {excluidas.map((m) => (
              <li key={m.key}>
                {r.excluidas[m.key]} {m.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.totalRecalcular > 0 && (
        <div role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">
            {r.totalRecalcular} contribuyente(s) tienen deuda que cambiaría al recalcular: no se les emite hasta ejecutar el
            cálculo del año.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {r.recalcular.map((c) => (
              <li key={c.id}>
                <Link to={`${RUTA_BASE}/contribuyentes/${c.id}`} className="underline hover:text-amber-900">
                  {c.nombreCompleto ?? `Contribuyente #${c.id}`}
                </Link>
                {c.numDoc && <span className="font-mono text-xs"> · {c.tipoDoc} {c.numDoc}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.muestra.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="mb-2 text-left text-sm font-semibold text-mar-profundo">
              {r.ejecutado ? 'Valores emitidos' : 'Valores a emitir'}
              {r.valores > r.muestra.length && ` (primeros ${r.muestra.length} de ${r.valores})`}
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-3 py-2">Tipo</th>
                <th scope="col" className="px-3 py-2">Contribuyente</th>
                <th scope="col" className="px-3 py-2">Predio</th>
                <th scope="col" className="px-3 py-2 text-right">Cuotas</th>
                <th scope="col" className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {r.muestra.map((m, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{m.tipo}</td>
                  <td className="px-3 py-2">
                    {m.contribuyente.nombreCompleto}
                    <span className="block font-mono text-xs text-slate-500">
                      {m.contribuyente.tipoDoc} {m.contribuyente.numDoc}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{m.predio ? direccionPredio(m.predio) : 'Todos (predial)'}</td>
                  <td className="px-3 py-2 text-right">{m.cuotas}</td>
                  <td className="px-3 py-2 text-right font-medium">{soles(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r.valores === 0 && !r.ejecutado && <p className="text-sm text-slate-500">No hay deuda que cumpla los filtros.</p>}
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
