import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api'
import { soles } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { ESTILO_CONVENIO, ETIQUETA_CONVENIO, RUTA_CONVENIOS, type ConvenioResumen } from './fraccionamientoApi'
import { NuevoConvenio } from './NuevoConvenio'

// Pestaña "Convenios" de la ficha: convenios del contribuyente + nuevo fraccionamiento.

export function ConveniosContribuyente({ contribuyenteId, alGrabar }: { contribuyenteId: number; alGrabar?: () => void }) {
  const navigate = useNavigate()
  const [convenios, setConvenios] = useState<ConvenioResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<ConvenioResumen[]>('/rentas/convenios', { params: { contribuyenteId } })
        if (!cancelled) setConvenios(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [contribuyenteId, recarga])

  const abrir = (id: number) => navigate(`${RUTA_CONVENIOS}/${id}`)

  return (
    <div className="space-y-6 p-6">
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : !convenios ? (
        <p role="status" className="text-sm text-slate-500">
          Cargando convenios…
        </p>
      ) : convenios.length === 0 ? (
        <p className="text-sm text-slate-500">Sin convenios de fraccionamiento.</p>
      ) : (
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th scope="col" className="px-3 py-2">Convenio</th>
              <th scope="col" className="px-3 py-2">Fecha</th>
              <th scope="col" className="px-3 py-2">Cuotas</th>
              <th scope="col" className="px-3 py-2">Estado</th>
              <th scope="col" className="px-3 py-2 text-right">Deuda</th>
              <th scope="col" className="px-3 py-2 text-right">A pagar</th>
            </tr>
          </thead>
          <tbody>
            {convenios.map((c) => (
              <tr
                key={c.id}
                tabIndex={0}
                onClick={() => abrir(c.id)}
                onKeyDown={(e) => e.key === 'Enter' && abrir(c.id)}
                className="cursor-pointer border-b border-slate-100 hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <td className="px-3 py-2 font-mono text-xs font-semibold text-mar-profundo">N° {c.numero}</td>
                <td className="px-3 py-2">{c.fecha}</td>
                <td className="px-3 py-2">
                  {c.numCuotas} + inicial · {c.cuotasPendientes} pendiente(s)
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO_CONVENIO[c.estado]}`}>{ETIQUETA_CONVENIO[c.estado]}</span>
                </td>
                <td className="px-3 py-2 text-right">{soles(c.montoTotal)}</td>
                <td className="px-3 py-2 text-right font-medium">{soles(c.totalCronograma)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section aria-labelledby="nuevo-convenio" className="border-t border-slate-200 pt-4">
        <h2 id="nuevo-convenio" className="mb-3 font-semibold text-mar-profundo">
          Nuevo convenio de fraccionamiento
        </h2>
        <NuevoConvenio
          contribuyenteId={contribuyenteId}
          alGrabar={() => {
            setRecarga((k) => k + 1)
            alGrabar?.()
          }}
        />
      </section>
    </div>
  )
}
