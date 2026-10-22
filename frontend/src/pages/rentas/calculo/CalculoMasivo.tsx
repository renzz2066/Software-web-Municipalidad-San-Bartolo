import { Link } from 'react-router-dom'
import { PanelCalculo } from './PanelCalculo'

// Rentas → Cálculo Masivo (C5): todos los contribuyentes con predios activos.

export function CalculoMasivo() {
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
              <i className="bi bi-calculator" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Cálculo masivo de predial y arbitrios</h1>
              <p className="text-sm text-slate-500">
                Simula primero; al ejecutar se genera la cuenta corriente del año. Repetirlo es seguro: solo ajusta cuotas
                pendientes y nunca toca las pagadas.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <PanelCalculo />
        </main>
      </div>
    </div>
  )
}
