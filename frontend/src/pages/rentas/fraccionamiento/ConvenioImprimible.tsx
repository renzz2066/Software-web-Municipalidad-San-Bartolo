import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { RUTA_BASE, soles } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { direccionPredio } from '../valores/valoresApi'
import { ESTILO_CONVENIO, ETIQUETA_CONVENIO, type Convenio } from './fraccionamientoApi'
import { TablaCronograma } from './TablaCronograma'

// Convenio de fraccionamiento para imprimir y firmar (V6) + anulación (solo en pantalla).

const MOTIVO_MIN = 10

export function ConvenioImprimible() {
  const { id } = useParams()
  const [convenio, setConvenio] = useState<Convenio | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<Convenio>(`/rentas/convenios/${id}`)
        if (!cancelled) setConvenio(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id])

  const c = convenio
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <Link
            to={c ? `${RUTA_BASE}/contribuyentes/${c.contribuyente.id}` : RUTA_BASE}
            className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-arrow-left" />
            Ficha del contribuyente
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!c}
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
          ) : !c ? (
            <p role="status" className="text-slate-500">
              Cargando convenio…
            </p>
          ) : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Municipalidad Distrital de San Bartolo · Subgerencia de Rentas
                  </p>
                  <h1 className="text-xl font-bold uppercase text-mar-profundo">Convenio de fraccionamiento</h1>
                  <p className="font-mono text-base font-semibold text-mar-profundo">N° {c.numero}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO_CONVENIO[c.estado]}`}>
                    {ETIQUETA_CONVENIO[c.estado]}
                  </span>
                  <p className="mt-1 text-slate-600">Fecha: {c.fecha}</p>
                </div>
              </header>

              <section aria-label="Deudor" className="mt-4 grid gap-2 sm:grid-cols-2">
                <Campo titulo="Contribuyente" valor={c.contribuyente.nombreCompleto} />
                <Campo titulo="Documento" valor={`${c.contribuyente.tipoDoc} ${c.contribuyente.numDoc}`} />
                <Campo titulo="Domicilio fiscal" valor={c.contribuyente.direccionFiscal ?? '—'} />
                <Campo
                  titulo="Condiciones"
                  valor={`Deuda ${soles(c.montoTotal)} · inicial ${soles(c.cuotaInicial)} · ${c.numCuotas} cuotas · interés ${c.interesMensual}% mensual`}
                />
              </section>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <caption className="mb-2 text-left font-semibold text-mar-profundo">Deuda que se fracciona (liquidada al {c.fecha})</caption>
                  <thead>
                    <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="py-2 pr-2">Año</th>
                      <th scope="col" className="py-2 pr-2">Tributo</th>
                      <th scope="col" className="py-2 pr-2">Cuota</th>
                      <th scope="col" className="py-2 pr-2 text-right">Insoluto</th>
                      <th scope="col" className="py-2 pr-2 text-right">Reajuste</th>
                      <th scope="col" className="py-2 pr-2 text-right">Interés</th>
                      <th scope="col" className="py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.deudas.map((d) => (
                      <tr key={d.id} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2">{d.anio}</td>
                        <td className="py-1.5 pr-2">
                          {d.tributo.nombre}
                          {d.predio && <span className="block text-xs text-slate-500">{direccionPredio(d.predio)}</span>}
                        </td>
                        <td className="py-1.5 pr-2">{d.cuota}</td>
                        <td className="py-1.5 pr-2 text-right">{soles(d.insoluto)}</td>
                        <td className="py-1.5 pr-2 text-right">{soles(d.reajuste)}</td>
                        <td className="py-1.5 pr-2 text-right">{soles(d.mora)}</td>
                        <td className="py-1.5 text-right font-medium">{soles(d.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 font-semibold text-mar-profundo">
                      <td colSpan={6} className="py-2">
                        Total
                      </td>
                      <td className="py-2 text-right">{soles(c.montoTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-6">
                <TablaCronograma cuotas={c.cronograma} totalIntereses={c.totalIntereses} totalAPagar={c.totalAPagar} />
              </div>

              <section aria-label="Condiciones" className="mt-4 space-y-2 text-xs leading-relaxed text-slate-700">
                <p className="font-semibold uppercase tracking-wider text-slate-500">Condiciones</p>
                <p>
                  Fraccionamiento otorgado conforme al artículo 36° del Texto Único Ordenado del Código Tributario y la ordenanza
                  municipal de fraccionamiento vigente. El interés de fraccionamiento se aplica sobre el saldo de cada mes.
                </p>
                <p>
                  Cada cuota debe pagarse hasta su fecha de vencimiento; las cuotas vencidas generan interés moratorio (artículo
                  33°). El incumplimiento en los términos que fija la ordenanza causa la pérdida del fraccionamiento y la deuda
                  pendiente se vuelve exigible.
                </p>
              </section>

              {c.estado === 'ANULADO' && c.motivoAnulacion && <p className="mt-3 font-medium text-red-700">Anulado: {c.motivoAnulacion}</p>}

              <footer className="mt-12 grid gap-8 text-center text-xs text-slate-500 sm:grid-cols-2">
                <div className="border-t border-slate-400 pt-1">Subgerencia de Rentas · firma y sello</div>
                <div className="border-t border-slate-400 pt-1">
                  {c.contribuyente.nombreCompleto} · {c.contribuyente.tipoDoc} {c.contribuyente.numDoc}
                </div>
              </footer>
            </>
          )}
        </main>
        {c?.estado === 'FRACCIONADO' && <FormAnulacion convenio={c} alAnular={setConvenio} />}
      </div>
    </div>
  )
}

function FormAnulacion({ convenio, alAnular }: { convenio: Convenio; alAnular: (c: Convenio) => void }) {
  const [motivo, setMotivo] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function anular(e: React.FormEvent) {
    e.preventDefault()
    if (motivo.trim().length < MOTIVO_MIN) {
      setError(`Explica el motivo de la anulación (mínimo ${MOTIVO_MIN} caracteres)`)
      return
    }
    if (!window.confirm('Se anularán las cuotas del convenio y la deuda original volverá a estar pendiente. ¿Continuar?')) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await api.post<Convenio>(`/rentas/convenios/${convenio.id}/anular`, { motivo: motivo.trim() })
      alAnular(data)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void anular(e)} className="mt-3 max-w-xl rounded-xl bg-white p-5 shadow-md ring-1 ring-red-200 print:hidden">
      <h2 className="font-semibold text-red-800">Anular convenio</h2>
      <p className="mt-1 text-xs text-slate-500">Solo sin cuotas pagadas. La deuda original vuelve a quedar pendiente con su mora.</p>
      <label htmlFor="conv-motivo" className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        Motivo
      </label>
      <textarea
        id="conv-motivo"
        rows={3}
        value={motivo}
        maxLength={200}
        disabled={isSaving}
        onChange={(e) => setMotivo(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSaving}
        className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
      >
        <i aria-hidden="true" className="bi bi-x-circle mr-1" />
        {isSaving ? 'Anulando…' : 'Anular convenio'}
      </button>
    </form>
  )
}

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="text-slate-800">{valor}</p>
    </div>
  )
}
