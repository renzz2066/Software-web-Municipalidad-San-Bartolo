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
  const [accesos, setAccesos] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (!isAuthenticated) {
      setAccesos([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    api
      .get<string[]>('/niveles/mis-accesos')
      .then(({ data }) => {
        if (!cancelled) setAccesos(data)
      })
      .catch(() => {
        if (!cancelled) setAccesos([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.id])

  function tiene(codigo: string) {
    return accesos.includes(codigo)
  }

  return (
    <AccesosContext.Provider value={{ accesos, isLoading, tiene }}>
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
