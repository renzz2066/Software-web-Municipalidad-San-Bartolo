import { PageHeader } from '../../components/layout/PageHeader'
import { ConsultaRecibos } from './ConsultaRecibos'

// Caja → Extorno (specs/caja-v1.md, K4, decisión 7): quien tiene `caja.extornos` busca cualquier
// recibo por día o por número y lo extorna desde su detalle, con motivo.

export function Extornos() {
  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Extorno"
          descripcion="Anula un cobro completo con motivo: las cuotas vuelven a la deuda y el recibo queda extornado. El extorno cuenta en la caja de hoy de quien lo hace."
          volverA={{ etiqueta: 'Caja', ruta: '/caja' }}
        />

        <main className="mt-6 rounded-panel border border-borde bg-white p-6">
          <ConsultaRecibos />
        </main>
      </div>
    </div>
  )
}
