import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'

// Catálogos con código y reglas por muni (contrato: backend/src/catalogos; specs/rentas-nucleo-v2.md, Fase 0).

export type GrupoCatalogo =
  | 'TIPO_DOCUMENTO'
  | 'TIPO_CONTACTO'
  | 'TIPO_RELACIONADO'
  | 'TIPO_SUCESION'
  | 'PERFIL_CUMPLIMIENTO'
  | 'PERFIL_COBRANZA'
  | 'CLASIFICACION_CONTRIBUYENTE'
  | 'BENEFICIO'
  | 'COMPONENTE_DIRECCION'
  | 'TIPO_VIA'
  | 'TIPO_HABILITACION'
  | 'FRECUENCIA_BARRIDO'
  | 'UBICACION_PARQUE'
  | 'CONDICION_PROPIEDAD'
  | 'USO_PREDIO'
  | 'SUB_USO_PREDIO'
  | 'MOTIVO_DJ'
  | 'SUB_MOTIVO_DJ'
  | 'TIPO_DOC_ADJUNTO'
  | 'TIPO_DOC_TRANSFERENCIA'

export type DefAtributo =
  | { tipo: 'opcion'; etiqueta: string; opciones: string[]; requerido?: boolean }
  | { tipo: 'numero'; etiqueta: string; min: number; max: number; requerido?: boolean }
  | { tipo: 'booleano'; etiqueta: string }
  | { tipo: 'texto'; etiqueta: string; max: number; requerido?: boolean }

export interface DefGrupo {
  grupo: GrupoCatalogo
  nombre: string
  reglas: string
  padre?: GrupoCatalogo
  abreviatura?: 'opcional' | 'requerida'
  atributos: Record<string, DefAtributo>
}

export type Atributos = Record<string, string | number | boolean>

export interface ItemCatalogo {
  id: number
  grupo: GrupoCatalogo
  codigo: string
  nombre: string
  abreviatura: string | null
  padreId: number | null
  padre: { id: number; codigo: string; nombre: string } | null
  atributos: Atributos | null
  orden: number
  activo: boolean
  sistema: boolean
  ordenanza: string | null
}

export type DefRegla =
  | { tipo: 'codigos'; grupo: GrupoCatalogo }
  | { tipo: 'opcion'; opciones: string[] }
  | { tipo: 'booleano' }
  | { tipo: 'cuotas' }

export interface ReglaMuni {
  clave: string
  regla: string
  descripcion: string
  def: DefRegla
  valor: unknown
  defecto: unknown
  ordenanza: string | null
  guardada: boolean
}

// Ítems activos de un grupo para los selects de los formularios. Caché por pestaña del navegador:
// los catálogos cambian poco y se piden desde varios campos a la vez.
const cache = new Map<GrupoCatalogo, Promise<ItemCatalogo[]>>()

export function cargarCatalogo(grupo: GrupoCatalogo): Promise<ItemCatalogo[]> {
  let p = cache.get(grupo)
  if (!p) {
    p = api.get<ItemCatalogo[]>('/catalogos', { params: { grupo } }).then((r) => r.data)
    p.catch(() => cache.delete(grupo))
    cache.set(grupo, p)
  }
  return p
}

export function olvidarCatalogo(grupo: GrupoCatalogo) {
  cache.delete(grupo)
}

export function useCatalogo(grupo: GrupoCatalogo): ItemCatalogo[] {
  const [items, setItems] = useState<ItemCatalogo[]>([])
  useEffect(() => {
    let vivo = true
    cargarCatalogo(grupo)
      .then((data) => {
        if (vivo) setItems(data)
      })
      .catch(() => {
        // Sin catálogo el select queda vacío; el backend vuelve a validar el código.
      })
    return () => {
      vivo = false
    }
  }, [grupo])
  return items
}

// Etiqueta legible de un código (si el catálogo aún no cargó, el código).
export function nombreDe(items: ItemCatalogo[], codigo: string | null | undefined): string {
  if (!codigo) return '—'
  return items.find((i) => i.codigo === codigo)?.nombre ?? codigo
}
