import { useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { RUTA_BASE } from '../contribuyentes/tipos'
import { hoyIso, useEstadoCuenta } from './estadoCuentaApi'
import { TablaEstadoCuenta } from './TablaEstadoCuenta'
import { NombreMuni } from '../../../muni/MuniContext'

// Estado de cuenta para imprimir o guardar como PDF desde el navegador (C6).

export function EstadoCuentaImprimible() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') ?? hoyIso()
  const { datos, error, isLoading } = useEstadoCuenta(id, fecha)
  const c = datos?.contribuyente

  return (
    <div className="p-4 sm:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Estado de cuenta"
          descripcion={`Deuda tributaria al ${fecha}`}
          volverA={{ etiqueta: 'Ficha del contribuyente', ruta: `${RUTA_BASE}/contribuyentes/${id}` }}
          accion={{ etiqueta: 'Imprimir / PDF', icono: 'bi bi-printer', onClick: () => window.print(), disabled: !datos }}
        />

        <div className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
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
        </div>

        <main className="mt-4 rounded-panel border border-borde bg-white p-6 print:mt-0 print:rounded-none print:border-0">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500"><NombreMuni /> · Rentas</p>
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
              <p role="alert" className="text-sm font-medium text-ladrillo">
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
