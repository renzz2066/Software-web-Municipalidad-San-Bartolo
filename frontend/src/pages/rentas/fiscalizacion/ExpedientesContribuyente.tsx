import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { ESTILO_ESTADO, ETIQUETA_ESTADO, type ExpedienteListado, RUTA_EXPEDIENTES, RUTA_FISCALIZACION, etiquetaTipo } from './fiscalizacionApi'

// Pestaña "Fiscalización" de la ficha (specs/rentas-fiscalizacion-v1.md): expedientes del contribuyente.
// La apertura sigue en Rentas → Fiscalización Tributaria.

export function ExpedientesContribuyente({ contribuyenteId }: { contribuyenteId: number }) {
  const [expedientes, setExpedientes] = useState<ExpedienteListado[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<ExpedienteListado[]>('/rentas/fiscalizacion/expedientes', { params: { contribuyenteId } })
        if (!cancelled) setExpedientes(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [contribuyenteId])

  return (
    <div className="space-y-4 p-6">
      {error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : !expedientes ? (
        <p role="status" className="text-sm text-slate-500">
          Cargando expedientes…
        </p>
      ) : expedientes.length === 0 ? (
        <p className="text-sm text-slate-500">Sin expedientes de fiscalización.</p>
      ) : (
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Expedientes de fiscalización del contribuyente</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th scope="col" className="px-3 py-2">Expediente</th>
              <th scope="col" className="px-3 py-2">Años</th>
              <th scope="col" className="px-3 py-2">Predios</th>
              <th scope="col" className="px-3 py-2">Fiscalizador</th>
              <th scope="col" className="px-3 py-2">Inspección</th>
              <th scope="col" className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {expedientes.map((x) => (
              <tr key={x.id} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-3 py-2">
                  <Link
                    to={`${RUTA_EXPEDIENTES}/${x.id}`}
                    className="font-mono font-medium text-mar hover:text-mar-profundo hover:underline focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    FIS {x.numero}
                  </Link>
                  <span className="block text-xs text-slate-500">
                    {etiquetaTipo(x.tipo)} · {x.fechaApertura}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">{x.anioDesde === x.anioHasta ? x.anioDesde : `${x.anioDesde}–${x.anioHasta}`}</td>
                <td className="px-3 py-2">{x.predios}</td>
                <td className="px-3 py-2">{x.fiscalizador}</td>
                <td className="whitespace-nowrap px-3 py-2">{x.inspeccion ? `${x.inspeccion.fecha} ${x.inspeccion.hora}` : '—'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[x.estado]}`}>{ETIQUETA_ESTADO[x.estado]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Link
        to={RUTA_FISCALIZACION}
        className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
      >
        <i aria-hidden="true" className="bi bi-folder-plus" />
        Abrir un expediente en Fiscalización Tributaria
      </Link>
    </div>
  )
}
