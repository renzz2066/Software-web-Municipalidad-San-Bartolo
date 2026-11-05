import { PageHeader } from '../../../components/layout/PageHeader'
import { PanelCalculo } from './PanelCalculo'

// Rentas → Cálculo Masivo (C5): todos los contribuyentes con predios activos.

export function CalculoMasivo() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Cálculo masivo de predial y arbitrios"
          descripcion="Simula primero; al ejecutar se genera la cuenta corriente del año. Repetirlo es seguro: solo ajusta cuotas pendientes y nunca toca las pagadas."
          volverA={{ etiqueta: 'Rentas', ruta: '/rentas' }}
        />

        <main className="mt-6 rounded-panel border border-borde bg-white p-6">
          <PanelCalculo />
        </main>
      </div>
    </div>
  )
}
