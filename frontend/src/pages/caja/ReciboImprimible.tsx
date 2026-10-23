import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { soles } from '../rentas/contribuyentes/tipos'
import { mensajeError } from '../rentas/maestros/maestrosApi'
import { direccionPredio } from '../rentas/valores/valoresApi'
import { descripcionCuota, etiquetaMedio, type Recibo, RUTA_COBRO } from './cajaApi'

// Recibo de caja para imprimir en media hoja A5 o guardar como PDF (specs/caja-v1.md, K2).
// Solo la vista que sigue al cobro es el original; toda otra apertura imprime "COPIA".

export function ReciboImprimible() {
  const { id } = useParams()
  const location = useLocation()
  const original = (location.state as { original?: boolean } | null)?.original === true
  const [recibo, setRecibo] = useState<Recibo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<Recibo>(`/caja/recibos/${id}`)
        if (!cancelled) setRecibo(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id])

  const r = recibo
  const extornado = r?.estado === 'EXTORNADO'
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8 print:bg-white print:p-0">
      <style>{'@page { size: A5; margin: 8mm; }'}</style>
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <Link
            to={r ? `${RUTA_COBRO}?contribuyente=${r.contribuyente.id}` : RUTA_COBRO}
            className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-arrow-left" />
            Volver al cobro
          </Link>
          <div className="flex gap-2">
            <Link
              to={RUTA_COBRO}
              className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Nuevo cobro
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!r}
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
            >
              <i aria-hidden="true" className="bi bi-printer mr-1" />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {original && r && (
          <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 print:hidden">
            Cobro registrado: recibo {r.numero}.
          </p>
        )}

        <main className="relative mt-3 overflow-hidden rounded-xl bg-white p-6 text-sm shadow-md ring-1 ring-mar-profundo/10 print:mt-0 print:rounded-none print:p-0 print:text-xs print:shadow-none print:ring-0">
          {error ? (
            <p role="alert" className="font-medium text-red-700">
              {error}
            </p>
          ) : !r ? (
            <p role="status" className="text-slate-500">
              Cargando recibo…
            </p>
          ) : (
            <>
              {(extornado || !original) && (
                <p
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-black tracking-widest text-slate-900/10 -rotate-12"
                >
                  {extornado ? 'EXTORNADO' : 'COPIA'}
                </p>
              )}
              <header className="flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Municipalidad Distrital de San Bartolo</p>
                  <h1 className="text-lg font-bold text-mar-profundo">Recibo de caja</h1>
                  {!original && <p className="text-xs font-semibold text-slate-600">COPIA</p>}
                </div>
                <div className="text-right">
                  <p className="font-mono text-base font-bold text-mar-profundo">N.° {r.numero}</p>
                  <p className="text-xs text-slate-600">{new Date(r.fecha).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</p>
                </div>
              </header>

              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                <dt className="text-slate-500">Contribuyente</dt>
                <dd className="font-semibold">{r.contribuyente.nombreCompleto}</dd>
                <dt className="text-slate-500">Documento</dt>
                <dd className="font-mono">
                  {r.contribuyente.tipoDoc} {r.contribuyente.numDoc}
                  {r.contribuyente.codigoLegacy && ` · Cód. ${r.contribuyente.codigoLegacy}`}
                </dd>
                <dt className="text-slate-500">Domicilio fiscal</dt>
                <dd>{r.contribuyente.direccionFiscal ?? '—'}</dd>
              </dl>

              <table className="mt-3 w-full text-left">
                <caption className="sr-only">Detalle del recibo {r.numero}</caption>
                <thead>
                  <tr className="border-b border-slate-300 text-xs uppercase text-slate-500">
                    <th scope="col" className="py-1 pr-2">Concepto</th>
                    <th scope="col" className="px-1 py-1 text-right">Insoluto</th>
                    <th scope="col" className="px-1 py-1 text-right">Reaj.</th>
                    <th scope="col" className="px-1 py-1 text-right">Mora</th>
                    <th scope="col" className="px-1 py-1 text-right">Emisión</th>
                    <th scope="col" className="py-1 pl-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lineas.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2">
                        {l.anio} · {l.tributo.nombre} · {descripcionCuota(l)}
                        {l.predio && <span className="block text-xs text-slate-500">{direccionPredio({ ...l.predio, urbanizacion: null })}</span>}
                      </td>
                      <td className="px-1 py-1 text-right">{Number(l.insoluto).toFixed(2)}</td>
                      <td className="px-1 py-1 text-right">{Number(l.reajuste).toFixed(2)}</td>
                      <td className="px-1 py-1 text-right">{Number(l.mora).toFixed(2)}</td>
                      <td className="px-1 py-1 text-right">{Number(l.derechoEmision).toFixed(2)}</td>
                      <td className="py-1 pl-1 text-right font-medium">{Number(l.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-400 text-base font-bold text-mar-profundo">
                    <th scope="row" colSpan={5} className="py-1.5 text-left">
                      Total pagado
                    </th>
                    <td className="whitespace-nowrap py-1.5 text-right">{soles(r.total)}</td>
                  </tr>
                </tfoot>
              </table>
              <p className="mt-1 text-xs font-semibold">SON: {r.totalEnLetras}</p>

              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-slate-200 pt-2 text-xs">
                <dt className="text-slate-500">Medio de pago</dt>
                <dd>
                  {etiquetaMedio(r.medioPago)}
                  {r.numOperacion && ` · Op. ${r.numOperacion}`}
                </dd>
                <dt className="text-slate-500">Cajero</dt>
                <dd>
                  {r.cajero.nombre ?? r.cajero.usuario} ({r.cajero.usuario})
                </dd>
              </dl>

              {r.extorno && (
                <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
                  Extornado el {r.extorno.fecha ? new Date(r.extorno.fecha).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : '—'}
                  {r.extorno.por && ` por ${r.extorno.por}`}. Motivo: {r.extorno.motivo}
                </p>
              )}

              <footer className="mt-4 text-center text-[10px] text-slate-500">
                Conserve este recibo como constancia de pago. Verifique que el número y el monto coincidan con lo pagado.
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
