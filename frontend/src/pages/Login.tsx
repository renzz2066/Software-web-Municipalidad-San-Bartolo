import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(usuario, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setError('Usuario o contraseña incorrectos.')
      } else {
        setError('No se pudo conectar con el servidor. Intenta nuevamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-arena-claro">
      {/* Panel institucional San Bartolo */}
      <aside className="relative hidden w-[52%] overflow-hidden lg:flex lg:flex-col">
        <img
          src="/san-bartolo-bahia.jpg"
          alt="Bahía de San Bartolo con malecón y playa"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-mar-profundo/85 via-mar-profundo/55 to-mar/70"
        />

        <div className="relative flex flex-1 flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-4">
            <img
              src="/escudo-mdsb.png"
              alt="Escudo oficial de la Municipalidad Distrital de San Bartolo"
              className="h-16 w-16 rounded-xl bg-white/95 p-1.5 shadow-lg object-contain"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-turquesa">
                Lima Sur · Perú
              </p>
              <p className="text-lg font-bold leading-tight">
                Municipalidad Distrital
                <br />
                de San Bartolo
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <i aria-hidden="true" className="bi bi-geo-alt text-turquesa" />
              Distrito turístico · Bahía y malecón
            </p>
            <h2 className="text-4xl font-extrabold leading-tight drop-shadow">
              Sistema de Rentas
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/85">
              Acceso exclusivo del personal interno para la gestión tributaria,
              caja y atención al contribuyente sanbartolino.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/90">
              <li className="flex items-center gap-2.5">
                <i aria-hidden="true" className="bi bi-water text-base text-turquesa" />
                Identidad costera del distrito
              </li>
              <li className="flex items-center gap-2.5">
                <i aria-hidden="true" className="bi bi-bank text-base text-turquesa" />
                Gestión municipal transparente
              </li>
              <li className="flex items-center gap-2.5">
                <i aria-hidden="true" className="bi bi-shield-lock text-base text-turquesa" />
                Acceso por roles: ADMIN · SUPERVISOR · CAJERO
              </li>
            </ul>
          </div>

          <p className="text-xs text-white/70">
            gob.pe/munisanbartolo · Área de Rentas
          </p>
        </div>

        <svg
          aria-hidden="true"
          viewBox="0 0 1440 110"
          preserveAspectRatio="none"
          className="ola-animada relative block h-[72px] w-[112%]"
        >
          <path
            d="M0,64 C240,110 480,18 720,54 C960,90 1200,30 1440,64 L1440,110 L0,110 Z"
            fill="#faf6ec"
          />
        </svg>
      </aside>

      {/* Panel formulario */}
      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-arena via-arena-claro to-white lg:hidden"
        />
        {/* Banner móvil con la bahía */}
        <div className="absolute inset-x-0 top-0 h-44 overflow-hidden lg:hidden">
          <img
            src="/san-bartolo-bahia.jpg"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-mar-profundo/60" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-20px_rgba(11,44,74,0.45)] ring-1 ring-mar-profundo/10">
            <div className="h-1.5 bg-gradient-to-r from-mar-profundo via-mar to-turquesa" />
            <div className="p-8 sm:p-9">
              <div className="mb-7 text-center">
                <img
                  src="/escudo-mdsb.png"
                  alt="Escudo oficial de la Municipalidad Distrital de San Bartolo"
                  className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-white object-contain p-1 shadow-md ring-1 ring-slate-200 lg:hidden"
                />
                <div className="mb-3 hidden items-center justify-center gap-2 lg:flex">
                  <img
                    src="/escudo-mdsb.png"
                    alt=""
                    aria-hidden="true"
                    className="h-11 w-11 rounded-lg object-contain ring-1 ring-slate-200"
                  />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-mar-profundo">
                  Sistema de Rentas
                </h1>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Municipalidad de San Bartolo
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Ingresa con tu usuario institucional
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="usuario" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                    Usuario
                  </label>
                  <div className="relative">
                    <i
                      aria-hidden="true"
                      className="bi bi-person pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400"
                    />
                    <input
                      id="usuario"
                      type="text"
                      autoComplete="username"
                      required
                      placeholder="Ej. cajero01"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      className="login-input w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-mar focus:ring-2 focus:ring-turquesa/40"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-mar-profundo">
                    Contraseña
                  </label>
                  <div className="relative">
                    <i
                      aria-hidden="true"
                      className="bi bi-key pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400"
                    />
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="login-input w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-mar focus:ring-2 focus:ring-turquesa/40"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="login-btn w-full rounded-lg bg-gradient-to-r from-mar-profundo to-mar py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-md transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Ingresando...' : 'Ingresar'}
                </button>

                <p className="pt-1 text-center text-xs leading-relaxed text-slate-400">
                  ¿Problemas de acceso? Contacta al Área de Rentas
                  <br />
                  Uso interno · ADMIN · SUPERVISOR · CAJERO
                </p>
              </form>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            © Municipalidad Distrital de San Bartolo · gob.pe/munisanbartolo
          </p>
        </div>
      </main>
    </div>
  )
}
