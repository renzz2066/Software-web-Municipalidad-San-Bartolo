import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PanelTransferencia } from '../transferencias/PanelTransferencia'
import { PanelEmision } from './PanelEmision'

// Rentas → Control y Recaudación (specs/rentas-valores-v1.md): emisión masiva de OP/RD (V1) y
// transferencia de valores exigibles a Cobranza Coactiva (V7). Fraccionar: ficha del contribuyente.

const PESTANAS = [
  {
    id: 'emision',
    titulo: 'Emisión de valores',
    ayuda:
      'Órdenes de Pago (predial) y Resoluciones de Determinación (arbitrios) sobre la deuda vencida. Simula primero; una cuota nunca entra en dos valores vigentes. Para un solo contribuyente usa la pestaña Valores de su ficha.',
  },
  {
    id: 'transferencia',
    titulo: 'Transferencia a coactivo',
    ayuda:
      'Valores notificados cuya fecha de exigibilidad ya llegó y que todavía tienen deuda pendiente. Se envían por memorándum al Ejecutor Coactivo; sus cuotas pasan a estado coactivo.',
  },
] as const

export function ControlRecaudacion() {
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['id']>('emision')
  const actual = PESTANAS.find((p) => p.id === pestana)!

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
              <i className="bi bi-graph-up-arrow" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Control y Recaudación</h1>
              <p className="text-sm text-slate-500">{actual.ayuda}</p>
            </div>
          </div>
        </header>

        <nav aria-label="Secciones de control y recaudación" role="tablist" className="mt-6 flex gap-1 overflow-x-auto">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa ${
                pestana === p.id ? 'bg-white text-mar-profundo shadow-sm' : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              {p.titulo}
            </button>
          ))}
        </nav>

        <main role="tabpanel" className="rounded-b-xl rounded-tr-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          {pestana === 'emision' ? <PanelEmision /> : <PanelTransferencia />}
        </main>
      </div>
    </div>
  )
}
