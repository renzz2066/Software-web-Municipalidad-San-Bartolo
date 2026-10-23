import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { hoyLocal } from '../../lib/fechas'
import { useRecibos } from './cajaApi'
import { ListaRecibos } from './ListaRecibos'

// Caja → Extorno (specs/caja-v1.md, K4, decisión 7): quien tiene `caja.extornos` busca cualquier
// recibo por día o por número y lo extorna desde su detalle, con motivo.

const ESTILO_CAMPO =
  'mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ESTILO_ETIQUETA = 'block text-xs font-semibold uppercase tracking-wider text-slate-500'

export function Extornos() {
  const [params, setParams] = useSearchParams()
  const numero = params.get('numero') ?? ''
  const fecha = numero ? '' : (params.get('fecha') ?? hoyLocal())
  const [texto, setTexto] = useState(numero)
  const { recibos, error } = useRecibos({ fecha, numero })
  const volverA = `/caja/extornos?${params.toString()}`

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/caja"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Caja
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-arrow-counterclockwise" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Extorno</h1>
              <p className="text-sm text-slate-500">
                Anula un cobro completo con motivo: las cuotas vuelven a la deuda y el recibo queda extornado. El extorno cuenta en
                la caja de hoy de quien lo hace.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="ext-fecha" className={ESTILO_ETIQUETA}>
                Día de caja
              </label>
              <input
                id="ext-fecha"
                type="date"
                value={fecha}
                onChange={(e) => {
                  setTexto('')
                  setParams(e.target.value ? { fecha: e.target.value } : {})
                }}
                className={ESTILO_CAMPO}
              />
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setParams(texto.trim() ? { numero: texto.trim() } : {})
              }}
            >
              <div>
                <label htmlFor="ext-numero" className={ESTILO_ETIQUETA}>
                  N.° de recibo
                </label>
                <input
                  id="ext-numero"
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
              <ListaRecibos recibos={recibos} volverA={volverA} mostrarCajero />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
