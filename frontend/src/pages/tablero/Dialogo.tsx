import { useEffect, useRef, type ReactNode } from 'react'

const ENFOCABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Diálogo modal accesible: foco atrapado, Esc cierra y el foco vuelve a quien lo abrió.
export function Dialogo({
  titulo,
  onClose,
  children,
  ancho = 'max-w-2xl',
}: {
  titulo: ReactNode
  onClose: () => void
  children: ReactNode
  ancho?: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    cerrarRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const nodos = [...dialogRef.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (nodos.length === 0) return
      const primero = nodos[0]
      const ultimo = nodos[nodos.length - 1]
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primero.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previo?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-mar-profundo/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${ancho} rounded-panel border border-borde bg-white p-6`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="dialogo-titulo" className="min-w-0 font-serif text-lg font-bold text-mar-profundo">
            {titulo}
          </h2>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-x-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
