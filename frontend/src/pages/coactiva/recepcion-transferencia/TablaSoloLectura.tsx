import { useMemo } from 'react'

export interface Columna {
  key: string
  label: string
  tipo: 'texto' | 'numero' | 'fecha' | 'select'
  opciones?: { value: string; label: string }[]
  opcional?: boolean
  placeholder?: string
  decimales?: number
}

interface Props<T extends Record<string, unknown>> {
  columnas: Columna[]
  datos: T[]
  total: number
  page: number
  limit: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  seleccionables?: boolean
  selectedIds?: (number | string)[]
  onSelectRow?: (id: number | string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  onRowClick?: (row: T) => void
  renderCell?: (col: Columna, row: T) => React.ReactNode | null
}

function aTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor)) return valor.slice(0, 10)
  return String(valor)
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: any, part) => acc?.[part], obj)
}

export function TablaSoloLectura<T extends Record<string, unknown>>({
  columnas,
  datos,
  total,
  page,
  limit,
  onPageChange,
  isLoading = false,
  seleccionables = false,
  selectedIds = [],
  onSelectRow,
  onSelectAll,
  onRowClick,
  renderCell,
}: Props<T>) {
  const totalPages = useMemo(() => Math.ceil(total / limit) || 1, [total, limit])

  if (isLoading) {
    return (
      <p className="p-6 text-center text-sm text-slate-500" role="status">
        Cargando…
      </p>
    )
  }

  const allSelected = seleccionables && datos.length > 0 && datos.every((row) =>
    selectedIds.includes(row.id as number | string)
  )

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              {seleccionables && (
                <th scope="col" className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    className="rounded border-slate-300 text-mar-profundo focus:ring-mar-profundo"
                    aria-label="Seleccionar todos"
                  />
                </th>
              )}
              <th scope="col" className="w-10 px-2 py-2">#</th>
              {columnas.map((c) => (
                <th key={c.key} scope="col" className="px-2 py-2">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.length === 0 && (
              <tr>
                <td colSpan={columnas.length + (seleccionables ? 2 : 1)} className="px-2 py-6 text-center text-slate-500">
                  Sin registros.
                </td>
              </tr>
            )}
            {datos.map((row, i) => {
              const rowId = row.id as number | string
              const isSelected = selectedIds.includes(rowId)
              return (
                <tr
                  key={rowId}
                  className={`border-b border-slate-100 ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {seleccionables && (
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation()
                          onSelectRow?.(rowId, e.target.checked)
                        }}
                        className="rounded border-slate-300 text-mar-profundo focus:ring-mar-profundo"
                      />
                    </td>
                  )}
                  <td className="px-2 py-1 text-slate-400">{(page - 1) * limit + i + 1}</td>
                  {columnas.map((c) => (
                    <td key={c.key} className="px-2 py-1">
                      {renderCell?.(c, row) ?? aTexto(getNestedValue(row, c.key))}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-600">
            Mostrando {datos.length} de {total} registros
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-600">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}