import { PageHeader } from '../../../components/layout/PageHeader'
import { PanelCalculo } from './PanelCalculo'

// Rentas → Cálculo Masivo: la determinación anual masiva (specs/rentas-nucleo-v2.md, Fase 6; J09).

export function CalculoMasivo() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Determinación anual masiva"
          descripcion="Actualización anual de valores (J09): a cada persona se le determina el año con lo que regía en diciembre y los parámetros nuevos. Simula primero; al liquidar se genera la cuenta. Repetirlo es seguro: lo pagado no se toca."
          volverA={{ etiqueta: 'Rentas', ruta: '/rentas' }}
        />

        <main className="mt-6 rounded-panel border border-borde bg-white p-6">
          <PanelCalculo />
        </main>
      </div>
    </div>
  )
}
