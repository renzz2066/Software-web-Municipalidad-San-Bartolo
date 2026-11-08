import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ChatDrawer } from '../chat/ChatDrawer'

// Envoltorio de toda la zona autenticada (specs/app-shell-v1.md):
// Ruta autenticada -> RequireNivel -> AppShell(Sidebar + Topbar) -> PageHeader + contenido.
// /login queda fuera de este componente.
export function AppShell() {
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Cajón móvil: Esc cierra (además del botón y el fondo).
  useEffect(() => {
    if (!menuAbierto) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuAbierto(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuAbierto])

  return (
    <div className="flex min-h-screen bg-arena-claro">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
      {menuAbierto && (
        <div
          aria-hidden="true"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-40 bg-black/45 lg:hidden print:hidden"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar menuAbierto={menuAbierto} onAbrirMenu={() => setMenuAbierto(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <ChatDrawer />
    </div>
  )
}
