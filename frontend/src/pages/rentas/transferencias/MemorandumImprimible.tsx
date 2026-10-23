import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { soles } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { direccionPredio, numeroValor } from '../valores/valoresApi'
import type { Memorandum } from './transferenciasApi'

// Memorándum de transferencia de valores a Cobranza Coactiva (V7), para imprimir y firmar.

export function MemorandumImprimible() {
  const { id } = useParams()
  const [memo, setMemo] = useState<Memorandum | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<Memorandum>(`/rentas/transferencias/${id}`)
        if (!cancelled) setMemo(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id])

  const m = memo
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <Link
            to="/rentas/control-recaudacion"
            className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-arrow-left" />
            Control y Recaudación
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!m}
            className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
          >
            <i aria-hidden="true" className="bi bi-printer mr-1" />
            Imprimir / PDF
          </button>
        </div>

        <main className="mt-3 rounded-xl bg-white p-6 text-sm shadow-md ring-1 ring-mar-profundo/10 print:mt-0 print:rounded-none print:p-0 print:shadow-none print:ring-0">
          {error ? (
            <p role="alert" className="font-medium text-red-700">
              {error}
            </p>
          ) : !m ? (
            <p role="status" className="text-slate-500">
              Cargando memorándum…
            </p>
          ) : (
            <>
              <header className="border-b border-slate-200 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Municipalidad Distrital de San Bartolo</p>
                <h1 className="text-xl font-bold uppercase text-mar-profundo">Memorándum N° {m.anio}-{m.numero}</h1>
                <dl className="mt-2 grid gap-1 sm:grid-cols-[8rem_1fr]">
                  <dt className="font-semibold text-slate-500">De</dt>
                  <dd>Subgerencia de Rentas</dd>
                  <dt className="font-semibold text-slate-500">Para</dt>
                  <dd>Ejecutor Coactivo</dd>
                  <dt className="font-semibold text-slate-500">Asunto</dt>
                  <dd>Transferencia de valores exigibles para su cobranza coactiva</dd>
                  <dt className="font-semibold text-slate-500">Fecha</dt>
                  <dd>{m.fecha}</dd>
                </dl>
              </header>

              <p className="mt-4 leading-relaxed text-slate-700">
                Se remiten {m.cantidad} valores notificados y exigibles conforme al artículo 115° del Texto Único Ordenado del
                Código Tributario, por un total de <strong>{soles(m.monto)}</strong> liquidado al {m.fecha}, para el inicio del
                procedimiento de ejecución coactiva. Se adjuntan los valores con sus constancias de notificación.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="py-2 pr-2">N°</th>
                      <th scope="col" className="py-2 pr-2">Valor</th>
                      <th scope="col" className="py-2 pr-2">Contribuyente</th>
                      <th scope="col" className="py-2 pr-2">Notificado</th>
                      <th scope="col" className="py-2 pr-2">Exigible</th>
                      <th scope="col" className="py-2 text-right">Deuda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.valores.map((v, i) => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2">{i + 1}</td>
                        <td className="py-1.5 pr-2 font-mono text-xs">{numeroValor(v)}</td>
                        <td className="py-1.5 pr-2">
                          {v.contribuyente.nombreCompleto}
                          <span className="block text-xs text-slate-500">
                            {v.contribuyente.tipoDoc} {v.contribuyente.numDoc}
                            {v.predio && ` · ${direccionPredio(v.predio)}`}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2">{v.fechaNotificacion}</td>
                        <td className="py-1.5 pr-2">{v.fechaExigible}</td>
                        <td className="py-1.5 text-right font-medium">{soles(v.deuda)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 font-semibold text-mar-profundo">
                      <td colSpan={5} className="py-2">
                        Total
                      </td>
                      <td className="py-2 text-right">{soles(m.monto)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <footer className="mt-12 grid gap-8 text-center text-xs text-slate-500 sm:grid-cols-2">
                <div className="border-t border-slate-400 pt-1">Subgerencia de Rentas · firma y sello</div>
                <div className="border-t border-slate-400 pt-1">Recibido por Ejecutoría Coactiva · firma, fecha y hora</div>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
