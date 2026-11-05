import { useState } from 'react'
import { PageHeader } from '../../../components/layout/PageHeader'
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
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Control y Recaudación"
          descripcion={actual.ayuda}
          volverA={{ etiqueta: 'Rentas', ruta: '/rentas' }}
        />

        <nav aria-label="Secciones de control y recaudación" role="tablist" className="mt-6 flex gap-1 overflow-x-auto">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={`whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa ${
                pestana === p.id ? 'bg-white text-mar-profundo' : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              {p.titulo}
            </button>
          ))}
        </nav>

        <main role="tabpanel" className="rounded-panel border border-borde bg-white p-6">
          {pestana === 'emision' ? <PanelEmision /> : <PanelTransferencia />}
        </main>
      </div>
    </div>
  )
}
