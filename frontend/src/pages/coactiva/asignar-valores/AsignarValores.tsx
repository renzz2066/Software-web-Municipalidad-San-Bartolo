import { useEffect, useState } from 'react'
import { PageHeader } from '../../../components/layout/PageHeader'
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

  const [recarga, setRecarga] = useState(0)

  // Cambiar de memorándum limpia la tabla aquí (no en un efecto) y dispara la carga.
  const elegirMemorandum = (id: number | null) => {
    setSelectedMemorandum(id)
    setSelectedIds([])
    setValores([])
    setError(null)
    setIsLoading(id !== null)
  }

  useEffect(() => {
    let cancelado = false
    async function cargarMaestros() {
      try {
        const [memos, aux] = await Promise.all([
          api.get<Memorandum[]>('/coactiva/asignar-valores/memorandums'),
          api.get<Auxiliar[]>('/coactiva/asignar-valores/auxiliares'),
        ])
        if (cancelado) return
        setMemorandums(memos.data)
        setAuxiliares(aux.data)
      } catch (err) {
        if (!cancelado) setError(mensajeError(err))
      }
    }
    void cargarMaestros()
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    if (selectedMemorandum === null) return
    let cancelado = false
    async function cargarValores(memorandumId: number) {
      try {
        const { data } = await api.get<ValorAsignable[]>('/coactiva/asignar-valores/valores/' + memorandumId)
        if (!cancelado) setValores(data)
      } catch (err) {
        if (!cancelado) setError(mensajeError(err))
      } finally {
        if (!cancelado) setIsLoading(false)
      }
    }
    void cargarValores(selectedMemorandum)
    return () => {
      cancelado = true
    }
  }, [selectedMemorandum, recarga])

  const manejarAsignar = async () => {
    if (!selectedIds.length || !auxiliarSeleccionado) {
      setError('Seleccione valores y un auxiliar')
      return
    }

    setIsAsigning(true)
    setError(null)
    try {
      const { data } = await api.post<{ exitosos: number; fallidos: { valorId: number; error: string }[] }>(
        '/coactiva/asignar-valores/asignar',
        { valorIds: selectedIds, auxiliarId: auxiliarSeleccionado },
      )
      // El backend rechaza valores no recibidos o que ya salieron de coactiva: se informan, no se ocultan.
      if (data.fallidos.length > 0) {
        const detalle = data.fallidos.map((f) => `valor ${f.valorId}: ${f.error}`).join('; ')
        setError(`${data.exitosos} asignado(s). No se asignaron ${data.fallidos.length}: ${detalle}`)
      }
      setIsLoading(true)
      setRecarga((n) => n + 1)
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

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <div className="mb-6">
          <PageHeader
            titulo="Asignar valores a auxiliares"
            descripcion="Elige un memorándum y asigna sus valores recibidos a un auxiliar coactivo."
            volverA={{ etiqueta: 'Cobranza Coactiva', ruta: '/coactivo' }}
          />
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-ladrillo/5 px-4 py-3 text-sm text-ladrillo" role="alert">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
          {/* Panel de memorandums */}
          <aside className="rounded-panel border border-borde bg-white p-4 h-fit">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mar-profundo">Memorandums</h2>
              {selectedMemorandum && (
                <button
                  type="button"
                  onClick={() => elegirMemorandum(null)}
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
                    elegirMemorandum(selectedMemorandum === m.id ? null : m.id)
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
                <div className="rounded-panel border border-borde bg-white p-4">
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
                <section className="rounded-panel border border-borde bg-white overflow-hidden">
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
              <div className="rounded-panel border border-borde bg-white p-8 text-center">
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
