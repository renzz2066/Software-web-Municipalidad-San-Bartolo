import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError } from '../../rentas/maestros/maestrosApi'
import { TablaSoloLectura, type Columna } from './TablaSoloLectura'
import type { ValorTransferible, Ejecutor, Auxiliar, TipoGestion } from './coactivaApi'

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = Array.from({ length: 8 }, (_, i) => ANIO_ACTUAL + 1 - i)

const COL_VALORES: Columna[] = [
  { key: 'tipo', label: 'Tipo', tipo: 'texto' },
  { key: 'anio', label: 'Año', tipo: 'numero', decimales: 0 },
  { key: 'numero', label: 'Nº Valor', tipo: 'texto' },
  { key: 'contribuyente.nombreCompleto', label: 'Contribuyente', tipo: 'texto' },
  { key: 'contribuyente.numDoc', label: 'Doc.', tipo: 'texto' },
  { key: 'predio.codigoCatastro', label: 'Predio', tipo: 'texto' },
  { key: 'totalDeuda', label: 'Total Deuda', tipo: 'numero' },
  { key: 'fechaEmision', label: 'F. Emisión', tipo: 'fecha' },
  { key: 'fechaNotificacion', label: 'F. Notificación', tipo: 'fecha', opcional: true },
  { key: 'estado', label: 'Estado', tipo: 'texto' },
]

