import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
})

api.interceptors.request.use((config) => {
  // Multi-muni: el backend elige la base por el host del frontend (specs/multi-muni-v1.md)
  config.headers['X-Muni'] = window.location.hostname
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
