import { Fragment, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError } from './maestrosApi'

// Catálogo de ubicación (zonas, urbanizaciones, vías): alta y edición por fila.
// Sin borrado: los predios y aranceles los referencian (FK Restrict).

interface Campo {
  key: string
  label: string
  maxLength: number
}

interface Props {
  titulo: string
  url: string
  campos: Campo[]
  alCambiar?: () => void
}

type Registro = { id: number } & Record<string, string | number>

export function Catalogo({ titulo, url, campos, alCambiar }: Props) {
  const vacio = () => Object.fromEntries(campos.map((c) => [c.key, ''])) as Record<string, string>
  const [registros, setRegistros] = useState<Registro[]>([])
  const [editandoId, setEditandoId] = useState<number | 'nuevo' | null>(null)
  const [form, setForm] = useState<Record<string, string>>(vacio)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setIsLoading(true)
      try {
        const { data } = await api.get<Registro[]>(url)
        if (!cancelled) setRegistros(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [url, refreshKey])

  function editar(r: Registro | null) {
    setError(null)
    setEditandoId(r ? r.id : 'nuevo')
    setForm(r ? Object.fromEntries(campos.map((c) => [c.key, String(r[c.key] ?? '')])) : vacio())
  }

  async function guardar() {
    const faltante = campos.find((c) => !form[c.key]?.trim())
    if (faltante) {
      setError(`Completa "${faltante.label}"`)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      if (editandoId === 'nuevo') await api.post(url, form)
      else await api.patch(`${url}/${editandoId}`, form)
      setEditandoId(null)
      setRefreshKey((k) => k + 1)
      alCambiar?.()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsSaving(false)
    }
  }

  const clase =
    'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase focus-visible:outline-3 focus-visible:outline-turquesa'

  const filaEdicion = (
    <tr className="border-b border-slate-100 bg-mar/5">
      {campos.map((c) => (
        <td key={c.key} className="px-2 py-1">
          <input
            aria-label={c.label}
            value={form[c.key] ?? ''}
            maxLength={c.maxLength}
            onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void guardar()
              if (e.key === 'Escape') setEditandoId(null)
            }}
            className={clase}
          />
        </td>
      ))}
      <td className="whitespace-nowrap px-2 py-1 text-right">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={isSaving}
          className="rounded-md bg-mar-profundo px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => setEditandoId(null)}
          className="ml-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          Cancelar
        </button>
      </td>
    </tr>
  )

  return (
    <section aria-labelledby={`cat-${url}`} className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 id={`cat-${url}`} className="font-semibold text-mar-profundo">
          {titulo}
        </h3>
        <button
          type="button"
          onClick={() => editar(null)}
          disabled={editandoId !== null}
          className="rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
          Agregar
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-slate-500" role="status">
          Cargando…
        </p>
      ) : (
        <div className="max-h-80 overflow-auto rounded-md ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                {campos.map((c) => (
                  <th key={c.key} scope="col" className="px-2 py-2">
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {editandoId === 'nuevo' && filaEdicion}
              {registros.length === 0 && editandoId !== 'nuevo' && (
                <tr>
                  <td colSpan={campos.length + 1} className="px-2 py-4 text-center text-slate-500">
                    Sin registros.
                  </td>
                </tr>
              )}
              {registros.map((r) =>
                editandoId === r.id ? (
                  <Fragment key={r.id}>{filaEdicion}</Fragment>
                ) : (
                  <tr key={r.id} className="border-b border-slate-100">
                    {campos.map((c) => (
                      <td key={c.key} className="px-2 py-2 text-slate-700">
                        {r[c.key]}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => editar(r)}
                        disabled={editandoId !== null}
                        aria-label={`Editar ${campos.map((c) => r[c.key]).join(' ')}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-mar/10 hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                      >
                        <i aria-hidden="true" className="bi bi-pencil" />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

