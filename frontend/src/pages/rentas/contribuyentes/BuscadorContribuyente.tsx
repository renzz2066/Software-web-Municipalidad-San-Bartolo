import { useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import type { ContribuyenteResumen } from './tipos'

// Selector de contribuyente por documento o nombre (declarante, condóminos).

interface Props {
  id: string
  label: string
  alElegir: (c: ContribuyenteResumen) => void
  excluir?: number[]
}

export function BuscadorContribuyente({ id, label, alElegir, excluir = [] }: Props) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<ContribuyenteResumen[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buscar() {
    if (texto.trim().length < 3) {
      setError('Escribe al menos 3 caracteres')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await api.get<{ items: ContribuyenteResumen[] }>('/contribuyentes', {
        params: { q: texto.trim(), pageSize: 8 },
      })
      setResultados(data.items.filter((c) => !excluir.includes(c.id)))
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void buscar()
            }
          }}
          placeholder="DNI, RUC o nombre"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
        />
        <button
          type="button"
          onClick={() => void buscar()}
          disabled={isLoading}
          className="rounded-md border border-mar-profundo/30 px-3 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {isLoading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      {resultados && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-md ring-1 ring-slate-200" aria-label="Resultados">
          {resultados.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Sin resultados.</li>}
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  alElegir(c)
                  setResultados(null)
                  setTexto('')
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <span className="font-mono text-xs text-slate-500">
                  {c.tipoDoc} {c.numDoc}
                </span>{' '}
                <span className="font-medium text-mar-profundo">{c.nombreCompleto}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
