import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { api } from '../../../lib/api'
import type { Catalogos, EstadoPersona, Ubigeo } from '../contribuyentes/tipos'
import type { ItemCatalogo } from '../catalogos/catalogosApi'

// Direcciones únicas (contrato: backend/src/direcciones; specs/rentas-nucleo-v2.md, Fase 2; D01–D05).

export const RUTA_DIRECCIONES = '/rentas/registro-tributario/direcciones'
export const SUPERVISION = ['SUPERVISOR', 'ADMIN']
export const MAX_COMPONENTES = 12

export interface DireccionResumen {
  id: number
  direccion: string
  referencia: string | null
  activo: boolean
  _count: { contribuyentes: number }
}

export interface ComponenteGuardado {
  id: number
  orden: number
  componente: string
  valor: string
}

export interface DireccionDetalle {
  id: number
  ubigeo: string
  zonaId: number | null
  urbanizacionId: number | null
  viaId: number | null
  direccion: string
  referencia: string | null
  latitud: string | null // Decimal llega como texto
  longitud: string | null
  activo: boolean
  createdAt: string
  updatedAt: string
  componentes: ComponenteGuardado[]
  zona: { id: number; codigo: string; nombre: string } | null
  urbanizacion: { id: number; codigo: string; nombre: string } | null
  via: { id: number; tipoVia: string; nombre: string } | null
  contribuyentes: { id: number; tipoDoc: string; numDoc: string | null; nombreCompleto: string; estado: EstadoPersona }[]
  _count: { contribuyentes: number }
  distrito: Omit<Ubigeo, 'codigo'> | null
}

// Lo mínimo para el domicilio de una persona.
export interface DireccionElegida {
  id: number
  direccion: string
  referencia?: string | null
  activo?: boolean
}

export interface ConfigDirecciones {
  ubigeo: string // distrito de la muni (regla muni.ubigeo)
  distrito: Ubigeo | null
}

let config: Promise<ConfigDirecciones> | null = null

export function cargarConfig(): Promise<ConfigDirecciones> {
  if (!config) {
    config = api.get<ConfigDirecciones>('/direcciones/config').then((r) => r.data)
    config.catch(() => {
      config = null
    })
  }
  return config
}

export function useConfigDirecciones(): ConfigDirecciones | null {
  const [c, setC] = useState<ConfigDirecciones | null>(null)
  useEffect(() => {
    let vivo = true
    cargarConfig()
      .then((d) => vivo && setC(d))
      .catch(() => {
        // Sin config el formulario no puede distinguir el distrito: el backend vuelve a validar.
      })
    return () => {
      vivo = false
    }
  }, [])
  return c
}

let ubicacion: Promise<Catalogos> | null = null

// Sector, habilitación y vía (las tablas Zona / Urbanizacion / Via de Maestros, D02).
export function useUbicacion(): { catalogos: Catalogos | null; error: boolean } {
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let vivo = true
    if (!ubicacion) {
      ubicacion = api.get<Catalogos>('/predios/catalogos').then((r) => r.data)
      ubicacion.catch(() => {
        ubicacion = null
      })
    }
    ubicacion.then((d) => vivo && setCatalogos(d)).catch(() => vivo && setError(true))
    return () => {
      vivo = false
    }
  }, [])
  return { catalogos, error }
}

const espacios = (v: string) => v.trim().replace(/\s+/g, ' ')

// Vista previa con la misma regla que el backend (direccion.reglas.ts → componerLiteral).
export function literalPrevia(
  datos: { zonaId: string; urbanizacionId: string; viaId: string; componentes: { componente: string; valor: string }[] },
  catalogos: Catalogos | null,
  tipos: ItemCatalogo[],
  distrito: string | null,
): string {
  const via = catalogos?.vias.find((v) => String(v.id) === datos.viaId)
  const urb = catalogos?.urbanizaciones.find((u) => String(u.id) === datos.urbanizacionId)
  const zona = catalogos?.zonas.find((z) => String(z.id) === datos.zonaId)
  const partes: string[] = []
  if (via) partes.push(espacios(`${via.tipoVia} ${via.nombre}`))
  for (const c of datos.componentes) {
    const valor = espacios(c.valor).toUpperCase()
    if (!valor) continue
    const tipo = tipos.find((t) => t.codigo === c.componente)
    partes.push(`${tipo?.abreviatura ?? tipo?.nombre ?? c.componente} ${valor}`)
  }
  if (urb) partes.push(urb.nombre)
  if (partes.length === 0 && zona) partes.push(zona.nombre)
  const linea = partes.join(' ')
  if (!linea) return ''
  return distrito ? `${linea}, ${distrito}` : linea
}

// 409 de dirección repetida (D01): el backend manda el id de la que ya existe.
export function direccionExistente(err: unknown): number | null {
  if (!isAxiosError(err) || err.response?.status !== 409) return null
  const id: unknown = err.response.data?.direccionId
  return typeof id === 'number' ? id : null
}
