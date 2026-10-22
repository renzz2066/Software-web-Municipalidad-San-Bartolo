import { Link, useParams, useSearchParams } from 'react-router-dom'
import { RUTA_BASE } from '../contribuyentes/tipos'
import { hoyIso, useEstadoCuenta } from './estadoCuentaApi'
import { TablaEstadoCuenta } from './TablaEstadoCuenta'

// Estado de cuenta para imprimir o guardar como PDF desde el navegador (C6).

export function EstadoCuentaImprimible() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') ?? hoyIso()
  const { datos, error, isLoading } = useEstadoCuenta(id, fecha)
  const c = datos?.contribuyente

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <Link
            to={`${RUTA_BASE}/contribuyentes/${id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-arrow-left" />
            Ficha del contribuyente
          </Link>
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="ec-fecha" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Deuda al
              </label>
              <input
                id="ec-fecha"
                type="date"
                value={fecha}
                onChange={(e) => e.target.value && setParams({ fecha: e.target.value })}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
              />
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!datos}
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
            >
              <i aria-hidden="true" className="bi bi-printer mr-1" />
              Imprimir / PDF
            </button>
          </div>
        </div>

        <main className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10 print:mt-0 print:rounded-none print:shadow-none print:ring-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Municipalidad Distrital de San Bartolo · Rentas</p>
              <h1 className="text-xl font-bold text-mar-profundo">Estado de cuenta</h1>
              <p className="text-sm text-slate-600">Deuda tributaria al {fecha}</p>
            </div>
            {c && (
              <div className="text-right text-sm">
                <p className="font-semibold text-mar-profundo">{c.nombreCompleto}</p>
                <p className="font-mono text-xs text-slate-500">
                  {c.tipoDoc} {c.numDoc}
                  {c.codigoLegacy && ` · SIMUN ${c.codigoLegacy}`}
                </p>
                <p className="text-xs text-slate-500">{c.direccionFiscal ?? ''}</p>
              </div>
            )}
          </header>

          <div className="mt-4">
            {error ? (
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
            ) : isLoading || !datos ? (
              <p role="status" className="text-sm text-slate-500">
                Calculando deuda…
              </p>
            ) : (
              <TablaEstadoCuenta datos={datos} />
            )}
          </div>

          {datos && (
            <footer className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
              Documento informativo. La mora (TIM) y el reajuste (IPM) se calculan a la fecha indicada y cambian si se paga
              en otra fecha. Generado el {new Date(datos.generado).toLocaleString('es-PE')}.
            </footer>
          )}
        </main>
      </div>
    </div>
  )
}
