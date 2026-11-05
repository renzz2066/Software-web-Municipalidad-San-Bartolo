import { NavLink } from 'react-router-dom'
import { useAccesos } from '../../context/AccesosContext'
import { ACCESIBILIDAD, MODULOS } from '../../pages/modulos/catalogo'

const ITEMS = [...MODULOS, ACCESIBILIDAD]

interface SidebarProps {
  abierto: boolean
  onCerrar: () => void
}

function itemClase(activo: boolean) {
  return [
    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
    activo
      ? "bg-white/15 text-white before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:rounded-r before:bg-turquesa before:content-['']"
      : 'text-white/85 hover:bg-white/10 hover:text-white',
  ].join(' ')
}

// Barra lateral del app shell: lista Inicio y los módulos con nivel asignado,
// con el mismo filtro de las tarjetas del Dashboard (spec criterio 2).
export function Sidebar({ abierto, onCerrar }: SidebarProps) {
  const { tiene, isLoading } = useAccesos()
  const visibles = ITEMS.filter((m) => isLoading || tiene(m.codigo))

  return (
    <aside
      id="menu-lateral"
      className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto bg-mar-profundo transition-transform duration-200 print:hidden lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:visible ${
        abierto ? 'translate-x-0' : '-translate-x-full invisible'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <img
          src="/escudo-mdsb.png"
          alt=""
          aria-hidden="true"
          className="h-10 w-10 shrink-0 rounded-lg bg-white/95 p-1 object-contain"
        />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-serif text-sm font-bold text-white">San Bartolo</p>
          <p className="truncate text-xs text-white/70">Sistema de Rentas</p>
        </div>
      </div>

      <nav aria-label="Módulos" className="flex-1 space-y-1 p-3">
        <NavLink to="/" end onClick={onCerrar} className={({ isActive }) => itemClase(isActive)}>
          <i aria-hidden="true" className="bi bi-house text-lg" />
          Inicio
        </NavLink>

        {visibles.length === 0 && !isLoading && (
          <p className="px-3 py-2 text-xs text-white/60">Sin módulos asignados.</p>
        )}

        {visibles.map((m) => (
          <NavLink
            key={m.codigo}
            to={`/${m.codigo}`}
            onClick={onCerrar}
            className={({ isActive }) => itemClase(isActive)}
          >
            <i aria-hidden="true" className={`${m.icono} text-lg`} />
            {m.titulo}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
