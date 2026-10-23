import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError, type Opcion } from './maestrosApi'

// Tabla editable de un parámetro anual: carga con GET, edita filas en memoria y
// guarda el conjunto completo con PUT (el backend reemplaza todo en $transaction).

export interface Columna {
  key: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'select'
  opciones?: Opcion[]
  opcional?: boolean // vacío = null ("todas")
  placeholder?: string
  decimales?: number
}

type Fila = Record<string, string>

interface Props {
  url: string // GET y PUT
  columnas: Columna[]
  bloqueado?: boolean
  conOrdenanza?: boolean // una ordenanza para todo el conjunto
  ayuda?: string
  alGuardar?: () => void
}

function aTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)) return valor.slice(0, 10)
  return String(valor)
}

export function TablaEditable({ url, columnas, bloqueado = false, conOrdenanza = true, ayuda, alGuardar }: Props) {
  const [filas, setFilas] = useState<Fila[]>([])
  const [ordenanza, setOrdenanza] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setIsLoading(true)
      setError(null)
      setOk(null)
      try {
        const { data } = await api.get<Record<string, unknown>[]>(url)
        if (cancelled) return
        setFilas(data.map((d) => Object.fromEntries(columnas.map((c) => [c.key, aTexto(d[c.key])]))))
        setOrdenanza(aTexto(data[0]?.ordenanza))
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
  }, [url, columnas])

  function cambiar(i: number, key: string, valor: string) {
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, [key]: valor } : f)))
    setOk(null)
  }

  function agregar() {
    setFilas((prev) => [...prev, Object.fromEntries(columnas.map((c) => [c.key, '']))])
    setOk(null)
  }

  function quitar(i: number) {
    setFilas((prev) => prev.filter((_, j) => j !== i))
    setOk(null)
  }

  // Valida en cliente y arma el payload con tipos correctos.
  function construir(): Record<string, unknown>[] | string {
    const items: Record<string, unknown>[] = []
    for (let i = 0; i < filas.length; i++) {
      const item: Record<string, unknown> = {}
      for (const c of columnas) {
        const v = filas[i][c.key].trim()
        if (v === '') {
          if (!c.opcional) return `Fila ${i + 1}: completa "${c.label}"`
          item[c.key] = null
          continue
        }
        if (c.tipo === 'numero' || (c.tipo === 'select' && c.opciones?.every((o) => /^\d+$/.test(o.value)))) {
          const n = Number(v)
          if (!Number.isFinite(n) || n < 0) return `Fila ${i + 1}: "${c.label}" debe ser un número válido`
          item[c.key] = n
        } else {
          item[c.key] = v
        }
      }
      items.push(item)
    }
    return items
  }

  async function guardar() {
    const items = construir()
    if (typeof items === 'string') {
      setError(items)
      return
    }
    setIsSaving(true)
    setError(null)
    setOk(null)
    try {
      const body = conOrdenanza ? { items, ordenanza: ordenanza.trim() || undefined } : { items }
      await api.put(url, body)
      setOk('Cambios guardados.')
      alGuardar?.()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <p className="p-6 text-center text-sm text-slate-500" role="status">
        Cargando…
      </p>
    )
  }

  const deshabilitado = bloqueado || isSaving

  return (
    <div className="space-y-4">
      {ayuda && <p className="text-sm text-slate-500">{ayuda}</p>}

      {conOrdenanza && (
        <div className="max-w-sm">
          <label htmlFor={`ord-${url}`} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ordenanza que lo aprueba
          </label>
          <input
            id={`ord-${url}`}
            value={ordenanza}
            maxLength={60}
            disabled={deshabilitado}
            onChange={(e) => setOrdenanza(e.target.value)}
            placeholder="Ej. O.M. N° 012-2026-MDSB"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th scope="col" className="w-10 px-2 py-2">
                #
              </th>
              {columnas.map((c) => (
                <th key={c.key} scope="col" className="px-2 py-2">
                  {c.label}
                </th>
              ))}
              <th scope="col" className="w-10 px-2 py-2">
                <span className="sr-only">Quitar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={columnas.length + 2} className="px-2 py-6 text-center text-slate-500">
                  Sin registros para este año.
                </td>
              </tr>
            )}
            {filas.map((f, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                {columnas.map((c) => {
                  const etiqueta = `${c.label}, fila ${i + 1}`
                  const clase =
                    'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100'
                  return (
                    <td key={c.key} className="px-2 py-1">
                      {c.tipo === 'select' ? (
                        <select
                          aria-label={etiqueta}
                          value={f[c.key]}
                          disabled={deshabilitado}
                          onChange={(e) => cambiar(i, c.key, e.target.value)}
                          className={clase}
                        >
                          <option value="">{c.opcional ? (c.placeholder ?? 'Todas') : 'Selecciona…'}</option>
                          {c.opciones?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label={etiqueta}
                          type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
                          inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
                          step={c.tipo === 'numero' ? (1 / 10 ** (c.decimales ?? 2)).toString() : undefined}
                          min={c.tipo === 'numero' ? 0 : undefined}
                          value={f[c.key]}
                          placeholder={c.placeholder}
                          disabled={deshabilitado}
                          onChange={(e) => cambiar(i, c.key, e.target.value)}
                          className={clase}
                        />
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => quitar(i)}
                    disabled={deshabilitado}
                    aria-label={`Quitar fila ${i + 1}`}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                  >
                    <i aria-hidden="true" className="bi bi-trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="text-sm font-medium text-emerald-700">
          {ok}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={agregar}
          disabled={deshabilitado}
          className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
          Agregar fila
        </button>
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={deshabilitado}
          className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {isSaving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
