import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MODULOS } from '../../pages/modulos/catalogo'

type Miga = { etiqueta: string; to?: string }

function humanizar(segmento: string) {
  const texto = segmento.replace(/-/g, ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Migas de pan derivadas de la ruta: Inicio / Módulo / Submódulo / resto.
// Solo Inicio, módulo y submódulo son enlaces (rutas garantizadas);
// el resto (ids, formularios) se muestra como texto para no enlazar rutas inexistentes.
function calcularMigas(pathname: string): Miga[] {
  const segmentos = pathname.split('/').filter(Boolean)
  const migas: Miga[] = [{ etiqueta: 'Inicio', to: '/' }]
  let ruta = ''

  for (let i = 0; i < segmentos.length; i++) {
    const segmento = segmentos[i]
    if (/^\d+$/.test(segmento)) continue // ids de registro
    ruta += `/${segmento}`

    if (i === 0) {
      const modulo = MODULOS.find((m) => m.codigo === segmento)
      if (modulo) migas.push({ etiqueta: modulo.titulo, to: ruta })
      else if (segmento === 'accesibilidad') migas.push({ etiqueta: 'Accesibilidad', to: ruta })
      else migas.push({ etiqueta: humanizar(segmento) })
    } else if (i === 1) {
      const modulo = MODULOS.find((m) => m.codigo === segmentos[0])
      const sub = modulo?.submodulos.find((s) => s.slug === segmento)
      migas.push({ etiqueta: sub?.titulo ?? humanizar(segmento), to: sub ? ruta : undefined })
    } else {
      migas.push({ etiqueta: humanizar(segmento) })
    }
  }

  const ultima = migas[migas.length - 1]
  if (ultima) ultima.to = undefined
  return migas
}

interface TopbarProps {
  menuAbierto: boolean
  onAbrirMenu: () => void
}

// Barra superior: botón de cajón (móvil), migas de pan y menú de usuario
// con "Cerrar sesión" (spec criterio 3).
export function Topbar({ menuAbierto, onAbrirMenu }: TopbarProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const migas = calcularMigas(pathname)
  const [usuarioAbierto, setUsuarioAbierto] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Menú de usuario: se cierra al hacer clic fuera o con Esc.
  useEffect(() => {
    if (!usuarioAbierto) return
    function cerrarFuera(event: MouseEvent) {
      if (!contenedorRef.current?.contains(event.target as Node)) setUsuarioAbierto(false)
    }
    function cerrarTecla(event: KeyboardEvent) {
      if (event.key === 'Escape') setUsuarioAbierto(false)
    }
    document.addEventListener('mousedown', cerrarFuera)
    document.addEventListener('keydown', cerrarTecla)
    return () => {
      document.removeEventListener('mousedown', cerrarFuera)
      document.removeEventListener('keydown', cerrarTecla)
    }
  }, [usuarioAbierto])

  const iniciales = (user?.nombre ?? '')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-borde bg-white px-4 print:hidden sm:px-6">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menú de módulos"
        aria-controls="menu-lateral"
        aria-expanded={menuAbierto}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-borde text-tinta hover:bg-arena-suave lg:hidden"
      >
        <i aria-hidden="true" className="bi bi-list text-xl" />
      </button>

      <nav aria-label="Ruta de navegación" className="hidden min-w-0 flex-1 sm:block">
        <ol className="flex items-center gap-2 overflow-hidden text-sm">
          {migas.map((miga, i) => (
            <li key={`${miga.etiqueta}-${i}`} className="flex min-w-0 items-center gap-2">
              {i > 0 && (
                <i
                  aria-hidden="true"
                  className="bi bi-chevron-right shrink-0 text-xs text-tinta-suave/70"
                />
              )}
              {miga.to ? (
                <Link
                  to={miga.to}
                  className="truncate text-tinta-suave hover:text-tinta hover:underline"
                >
                  {miga.etiqueta}
                </Link>
              ) : (
                <span
                  aria-current={i === migas.length - 1 ? 'page' : undefined}
                  className="truncate font-semibold text-tinta"
                >
                  {miga.etiqueta}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {/* En móvil las migas se ocultan: este bloque empuja el menú a la derecha */}
      <div className="flex-1 sm:hidden" />

      <div ref={contenedorRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setUsuarioAbierto((v) => !v)}
          aria-expanded={usuarioAbierto}
          aria-label={`Menú de ${user?.nombre ?? 'usuario'}`}
          className="flex items-center gap-2 rounded-lg border border-borde px-2 py-1.5 hover:bg-arena-suave"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-mar-profundo text-xs font-bold text-white"
          >
            {iniciales}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-40 truncate text-sm font-semibold text-tinta">
              {user?.nombre}
            </span>
            <span className="block text-xs text-tinta-suave">{user?.rol}</span>
          </span>
          <i
            aria-hidden="true"
            className={`bi bi-chevron-down text-xs text-tinta-suave transition-transform duration-150 ${
              usuarioAbierto ? 'rotate-180' : ''
            }`}
          />
        </button>

        {usuarioAbierto && (
          <div className="absolute right-0 top-full mt-2 w-60 rounded-panel border border-borde bg-white p-2">
            <div className="border-b border-borde px-2 pb-2">
              <p className="truncate text-sm font-semibold text-tinta">{user?.nombre}</p>
              <p className="truncate text-xs text-tinta-suave">
                {user?.usuario} · {user?.rol}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUsuarioAbierto(false)
                logout()
              }}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-tinta hover:bg-arena-suave"
            >
              <i aria-hidden="true" className="bi bi-box-arrow-right" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
