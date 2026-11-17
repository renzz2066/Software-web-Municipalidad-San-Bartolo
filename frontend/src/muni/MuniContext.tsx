import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../lib/api'

// Multi-muni (specs/multi-muni-v1.md): la muni sale del host (api.ts manda X-Muni)
// y su identidad visual viene de GET /muni/config, antes de cualquier sesión.
export interface Muni {
  slug: string
  nombre: string
  nombreCorto: string
  ubicacion: string
  lema: string
  gentilicio: string
  web: string
  escudoUrl: string
  fondoUrl: string | null
  colores: Record<string, string>
}

type Estado = { tipo: 'cargando' } | { tipo: 'ok'; muni: Muni } | { tipo: 'no-encontrada' } | { tipo: 'error' }

const MuniContext = createContext<Muni | undefined>(undefined)

function aplicarIdentidad(muni: Muni) {
  const raiz = document.documentElement.style
  for (const [token, valor] of Object.entries(muni.colores)) raiz.setProperty(`--color-${token}`, valor)
  document.title = `Sistema de Rentas · ${muni.nombreCorto}`
}

export function MuniProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })

  const cargar = useCallback(() => {
    api
      .get<Muni>('/muni/config')
      .then(({ data }) => {
        aplicarIdentidad(data)
        setEstado({ tipo: 'ok', muni: data })
      })
      .catch((err) => {
        setEstado(isAxiosError(err) && err.response?.status === 404 ? { tipo: 'no-encontrada' } : { tipo: 'error' })
      })
  }, [])

  useEffect(cargar, [cargar])

  if (estado.tipo === 'cargando') return null
  if (estado.tipo === 'no-encontrada') {
    return (
      <PantallaAviso
        icono="bi-building-x"
        titulo="Municipalidad no encontrada"
        texto={`La dirección ${window.location.hostname} no corresponde a ninguna municipalidad registrada. Revisa que esté bien escrita.`}
      />
    )
  }
  if (estado.tipo === 'error') {
    return (
      <PantallaAviso
        icono="bi-wifi-off"
        titulo="No se pudo conectar con el servidor"
        texto="Revisa tu conexión e intenta nuevamente."
        accion={{
          texto: 'Reintentar',
          onClick: () => {
            setEstado({ tipo: 'cargando' })
            cargar()
          },
        }}
      />
    )
  }
  return <MuniContext.Provider value={estado.muni}>{children}</MuniContext.Provider>
}

function PantallaAviso(props: {
  icono: string
  titulo: string
  texto: string
  accion?: { texto: string; onClick: () => void }
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-arena-claro px-4">
      <div className="w-full max-w-md rounded-panel border border-borde bg-white p-8 text-center">
        <i aria-hidden="true" className={`bi ${props.icono} text-4xl text-tinta-suave`} />
        <h1 className="mt-3 font-serif text-xl font-bold text-tinta">{props.titulo}</h1>
        <p className="mt-2 text-sm text-tinta-suave">{props.texto}</p>
        {props.accion && (
          <button
            type="button"
            onClick={props.accion.onClick}
            className="mt-5 rounded-lg bg-mar-profundo px-4 py-2 text-sm font-semibold text-white hover:bg-mar-medio"
          >
            {props.accion.texto}
          </button>
        )}
      </div>
    </main>
  )
}

export function useMuni(): Muni {
  const muni = useContext(MuniContext)
  if (!muni) throw new Error('useMuni debe usarse dentro de MuniProvider')
  return muni
}

// Nombre oficial de la muni activa, para encabezados de documentos imprimibles.
export function NombreMuni() {
  return <>{useMuni().nombre}</>
}
