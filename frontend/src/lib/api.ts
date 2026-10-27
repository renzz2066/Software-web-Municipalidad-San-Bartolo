import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
})

export interface AsignarValoresApi {
  asignarValores: (data: { valorIds: number[]; auxiliarId: number }) => Promise<any>
  getMemorandums: () => Promise<any>
  getAuxiliares: () => Promise<any>
  getValoresByMemorandum: (memorandumId: number) => Promise<any>
}

// Extender el tipo de api para incluir los métodos personalizados
declare module 'axios' {
  interface AxiosInstance {
    asignarValores: (data: { valorIds: number[]; auxiliarId: number }) => Promise<any>
    getMemorandums: () => Promise<any>
    getAuxiliares: () => Promise<any>
    getValoresByMemorandum: (memorandumId: number) => Promise<any>
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = String(error?.config?.url ?? '')
    // login: 401 = credenciales; logout: la sesión ya se limpió
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/logout')
    if (status === 401 && !isAuthRequest) {
      window.dispatchEvent(new Event('auth:expired'))
    }
    return Promise.reject(error)
  },
)
