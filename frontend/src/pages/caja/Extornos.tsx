import { Link } from 'react-router-dom'
import { ConsultaRecibos } from './ConsultaRecibos'

// Caja → Extorno (specs/caja-v1.md, K4, decisión 7): quien tiene `caja.extornos` busca cualquier
// recibo por día o por número y lo extorna desde su detalle, con motivo.

export function Extornos() {
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/caja"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Caja
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-arrow-counterclockwise" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Extorno</h1>
              <p className="text-sm text-slate-500">
                Anula un cobro completo con motivo: las cuotas vuelven a la deuda y el recibo queda extornado. El extorno cuenta en
                la caja de hoy de quien lo hace.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <ConsultaRecibos />
        </main>
      </div>
    </div>
  )
}
