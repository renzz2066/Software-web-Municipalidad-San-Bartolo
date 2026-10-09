import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAccesos } from '../context/AccesosContext'

export function RequireNivel({ codigo, children }: { codigo: string; children: ReactNode }) {
  const { tiene, isLoading } = useAccesos()

  if (isLoading) {
    return null
  }

  if (!tiene(codigo)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
