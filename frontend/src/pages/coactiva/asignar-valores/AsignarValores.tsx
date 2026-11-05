import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { mensajeError } from '../../rentas/maestros/maestrosApi'
import { TablaSoloLectura, type Columna } from '../recepcion-transferencia/TablaSoloLectura'

interface Memorandum {
  id: number
  numero: string
  anio: number
  areaOrigen: string
  fechaRecepcion: string
}

interface Auxiliar {
  id: number
  codigo: string
  nombre: string
  activo: boolean
}

interface ValorAsignable {
  id: number
  tipo: string
  anio: number
  numero: string
  contribuyente: { nombreCompleto: string; numDoc: string }
  totalDeuda: number
  auxiliarAsignado?: { id: number; codigo: string; nombre: string } | null
  [key: string]: unknown
}

const COL_VALORES: Columna[] = [
  { key: 'tipo', label: 'Tipo', tipo: 'texto' },
  { key: 'anio', label: 'Año', tipo: 'numero', decimales: 0 },
  { key: 'numero', label: 'Nº Valor', tipo: 'texto' },
  { key: 'contribuyente.nombreCompleto', label: 'Contribuyente', tipo: 'texto' },
  { key: 'contribuyente.numDoc', label: 'Doc.', tipo: 'texto' },
  { key: 'totalDeuda', label: 'Total Deuda', tipo: 'numero' },
]

export function AsignarValores() {
  const [memorandums, setMemorandums] = useState<Memorandum[]>([])
  const [auxiliares, setAuxiliares] = useState<Auxiliar[]>([])
  const [valores, setValores] = useState<ValorAsignable[]>([])
  const [selectedMemorandum, setSelectedMemorandum] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [auxiliarSeleccionado, setAuxiliarSeleccionado] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAsigning, setIsAsigning] = useState(false)

  const cargarMemorandums = async () => {
    try {
      const { data } = await api.get('/coactiva/asignar-valores/memorandums')
      setMemorandums(data)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  const cargarAuxiliares = async () => {
    try {
      const { data } = await api.get('/coactiva/asignar-valores/auxiliares')
      setAuxiliares(data)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  const cargarValores = async (memorandumId: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/coactiva/asignar-valores/valores/' + memorandumId)
      setValores(data)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const manejarAsignar = async () => {
    if (!selectedIds.length || !auxiliarSeleccionado) {
      setError('Seleccione valores y un auxiliar')
      return
    }

    setIsAsigning(true)
    setError(null)
    try {
      await api.post('/coactiva/asignar-valores/asignar', {
        valorIds: selectedIds,
        auxiliarId: auxiliarSeleccionado,
      })
      if (selectedMemorandum) {
        await cargarValores(selectedMemorandum)
      }
      setSelectedIds([])
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsAsigning(false)
    }
  }

  const handleSelectRow = (id: number | string, checked: boolean) => {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id
    if (checked) {
      setSelectedIds((prev) => [...prev, numId])
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== numId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(valores.map((v) => v.id))
    } else {
      setSelectedIds([])
    }
  }

  const renderCell = (col: Columna, row: ValorAsignable): React.ReactNode | null => {
    if (col.key === 'totalDeuda') {
      return <span className="font-mono tabular-nums">S/ {Number(row.totalDeuda).toFixed(2)}</span>
    }
    return null
  }

  useEffect(() => {
    cargarMemorandums()
    cargarAuxiliares()
  }, [])

  useEffect(() => {
    if (selectedMemorandum) {
      cargarValores(selectedMemorandum)
    } else {
      setValores([])
      setSelectedIds([])
    }
  }, [selectedMemorandum])

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          to="/coactivo"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Cobranza Coactiva
        </Link>

        <header className="mb-6 mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-person-check" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Cobranza Coactiva</h1>
              <p className="text-sm text-slate-500">Asignar Valores a Auxiliares</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Panel de memorandums */}
          <aside className="rounded-xl bg-white p-4 shadow-md ring-1 ring-mar-profundo/10 h-fit">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mar-profundo">Memorandums</h2>
              {selectedMemorandum && (
                <button
                  type="button"
                  onClick={() => { setSelectedMemorandum(null); setSelectedIds([]); }}
                  className="text-xs text-mar hover:text-mar-profundo"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="space-y-1">
              {memorandums.length === 0 && (
                <p className="text-xs text-slate-400">Sin memorandums.</p>
              )}
              {memorandums.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMemorandum(selectedMemorandum === m.id ? null : m.id)
                    setSelectedIds([])
                    setAuxiliarSeleccionado(null)
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedMemorandum === m.id
                      ? 'bg-mar-profundo text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="block font-medium">{m.numero}</span>
                  <span className={`block text-xs ${selectedMemorandum === m.id ? 'text-white/70' : 'text-slate-500'}`}>
                    {m.anio} · {m.areaOrigen}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {/* Contenido derecho */}
          <div className="space-y-4">
            {selectedMemorandum ? (
              <>
                {/* Selector de auxiliar */}
                <div className="rounded-xl bg-white p-4 shadow-md ring-1 ring-mar-profundo/10">
                  <label htmlFor="auxiliar-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Auxiliar Asignado
                  </label>
                  <select
                    id="auxiliar-select"
                    value={auxiliarSeleccionado ?? ''}
                    onChange={(e) => setAuxiliarSeleccionado(e.target.value ? Number(e.target.value) : null)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    <option value="">-- Seleccione un auxiliar --</option>
                    {auxiliares.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                  {auxiliares.length === 0 && (
                    <p className="mt-1 text-xs text-slate-400">No hay auxiliares disponibles.</p>
                  )}
                </div>

                {/* Tabla de valores */}
                <section className="rounded-xl bg-white shadow-md ring-1 ring-mar-profundo/10 overflow-hidden">
                  <TablaSoloLectura<ValorAsignable>
                    columnas={COL_VALORES}
                    datos={valores}
                    total={valores.length}
                    page={1}
                    limit={100}
                    onPageChange={() => {}}
                    isLoading={isLoading}
                    seleccionables
                    selectedIds={selectedIds}
                    onSelectRow={handleSelectRow}
                    onSelectAll={handleSelectAll}
                    renderCell={renderCell}
                  />

                  <div className="border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-slate-600">
                      {selectedIds.length} de {valores.length} seleccionados
                    </span>
                    <button
                      type="button"
                      onClick={manejarAsignar}
                      disabled={isAsigning || !selectedIds.length || !auxiliarSeleccionado}
                      className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                    >
                      {isAsigning
                        ? 'Asignando...'
                        : selectedIds.length && auxiliarSeleccionado
                          ? `Asignar ${selectedIds.length} valor(es) a ${auxiliares.find((a) => a.id === auxiliarSeleccionado)?.nombre}`
                          : 'Asignar Valores'}
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-xl bg-white p-8 text-center shadow-md ring-1 ring-mar-profundo/10">
                <i aria-hidden="true" className="bi bi-folder2-open text-3xl text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-600">Seleccione un memorándum</p>
                <p className="mt-1 text-xs text-slate-400">Elija un memorándum de la lista para ver y asignar sus valores.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
