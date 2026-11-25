import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { ESTILO_ESTADO, ETIQUETA_ESTADO, RUTA_BASE, type Contribuyente } from './tipos'

// Estado de la persona (P01, P02, P04, P08, P16). Inhabilitar con deuda devuelve 409 con el monto;
// habilitar no tiene restricción. Aprobar sin documento y eliminar: solo supervisor o administrador.

const SUPERVISION = ['SUPERVISOR', 'ADMIN']

const BOTON =
  'rounded-md border px-3 py-1.5 text-xs font-medium focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'

export function EstadoPersona({ c, alCambiar }: { c: Contribuyente; alCambiar: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [motivo, setMotivo] = useState('')
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supervisa = SUPERVISION.includes(user?.rol ?? '')
  const sinDocumento = !c.numDoc && !c.excepcionAprobadaAt

  async function ejecutar(accion: () => Promise<unknown>, despues = alCambiar) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
      despues()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  function inhabilitar() {
    void ejecutar(async () => {
      await api.patch(`/contribuyentes/${c.id}/estado`, { estado: 'INHABILITADO', motivo: motivo.trim() || null })
      setPidiendoMotivo(false)
      setMotivo('')
    })
  }

  function eliminar() {
    if (!window.confirm(`¿Eliminar a ${c.nombreCompleto}? Solo procede si es un error de digitación sin historia. No se puede deshacer.`)) return
    void ejecutar(
      () => api.delete(`/contribuyentes/${c.id}`),
      () => navigate(RUTA_BASE),
    )
  }

  return (
    <section aria-labelledby="titulo-estado" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="titulo-estado" className="sr-only">
          Estado de la persona
        </h2>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[c.estado]}`}>{ETIQUETA_ESTADO[c.estado]}</span>
        {c.estado === 'INHABILITADO' ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void ejecutar(() => api.patch(`/contribuyentes/${c.id}/estado`, { estado: 'HABILITADO' }))}
            className={`${BOTON} border-mar-profundo/30 text-mar-profundo hover:bg-mar/5`}
          >
            Habilitar
          </button>
        ) : (
          !pidiendoMotivo && (
            <button type="button" disabled={ocupado} onClick={() => setPidiendoMotivo(true)} className={`${BOTON} border-slate-300 text-slate-600 hover:bg-slate-50`}>
              Inhabilitar
            </button>
          )
        )}
        {sinDocumento && supervisa && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void ejecutar(() => api.post(`/contribuyentes/${c.id}/aprobar-excepcion`))}
            className={`${BOTON} border-amber-300 text-amber-800 hover:bg-amber-50`}
          >
            Aprobar sin documento
          </button>
        )}
        {supervisa && (
          <button type="button" disabled={ocupado} onClick={eliminar} className={`${BOTON} border-ladrillo/30 text-ladrillo hover:bg-ladrillo/5`}>
            Eliminar
          </button>
        )}
      </div>

      {pidiendoMotivo && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="block font-semibold uppercase tracking-wider text-slate-500">Motivo (opcional)</span>
            <input
              value={motivo}
              maxLength={250}
              onChange={(e) => setMotivo(e.target.value)}
              className="mt-1 w-72 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
            />
          </label>
          <button type="button" disabled={ocupado} onClick={inhabilitar} className={`${BOTON} border-slate-400 bg-slate-700 text-white hover:brightness-110`}>
            Confirmar inhabilitación
          </button>
          <button type="button" onClick={() => setPidiendoMotivo(false)} className={`${BOTON} border-transparent text-slate-600 hover:bg-slate-100`}>
            Cancelar
          </button>
        </div>
      )}

      {c.estado === 'INHABILITADO' && c.motivoEstado && <p className="text-xs text-slate-500">Motivo: {c.motivoEstado}</p>}
      {c.pendientes.length > 0 && (
        <ul className="list-inside list-disc rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {c.pendientes.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {!c.numDoc && c.sinDocumentoMotivo && (
        <p className="text-xs text-slate-500">
          Sin documento: {c.sinDocumentoMotivo}
          {c.excepcionAprobadaPor && ` · Aprobado por ${c.excepcionAprobadaPor.usuario}`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-ladrillo">
          {error}
        </p>
      )}
    </section>
  )
}
