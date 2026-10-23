import { useState } from 'react'
import { api } from '../../../lib/api'
import { hoyLocal } from '../../../lib/fechas'
import { mensajeError } from '../maestros/maestrosApi'
import { MODALIDADES, type Modalidad, type Valor } from './valoresApi'

// Notificar (V4) y anular (V5) un valor. Solo en pantalla: no sale al imprimir.

const CAMPO =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100'
const ETIQUETA = 'block text-xs font-semibold uppercase tracking-wider text-slate-500'
const MOTIVO_MIN = 10

export function AccionesValor({ valor, alCambiar }: { valor: Valor; alCambiar: (v: Valor) => void }) {
  const vigente = valor.estado === 'EMITIDO' || valor.estado === 'NOTIFICADO'
  if (!vigente) return null
  return (
    <div className="mt-3 grid gap-4 print:hidden lg:grid-cols-2">
      <FormNotificacion valor={valor} alCambiar={alCambiar} />
      <FormAnulacion valor={valor} alCambiar={alCambiar} />
    </div>
  )
}

function FormNotificacion({ valor, alCambiar }: { valor: Valor; alCambiar: (v: Valor) => void }) {
  const [fecha, setFecha] = useState(valor.fechaNotificacion ?? hoyLocal())
  const [modalidad, setModalidad] = useState<Modalidad>(valor.modalidadNotificacion ?? 'PERSONAL')
  const [dni, setDni] = useState(valor.notificadoDni ?? '')
  const [nombre, setNombre] = useState(valor.notificadoNombre ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const conReceptor = modalidad === 'PERSONAL' || modalidad === 'NEGATIVA'

  // Mismas reglas que el backend (valores.reglas.ts).
  function validar(): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'Indica la fecha de notificación'
    if (fecha < valor.fechaEmision) return 'La notificación no puede ser anterior a la emisión'
    if (fecha > hoyLocal()) return 'La fecha de notificación no puede ser futura'
    if (modalidad === 'PERSONAL') {
      if (!nombre.trim()) return 'Registra el nombre de quien recibió el valor'
      if (!/^[0-9A-Z]{8,12}$/.test(dni.trim().toUpperCase())) return 'Registra el DNI (8 dígitos) o CE de quien recibió el valor'
    }
    return null
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const error = validar()
    if (error) {
      setMensaje({ ok: false, texto: error })
      return
    }
    setIsSaving(true)
    setMensaje(null)
    try {
      const { data } = await api.patch<Valor>(`/rentas/valores/${valor.id}/notificacion`, {
        fecha,
        modalidad,
        dni: conReceptor ? dni.trim() || undefined : undefined,
        nombre: conReceptor ? nombre.trim() || undefined : undefined,
      })
      alCambiar(data)
      setMensaje({ ok: true, texto: `Notificación registrada. Exigible desde el ${data.fechaExigible}.` })
    } catch (err) {
      setMensaje({ ok: false, texto: mensajeError(err) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void guardar(e)} className="rounded-xl bg-white p-5 shadow-md ring-1 ring-mar-profundo/10">
      <h2 className="font-semibold text-mar-profundo">{valor.fechaNotificacion ? 'Corregir notificación' : 'Registrar notificación'}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="not-fecha" className={ETIQUETA}>
            Fecha de notificación
          </label>
          <input
            id="not-fecha"
            type="date"
            value={fecha}
            min={valor.fechaEmision}
            max={hoyLocal()}
            disabled={isSaving}
            onChange={(e) => setFecha(e.target.value)}
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="not-modalidad" className={ETIQUETA}>
            Modalidad
          </label>
          <select
            id="not-modalidad"
            value={modalidad}
            disabled={isSaving}
            onChange={(e) => setModalidad(e.target.value as Modalidad)}
            className={CAMPO}
          >
            {MODALIDADES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {conReceptor && (
          <>
            <div>
              <label htmlFor="not-nombre" className={ETIQUETA}>
                {modalidad === 'PERSONAL' ? 'Recibió (nombre)' : 'Persona que se negó (si se identificó)'}
              </label>
              <input id="not-nombre" value={nombre} maxLength={100} disabled={isSaving} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
            </div>
            <div>
              <label htmlFor="not-dni" className={ETIQUETA}>
                DNI / CE
              </label>
              <input
                id="not-dni"
                value={dni}
                maxLength={12}
                inputMode="numeric"
                disabled={isSaving}
                onChange={(e) => setDni(e.target.value)}
                className={CAMPO}
              />
            </div>
          </>
        )}
      </div>
      {mensaje && (
        <p role={mensaje.ok ? 'status' : 'alert'} className={`mt-3 text-sm font-medium ${mensaje.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {mensaje.texto}
        </p>
      )}
      <button
        type="submit"
        disabled={isSaving}
        className="mt-3 rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
      >
        <i aria-hidden="true" className="bi bi-envelope-check mr-1" />
        {isSaving ? 'Guardando…' : 'Guardar notificación'}
      </button>
    </form>
  )
}

function FormAnulacion({ valor, alCambiar }: { valor: Valor; alCambiar: (v: Valor) => void }) {
  const [motivo, setMotivo] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function anular(e: React.FormEvent) {
    e.preventDefault()
    if (motivo.trim().length < MOTIVO_MIN) {
      setError(`Explica el motivo de la anulación (mínimo ${MOTIVO_MIN} caracteres)`)
      return
    }
    if (!window.confirm('El valor quedará anulado y sus cuotas podrán recalcularse y volver a emitirse. ¿Continuar?')) {
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await api.post<Valor>(`/rentas/valores/${valor.id}/anular`, { motivo: motivo.trim() })
      alCambiar(data)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void anular(e)} className="rounded-xl bg-white p-5 shadow-md ring-1 ring-red-200">
      <h2 className="font-semibold text-red-800">Anular valor</h2>
      <p className="mt-1 text-xs text-slate-500">
        Por error en la determinación o en la declaración. No se borra: queda anulado con su motivo y en la auditoría.
      </p>
      <label htmlFor="anu-motivo" className={`${ETIQUETA} mt-3`}>
        Motivo
      </label>
      <textarea
        id="anu-motivo"
        rows={3}
        value={motivo}
        maxLength={200}
        disabled={isSaving}
        onChange={(e) => setMotivo(e.target.value)}
        className={CAMPO}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSaving}
        className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
      >
        <i aria-hidden="true" className="bi bi-x-circle mr-1" />
        {isSaving ? 'Anulando…' : 'Anular valor'}
      </button>
    </form>
  )
}
