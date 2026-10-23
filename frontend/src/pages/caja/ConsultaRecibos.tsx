import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { hoyLocal } from '../../lib/fechas'
import { useRecibos } from './cajaApi'
import { ListaRecibos } from './ListaRecibos'

// Recibos por día de caja o por número, de todos los cajeros (Extorno y Reportes, K6). Los filtros
// viven en la URL (sin tocar otros parámetros, como la pestaña) para volver desde el recibo.

const ESTILO_CAMPO =
  'mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ESTILO_ETIQUETA = 'block text-xs font-semibold uppercase tracking-wider text-slate-500'

export function ConsultaRecibos() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const numero = params.get('numero') ?? ''
  const fecha = numero ? '' : (params.get('fecha') ?? hoyLocal())
  const [texto, setTexto] = useState(numero)
  const { recibos, error } = useRecibos({ fecha, numero })

  function filtrar(cambios: { fecha?: string; numero?: string }) {
    const p = new URLSearchParams(params)
    p.delete('fecha')
    p.delete('numero')
    if (cambios.fecha) p.set('fecha', cambios.fecha)
    if (cambios.numero) p.set('numero', cambios.numero)
    setParams(p)
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="rec-fecha" className={ESTILO_ETIQUETA}>
            Día de caja
          </label>
          <input
            id="rec-fecha"
            type="date"
            value={fecha}
            onChange={(e) => {
              setTexto('')
              filtrar({ fecha: e.target.value })
            }}
            className={ESTILO_CAMPO}
          />
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            filtrar({ numero: texto.trim() })
          }}
        >
          <div>
            <label htmlFor="rec-numero" className={ESTILO_ETIQUETA}>
              N.° de recibo
            </label>
            <input
              id="rec-numero"
              type="search"
              placeholder="2026-000123"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className={ESTILO_CAMPO}
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-mar-profundo/30 px-3 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            Buscar
          </button>
        </form>
      </div>

      <div className="mt-4">
        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : !recibos ? (
          <p role="status" className="text-sm text-slate-500">
            Cargando recibos…
          </p>
        ) : (
          <ListaRecibos recibos={recibos} volverA={`${location.pathname}${location.search}`} mostrarCajero />
        )}
      </div>
    </>
  )
}
