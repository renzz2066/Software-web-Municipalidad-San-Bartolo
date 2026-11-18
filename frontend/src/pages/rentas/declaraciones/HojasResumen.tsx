import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { RUTA_DJ } from './djApi'
import { ESTILO_DETERMINACION, ETIQUETA_DETERMINACION, soles, type HojaResumen } from './determinacionApi'

// HR por año de la persona (specs/rentas-nucleo-v2.md, Fase 5): la liquidada vigente y la que espera
// liquidarse, con la DJ que la originó.
export function HojasResumen({ contribuyenteId, refreshKey }: { contribuyenteId: number; refreshKey?: number }) {
  const navigate = useNavigate()
  const [filas, setFilas] = useState<HojaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        const { data } = await api.get<HojaResumen[]>('/declaraciones/determinaciones', { params: { contribuyenteId } })
        if (vivo) setFilas(data)
      } catch (err) {
        if (vivo) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [contribuyenteId, refreshKey])

  if (error) {
    return (
      <p role="alert" className="text-sm font-medium text-ladrillo">
        {error}
      </p>
    )
  }
  if (!filas) return <p className="text-sm text-slate-500">Cargando…</p>
  if (filas.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        <i aria-hidden="true" className="bi bi-journal-text mr-1" />
        Sin determinaciones desde una DJ presentada: la deuda sale del cálculo de abajo.
      </p>
    )
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Determinación por año</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <th scope="col" className="px-3 py-2">Año</th>
            <th scope="col" className="px-3 py-2">Estado</th>
            <th scope="col" className="px-3 py-2">DJ</th>
            <th scope="col" className="px-3 py-2 text-right">Base afecta</th>
            <th scope="col" className="px-3 py-2 text-right">Predial</th>
            <th scope="col" className="px-3 py-2 text-right">Emisión</th>
            <th scope="col" className="px-3 py-2 text-right">Arbitrios</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((h) => (
            <tr
              key={h.id}
              tabIndex={h.dj ? 0 : undefined}
              onClick={() => h.dj && navigate(`${RUTA_DJ}/${h.dj.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && h.dj) navigate(`${RUTA_DJ}/${h.dj.id}`)
              }}
              className={`border-b border-slate-100 ${h.dj ? 'cursor-pointer hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa' : ''}`}
            >
              <td className="px-3 py-2 font-serif">{h.anio}</td>
              <td className="px-3 py-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO_DETERMINACION[h.estado]}`}>{ETIQUETA_DETERMINACION[h.estado]}</span>
              </td>
              <td className="px-3 py-2 font-mono text-mar">{h.dj?.numeroTexto ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{soles(h.baseAfecta)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{soles(h.impuesto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{soles(h.derechoEmision)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{soles(h.arbitrios)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} className="px-3 py-2 text-xs text-slate-500">
              {filas.length} {filas.length === 1 ? 'determinación' : 'determinaciones'}. Un año liquidado desde una DJ no se recalcula con el cálculo v1: se corrige con otra DJ.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