export function RecepcionTransferencia() {
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [tipo, setTipo] = useState('')
  const [contribuyente, setContribuyente] = useState('')
  const [estado, setEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [valores, setValores] = useState<ValorTransferible[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showMasivoModal, setShowMasivoModal] = useState(false)
  const [ejecutores, setEjecutores] = useState<Ejecutor[]>([])
  const [auxiliares, setAuxiliares] = useState<Auxiliar[]>([])
  const [tiposGestion, setTiposGestion] = useState<TipoGestion[]>([])
  const [transferenciaForm, setTransferenciaForm] = useState({ ejecutorId: '', auxiliarId: '', tipoGestionId: '' })
  const [isTransfering, setIsTransfering] = useState(false)
  const [transferResult, setTransferResult] = useState<{ exitosos: number; fallidos: number; errores: string[] } | null>(null)

  const cargarValores = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (anio) params.append('anio', String(anio))
      if (tipo) params.append('tipo', tipo)
      if (contribuyente) params.append('contribuyente', contribuyente)
      if (estado) params.append('estado', estado)
      if (fechaDesde) params.append('fechaDesde', fechaDesde)
      if (fechaHasta) params.append('fechaHasta', fechaHasta)
      params.append('page', String(page))
      params.append('limit', String(limit))
      

      const { data } = await api.get<{ data: ValorTransferible[]; total: number; page: number; limit: number }>(
        `/coactiva/recepcion-transferencia/valores?${params.toString()}`
      )
      setValores(data.data)
      setTotal(data.total)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const cargarCatalogos = async () => {
    try {
      const [ejec, aux, tg] = await Promise.all([
        api.get<Ejecutor[]>('/coactiva/recepcion-transferencia/ejecutores'),
        api.get<Auxiliar[]>('/coactiva/recepcion-transferencia/auxiliares'),
        api.get<TipoGestion[]>('/coactiva/recepcion-transferencia/tipos-gestion'),
      ])
      setEjecutores(ejec.data)
      setAuxiliares(aux.data)
      setTiposGestion(tg.data)
    } catch (err) {
      console.error('Error cargando catálogos:', err)
    }
  }

  useEffect(() => {
    cargarValores()
    cargarCatalogos()
  }, [anio, tipo, contribuyente, estado, fechaDesde, fechaHasta, page])

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

  const abrirTransferenciaIndividual = (row: ValorTransferible) => {
    setSelectedIds([row.id])
    setShowTransferModal(true)
  }

  const abrirTransferenciaMasiva = () => {
    if (selectedIds.length === 0) return
    setShowMasivoModal(true)
  }

  const cerrarModales = () => {
    setShowTransferModal(false)
    setShowMasivoModal(false)
    setTransferenciaForm({ ejecutorId: '', auxiliarId: '', tipoGestionId: '' })
    setTransferResult(null)
  }

  const ejecutarTransferencia = async (esMasivo: boolean) => {
    if (!transferenciaForm.ejecutorId || !transferenciaForm.auxiliarId) {
      setError('Debe seleccionar ejecutor y auxiliar')
      return
    }

    setIsTransfering(true)
    setError(null)
    try {
      if (esMasivo) {
        const { data } = await api.post<{ exitosos: any[]; fallidos: any[] }>(
          '/coactiva/recepcion-transferencia/valores/transferir-masivo',
          {
            valorIds: selectedIds,
            ejecutorId: Number(transferenciaForm.ejecutorId),
            auxiliarId: Number(transferenciaForm.auxiliarId),
            tipoGestionId: transferenciaForm.tipoGestionId ? Number(transferenciaForm.tipoGestionId) : undefined,
          }
        )
        setTransferResult({
          exitosos: data.exitosos.length,
          fallidos: data.fallidos.length,
          errores: data.fallidos.map((f: any) => `Valor ${f.valorId}: ${f.error}`),
        })
      } else {
        await api.post(
          `/coactiva/recepcion-transferencia/valores/${selectedIds[0]}/transferir`,
          {
            ejecutorId: Number(transferenciaForm.ejecutorId),
            auxiliarId: Number(transferenciaForm.auxiliarId),
            tipoGestionId: transferenciaForm.tipoGestionId ? Number(transferenciaForm.tipoGestionId) : undefined,
          }
        )
        setTransferResult({ exitosos: 1, fallidos: 0, errores: [] })
      }
      await cargarValores()
      setSelectedIds([])
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsTransfering(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    setSelectedIds([])
  }

  const renderCell = (col: Columna, row: ValorTransferible): React.ReactNode | null => {
    if (col.key === 'totalDeuda') {
      return <span className="font-mono tabular-nums">S/ {Number(row.totalDeuda).toFixed(2)}</span>
    }
    if (col.key === 'fechaEmision' || col.key === 'fechaNotificacion') {
      const fecha = (col.key === 'fechaEmision' ? row.fechaEmision : row.fechaNotificacion) as string
      return fecha ? new Date(fecha).toLocaleDateString('es-PE') : '-'
    }
    return null
  }

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
              <div>
                <h1 className="text-lg font-bold text-mar-profundo">Cobranza Coactiva</h1>
                <p className="text-sm text-slate-500">Recepción y Transferencia de Valores</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="filtro-anio" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Año
              </label>
              <select
                id="filtro-anio"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                {ANIOS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filtro-tipo" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tipo
              </label>
              <select
                id="filtro-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <option value="">Todos</option>
                <option value="OP">OP</option>
                <option value="RD">RD</option>
              </select>
            </div>
            <div>
              <label htmlFor="filtro-contribuyente" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Contribuyente
              </label>
              <input
                id="filtro-contribuyente"
                type="text"
                value={contribuyente}
                onChange={(e) => setContribuyente(e.target.value)}
                placeholder="DNI, RUC, nombre o código"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
              />
            </div>
            <div>
              <label htmlFor="filtro-estado" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Estado
              </label>
              <select
                id="filtro-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <option value="">Todos</option>
                <option value="EMITIDO">Emitido</option>
                <option value="NOTIFICADO">Notificado</option>
                <option value="COACTIVO">Coactivo</option>
                <option value="CANCELADO">Cancelado</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="filtro-desde" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fecha Desde
              </label>
              <input
                id="filtro-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
              />
            </div>
            <div>
              <label htmlFor="filtro-hasta" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fecha Hasta
              </label>
              <input
                id="filtro-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => { setPage(1); cargarValores(); }}
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setAnio(ANIO_ACTUAL)
                setTipo('')
                setContribuyente('')
                setEstado('')
                setFechaDesde('')
                setFechaHasta('')
                setPage(1)
                cargarValores()
              }}
              className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Limpiar
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <section className="rounded-xl bg-white shadow-md ring-1 ring-mar-profundo/10 overflow-hidden">
          <TablaSoloLectura<ValorTransferible>
            columnas={COL_VALORES}
            datos={valores}
            total={total}
            page={page}
            limit={limit}
            onPageChange={handlePageChange}
            isLoading={isLoading}
            seleccionables
            selectedIds={selectedIds}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            onRowClick={abrirTransferenciaIndividual}
            renderCell={renderCell}
          />

          <div className="border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-slate-600">
              Mostrando {valores.length} de {total} valores
            </span>
            <div className="flex gap-2">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={abrirTransferenciaMasiva}
                  disabled={isTransfering}
                  className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                >
                  Transferir {selectedIds.length} seleccionados
                </button>
              )}
            </div>
          </div>
        </section>

        {showTransferModal && (
          <TransferenciaModal
            ejecutores={ejecutores}
            auxiliares={auxiliares}
            tiposGestion={tiposGestion}
            form={transferenciaForm}
            onFormChange={setTransferenciaForm}
            onClose={cerrarModales}
            onConfirm={() => ejecutarTransferencia(false)}
            isLoading={isTransfering}
            titulo="Transferir Valor a Coactiva"
            esMasivo={false}
          />
        )}

        {showMasivoModal && (
          <TransferenciaModal
            ejecutores={ejecutores}
            auxiliares={auxiliares}
            tiposGestion={tiposGestion}
            form={transferenciaForm}
            onFormChange={setTransferenciaForm}
            onClose={cerrarModales}
            onConfirm={() => ejecutarTransferencia(true)}
            isLoading={isTransfering}
            titulo={`Transferir {selectedIds.length} Valores a Coactiva`}
            esMasivo={true}
            resultado={transferResult}
          />
        )}
      </div>
    </div>
  )
}

