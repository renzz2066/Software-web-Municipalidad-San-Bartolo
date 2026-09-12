import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

export interface AuthUser {
  id: number
  nombre: string
  usuario: string
  rol: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (usuario: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const token = localStorage.getItem('accessToken')
    if (storedUser && token) {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  async function login(usuario: string, password: string) {
    const { data } = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', {
      usuario,
      password,
    })
    localStorage.setItem('accessToken', data.accessToken)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}
