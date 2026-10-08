import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../../lib/api'

interface EliminarUsuarioModalProps {
  id: number
  usuario: string
  onClose: () => void
  onDeleted: () => void
}

export function EliminarUsuarioModal({ id, usuario, onClose, onDeleted }: EliminarUsuarioModalProps) {
  const [segundos, setSegundos] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (segundos <= 0) return
    const timer = setTimeout(() => setSegundos((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [segundos])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleConfirmar() {
    setError(null)
    setIsDeleting(true)
    try {
      await api.delete(`/users/${id}`)
      onDeleted()
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status
        const message = (err.response?.data as { message?: string | string[] } | undefined)?.message
        if (status === 404) {
          setError('El usuario ya no existe.')
        } else if (status === 409) {
          setError('No se puede eliminar: el usuario tiene registros asociados.')
        } else if (status === 401) {
          setError('Sesión vencida. Vuelve a ingresar.')
        } else if (status === 403) {
          setError('Sin permisos para eliminar usuarios.')
        } else if (status === 400 && message) {
          setError(Array.isArray(message) ? message[0] : message)
        } else {
          setError('No se pudo conectar con el servidor. Intenta nuevamente.')
        }
      } else {
        setError('No se pudo conectar con el servidor. Intenta nuevamente.')
      }
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-mar-profundo/50 p-4"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="eliminar-usuario-titulo"
        aria-describedby="eliminar-usuario-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl ring-2 ring-amber-500"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-600"
          >
            <i className="bi bi-exclamation-triangle" />
          </span>
          <h2 id="eliminar-usuario-titulo" className="text-base font-bold text-mar-profundo">
            Eliminar usuario
          </h2>
        </div>

        <p id="eliminar-usuario-desc" className="mt-3 text-sm text-slate-600">
          ¿Estás seguro de eliminar al usuario <strong className="text-mar-profundo">{usuario}</strong>?
          Esta acción no se puede deshacer.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={segundos > 0 || isDeleting}
            onClick={handleConfirmar}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            {isDeleting ? 'Eliminando…' : segundos > 0 ? `Confirmar (${segundos})` : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
