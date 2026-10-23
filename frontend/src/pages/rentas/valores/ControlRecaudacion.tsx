import { Link } from 'react-router-dom'
import { PanelEmision } from './PanelEmision'

// Rentas → Control y Recaudación: emisión masiva de OP/RD (specs/rentas-valores-v1.md, V1).

export function ControlRecaudacion() {
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/rentas"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Rentas
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-file-earmark-text" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Emisión de valores</h1>
              <p className="text-sm text-slate-500">
                Órdenes de Pago (predial) y Resoluciones de Determinación (arbitrios) sobre la deuda vencida. Simula primero;
                una cuota nunca entra en dos valores vigentes. Para emitir a un solo contribuyente, usa la pestaña Valores de su
                ficha.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <PanelEmision />
        </main>
      </div>
    </div>
  )
}
