import { Link } from 'react-router-dom'

export interface PageHeaderProps {
  titulo: string
  descripcion?: string
  /** Etiqueta y ruta del botón "Volver a {pantalla anterior}" (arriba a la izquierda). */
  volverA?: { etiqueta: string; ruta: string }
  /** Acción primaria de la pantalla (una sola; opcional). `disabled` aplica a botones (p. ej. Imprimir sin datos). */
  accion?: { etiqueta: string; icono?: string; to?: string; onClick?: () => void; disabled?: boolean }
}

// Cabecera de toda pantalla interna (spec criterio 4): degradado azul con la
// ola del login sin animar, "Volver a…" arriba a la izquierda y una sola
// acción primaria a la derecha. Se oculta al imprimir (pantallas imprimibles).
export function PageHeader({ titulo, descripcion, volverA, accion }: PageHeaderProps) {
  const claseBoton =
    'inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-mar-profundo transition hover:bg-arena-suave focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'

  return (
    <header className="relative overflow-hidden rounded-panel bg-gradient-to-r from-mar-profundo via-mar-medio to-mar px-4 py-5 text-white print:hidden sm:px-6">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-2xl">
          {volverA && (
            <Link
              to={volverA.ruta}
              className="mb-2 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium text-white/85 hover:text-white focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <i aria-hidden="true" className="bi bi-arrow-left" />
              Volver a {volverA.etiqueta}
            </Link>
          )}
          <h1 className="font-serif text-2xl font-bold leading-tight sm:text-3xl">{titulo}</h1>
          {descripcion && (
            <p className="mt-1.5 max-w-xl text-sm text-white/85">{descripcion}</p>
          )}
        </div>

        {accion &&
          (accion.to ? (
            <Link to={accion.to} className={claseBoton}>
              {accion.icono && <i aria-hidden="true" className={accion.icono} />}
              {accion.etiqueta}
            </Link>
          ) : (
            <button type="button" onClick={accion.onClick} disabled={accion.disabled} className={claseBoton}>
              {accion.icono && <i aria-hidden="true" className={accion.icono} />}
              {accion.etiqueta}
            </button>
          ))}
      </div>

      {/* Ola del login, estática, en la base de la cabecera */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 110"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 w-full fill-arena-claro sm:h-10"
      >
        <path d="M0,64 C240,110 480,18 720,54 C960,90 1200,30 1440,64 L1440,110 L0,110 Z" />
      </svg>
    </header>
  )
}
