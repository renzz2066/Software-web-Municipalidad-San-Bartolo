import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api'
import { soles } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { PanelEmision } from './PanelEmision'
import { ESTILO_VALOR, RUTA_VALORES, direccionPredio, numeroValor, type ValorResumen } from './valoresApi'

// Pestaña "Valores" de la ficha: OP/RD del contribuyente + emisión individual.

export function ValoresContribuyente({ contribuyenteId, alEmitir }: { contribuyenteId: number; alEmitir?: () => void }) {
  const navigate = useNavigate()
  const [valores, setValores] = useState<ValorResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<ValorResumen[]>('/rentas/valores', { params: { contribuyenteId } })
        if (!cancelled) setValores(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [contribuyenteId, recarga])

  const abrir = (id: number) => navigate(`${RUTA_VALORES}/${id}`)

  return (
    <div className="space-y-6 p-6">
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : !valores ? (
        <p role="status" className="text-sm text-slate-500">
          Cargando valores…
        </p>
      ) : valores.length === 0 ? (
        <p className="text-sm text-slate-500">Sin órdenes de pago ni resoluciones emitidas.</p>
      ) : (
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th scope="col" className="px-3 py-2">Valor</th>
              <th scope="col" className="px-3 py-2">Ejercicio</th>
              <th scope="col" className="px-3 py-2">Predio</th>
              <th scope="col" className="px-3 py-2">Emisión</th>
              <th scope="col" className="px-3 py-2">Estado</th>
              <th scope="col" className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {valores.map((v) => (
              <tr
                key={v.id}
                tabIndex={0}
                onClick={() => abrir(v.id)}
                onKeyDown={(e) => e.key === 'Enter' && abrir(v.id)}
                className="cursor-pointer border-b border-slate-100 hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <td className="px-3 py-2 font-mono text-xs font-semibold text-mar-profundo">{numeroValor(v)}</td>
                <td className="px-3 py-2">
                  {v.aniosFiscales.join(', ')} · {v.cuotas} cuota(s)
                </td>
                <td className="px-3 py-2 text-slate-600">{v.tipo === 'RM' ? 'Multa tributaria' : v.tipo === 'RD' ? direccionPredio(v.predio) : 'Predial'}</td>
                <td className="px-3 py-2">{v.fechaEmision.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO_VALOR[v.estado]}`}>{v.estado}</span>
                </td>
                <td className="px-3 py-2 text-right font-medium">{soles(v.totalDeuda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section aria-labelledby="emitir-individual" className="border-t border-slate-200 pt-4">
        <h2 id="emitir-individual" className="mb-3 font-semibold text-mar-profundo">
          Emitir valores a este contribuyente
        </h2>
        <PanelEmision
          contribuyenteId={contribuyenteId}
          alEjecutar={() => {
            setRecarga((k) => k + 1)
            alEmitir?.()
          }}
        />
      </section>
    </div>
  )
}
