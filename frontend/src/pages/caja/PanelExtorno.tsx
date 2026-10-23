import { useState } from 'react'
import { api } from '../../lib/api'
import { hoyLocal } from '../../lib/fechas'
import { useAccesos } from '../../context/AccesosContext'
import { useAuth } from '../../context/AuthContext'
import { soles } from '../rentas/contribuyentes/tipos'
import { mensajeError } from '../rentas/maestros/maestrosApi'
import { MOTIVO_EXTORNO_MIN, type Recibo } from './cajaApi'

// Extorno del recibo completo con motivo (specs/caja-v1.md, K4). El cajero ve el botón en sus
// recibos de hoy; quien tiene `caja.extornos`, en cualquiera (decisión 7). El backend decide.

export function PanelExtorno({ recibo, alExtornar }: { recibo: Recibo; alExtornar: (r: Recibo) => void }) {
  const { user } = useAuth()
  const { tiene } = useAccesos()
  const [abierto, setAbierto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  const propioDeHoy = tiene('caja.cancelaciones') && recibo.cajero.id === user?.id && recibo.fechaCaja === hoyLocal()
  if (recibo.estado !== 'CANCELADO' || !(tiene('caja.extornos') || propioDeHoy)) return null

  function revisar() {
    if (motivo.trim().length < MOTIVO_EXTORNO_MIN) {
      setError(`Indica el motivo del extorno (mínimo ${MOTIVO_EXTORNO_MIN} caracteres)`)
      return
    }
    setError(null)
    setConfirmando(true)
  }

  async function extornar() {
    setProcesando(true)
    setError(null)
    try {
      const { data } = await api.post<Recibo>(`/caja/recibos/${recibo.id}/extornar`, { motivo: motivo.trim() })
      alExtornar(data)
    } catch (err) {
      setError(mensajeError(err))
      setConfirmando(false)
    } finally {
      setProcesando(false)
    }
  }

  if (!abierto) {
    return (
      <div className="mt-3 flex justify-end print:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-counterclockwise mr-1" />
          Extornar recibo
        </button>
      </div>
    )
  }

  return (
    <section aria-labelledby="extorno-titulo" className="mt-3 rounded-xl bg-white p-5 shadow-md ring-2 ring-red-300 print:hidden">
      <h2 id="extorno-titulo" className="text-sm font-bold uppercase tracking-wider text-red-800">
        Extornar recibo {recibo.numero}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Se anula el cobro completo ({soles(recibo.total)}, {recibo.lineas.length} {recibo.lineas.length === 1 ? 'cuota' : 'cuotas'}): las cuotas vuelven a
        la deuda del contribuyente y el dinero debe devolverse. El recibo queda registrado como extornado.
      </p>
      <label htmlFor="extorno-motivo" className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        Motivo
      </label>
      <textarea
        id="extorno-motivo"
        rows={2}
        maxLength={200}
        value={motivo}
        disabled={confirmando}
        onChange={(e) => setMotivo(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-50"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => (confirmando ? setConfirmando(false) : setAbierto(false))}
          disabled={procesando}
          className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {confirmando ? 'Volver' : 'Cancelar'}
        </button>
        {confirmando ? (
          <button
            type="button"
            onClick={() => void extornar()}
            disabled={procesando}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
          >
            {procesando ? 'Extornando…' : `Confirmar extorno de ${soles(recibo.total)}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={revisar}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            Extornar
          </button>
        )}
      </div>
    </section>
  )
}
