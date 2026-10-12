import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

interface AccesosContextValue {
  accesos: string[]
  isLoading: boolean
  tiene: (codigo: string) => boolean
}

const AccesosContext = createContext<AccesosContextValue | undefined>(undefined)

export function AccesosProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  // Gate síncrono y sin race: deriva directo del usuario en sesión
  // (los accesos vienen en el login). Revalida en segundo plano.
  const [frescos, setFrescos] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setFrescos(null)

    if (!isAuthenticated) return

    api
      .get<string[]>('/niveles/mis-accesos')
      .then(({ data }) => {
        if (!cancelled) setFrescos(data)
      })
      .catch(() => {
        // Se conserva lo del login; el backend decide cada request
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.id])

  const accesos = frescos ?? user?.accesos ?? []

  function tiene(codigo: string) {
    return accesos.includes(codigo)
  }

  return (
    <AccesosContext.Provider value={{ accesos, isLoading: false, tiene }}>
      {children}
    </AccesosContext.Provider>
  )
}

export function useAccesos() {
  const context = useContext(AccesosContext)
  if (!context) {
    throw new Error('useAccesos debe usarse dentro de un AccesosProvider')
  }
  return context
}
