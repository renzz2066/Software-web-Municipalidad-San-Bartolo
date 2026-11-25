import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { nombreDe, useCatalogo } from '../catalogos/catalogosApi'
import { mensajeError } from '../maestros/maestrosApi'
import { RUTA_BASE } from '../contribuyentes/tipos'
import type { PersonaAsociada } from './tipos'

// C4: personas asociadas al predio en un año. "Contribuyente del año" = titular al 1 de enero
// (TUO LTM art. 10): una compra en el año N afecta desde N+1 (J10).

const ANIO = new Date().getFullYear()
const ANIOS = Array.from({ length: 12 }, (_, i) => ANIO + 1 - i)

export function PersonasPredio({ predioId, recarga }: { predioId: number; recarga: number }) {
  const condiciones = useCatalogo('CONDICION_PROPIEDAD')
  const [anio, setAnio] = useState(ANIO)
  const [personas, setPersonas] = useState<PersonaAsociada[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      setError(null)
      try {
        const { data } = await api.get<{ anio: number; personas: PersonaAsociada[] }>(`/predios/${predioId}/personas`, { params: { anio } })
        if (vivo) setPersonas(data.personas)
      } catch (err) {
        if (vivo) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [predioId, anio, recarga])

  return (
    <div className="p-4">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        Año
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          {ANIOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-ladrillo">
          {error}
        </p>
      ) : !personas ? (
        <p role="status" className="mt-3 text-sm text-slate-500">
          Cargando…
        </p>
      ) : personas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nadie fue titular del predio en {anio}.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Personas asociadas al predio en {anio}</caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-3 py-2">Persona</th>
                <th scope="col" className="px-3 py-2">Condición</th>
                <th scope="col" className="px-3 py-2 text-right">%</th>
                <th scope="col" className="px-3 py-2">Desde</th>
                <th scope="col" className="px-3 py-2">Hasta</th>
                <th scope="col" className="px-3 py-2">En {anio}</th>
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.contribuyente.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <Link to={`${RUTA_BASE}/contribuyentes/${p.contribuyente.id}`} className="font-medium text-mar-profundo hover:underline">
                      {p.contribuyente.nombreCompleto}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-slate-500">
                      {p.contribuyente.tipoDoc} {p.contribuyente.numDoc}
                    </span>
                  </td>
                  <td className="px-3 py-2">{p.condicion ? nombreDe(condiciones, p.condicion) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(p.porcentaje)}</td>
                  <td className="px-3 py-2 tabular-nums">{p.fechaAdquisicion ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{p.finDesconocido ? 'Sin fecha (dato anterior)' : (p.fechaFin ?? 'Vigente')}</td>
                  <td className="px-3 py-2">
                    {p.contribuyenteDelAnio ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">Contribuyente</span>
                    ) : (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                        {p.fechaAdquisicion?.startsWith(String(anio)) ? 'Adquirió este año' : 'Asociado'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