function TransferenciaModal({
  ejecutores,
  auxiliares,
  tiposGestion,
  form,
  onFormChange,
  onClose,
  onConfirm,
  isLoading,
  titulo,
  esMasivo,
  resultado,
}: {
  ejecutores: Ejecutor[]
  auxiliares: Auxiliar[]
  tiposGestion: TipoGestion[]
  form: { ejecutorId: string; auxiliarId: string; tipoGestionId: string }
  onFormChange: (form: { ejecutorId: string; auxiliarId: string; tipoGestionId: string }) => void
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  titulo: string
  esMasivo: boolean
  resultado?: { exitosos: number; fallidos: number; errores: string[] } | null
}) {
  if (resultado) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-bold text-mar-profundo">{titulo}</h2>
          <div className="space-y-3">
            <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="font-medium">Transferencia completada</p>
              <p>Exitosos: {resultado.exitosos}</p>
              <p>Fallidos: {resultado.fallidos}</p>
            </div>
            {resultado.errores.length > 0 && (
              <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 max-h-40 overflow-y-auto">
                <p className="font-medium mb-2">Errores:</p>
                <ul className="list-disc list-inside space-y-1">
                  {resultado.errores.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-mar-profundo">{titulo}</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="modal-ejecutor" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ejecutor <span className="text-red-500">*</span>
            </label>
            <select
              id="modal-ejecutor"
              value={form.ejecutorId}
              onChange={(e) => onFormChange({ ...form, ejecutorId: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <option value="">Seleccionar ejecutor</option>
              {ejecutores.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigo} - {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="modal-auxiliar" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Auxiliar <span className="text-red-500">*</span>
            </label>
            <select
              id="modal-auxiliar"
              value={form.auxiliarId}
              onChange={(e) => onFormChange({ ...form, auxiliarId: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <option value="">Seleccionar auxiliar</option>
              {auxiliares.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.codigo} - {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="modal-tipo-gestion" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tipo de Gestión (opcional)
            </label>
            <select
              id="modal-tipo-gestion"
              value={form.tipoGestionId}
              onChange={(e) => onFormChange({ ...form, tipoGestionId: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <option value="">Sin tipo de gestión</option>
              {tiposGestion.map((tg) => (
                <option key={tg.id} value={tg.id}>
                  {tg.codigo} - {tg.descripcion}
                </option>
              ))}
            </select>
          </div>
          {esMasivo && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Se transferirán los valores seleccionados con el mismo ejecutor y auxiliar.
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || !form.ejecutorId || !form.auxiliarId}
            className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
          >
            {isLoading ? 'Transfiriendo...' : 'Confirmar Transferencia'}
          </button>
        </div>
      </div>
    </div>
  )
}