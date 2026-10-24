import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { RUTA_BASE, soles } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { AccionesValor } from './AccionesValor'
import { RUTA_EXPEDIENTES } from '../fiscalizacion/fiscalizacionApi'
import { ESTILO_VALOR, MODALIDADES, NOMBRE_VALOR, direccionPredio, numeroValor, type Valor } from './valoresApi'

// OP/RD para imprimir o guardar como PDF (specs/rentas-valores-v1.md, V3): montos a la fecha de
// emisión (lo que se notifica) y, aparte, la deuda actualizada a hoy.

const FUNDAMENTO = {
  OP: [
    'Se emite conforme al artículo 78° del Texto Único Ordenado del Código Tributario, sobre la base de la declaración jurada del Impuesto Predial presentada por el contribuyente (Decreto Legislativo N° 776, Ley de Tributación Municipal).',
    'El reajuste de las cuotas 2 a 4 se aplica según el artículo 15° de la Ley de Tributación Municipal y los intereses moratorios según el artículo 33° del Código Tributario (TIM).',
    'La Orden de Pago notificada es exigible en cobranza coactiva (artículo 115°, inciso d). Para reclamarla se requiere el pago previo de la deuda no reclamada (artículo 136°).',
  ],
  RD: [
    'Se emite conforme a los artículos 76° y 77° del Texto Único Ordenado del Código Tributario, determinando los Arbitrios Municipales del predio según la ordenanza de arbitrios del año.',
    'Los intereses moratorios se calculan según el artículo 33° del Código Tributario (TIM).',
    'Puede interponer recurso de reclamación dentro de los veinte (20) días hábiles siguientes a su notificación (artículo 137°). Vencido el plazo sin reclamar, la deuda es exigible en cobranza coactiva (artículo 115°, inciso a).',
  ],
  // RD que nace de una fiscalización (specs/rentas-fiscalizacion-v1.md, decisión 4).
  RD_FISCALIZACION: [
    'Se emite conforme a los artículos 61°, 62°, 75°, 76° y 77° del Texto Único Ordenado del Código Tributario, como resultado de la fiscalización del predio: se determina el tributo omitido entre lo declarado por el contribuyente y lo verificado en la inspección (Decreto Legislativo N° 776, Ley de Tributación Municipal).',
    'El reajuste del Impuesto Predial se aplica según el artículo 15° de la Ley de Tributación Municipal y los intereses moratorios según el artículo 33° del Código Tributario (TIM), desde el vencimiento original de cada cuota.',
    'Puede interponer recurso de reclamación dentro de los veinte (20) días hábiles siguientes a su notificación (artículo 137°). Vencido el plazo sin reclamar, la deuda es exigible en cobranza coactiva (artículo 115°, inciso a).',
  ],
} as const

export function ValorImprimible() {
  const { id } = useParams()
  const [valor, setValor] = useState<Valor | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<Valor>(`/rentas/valores/${id}`)
        if (!cancelled) setValor(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id])

  const v = valor
  const total = (campo: 'importe' | 'reajuste' | 'mora' | 'derechoEmision' | 'subtotal') =>
    v ? v.detalles.reduce((a, d) => a + Number(d[campo]), 0) : 0

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <Link
            to={
              v?.fiscalizacion
                ? `${RUTA_EXPEDIENTES}/${v.fiscalizacion.id}`
                : v
                  ? `${RUTA_BASE}/contribuyentes/${v.contribuyente.id}`
                  : RUTA_BASE
            }
            className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-arrow-left" />
            {v?.fiscalizacion ? 'Expediente de fiscalización' : 'Ficha del contribuyente'}
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!v}
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
          ) : !v ? (
            <p role="status" className="text-slate-500">
              Cargando valor…
            </p>
          ) : (
            <>
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Municipalidad Distrital de San Bartolo · Subgerencia de Rentas
                  </p>
                  <h1 className="text-xl font-bold uppercase text-mar-profundo">{NOMBRE_VALOR[v.tipo]}</h1>
                  <p className="font-mono text-base font-semibold text-mar-profundo">{numeroValor(v)}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILO_VALOR[v.estado]}`}>{v.estado}</span>
                  <p className="mt-1 text-slate-600">Fecha de emisión: {v.fechaEmision}</p>
                  <p className="text-slate-600">Ejercicio: {v.anioFiscal}</p>
                </div>
              </header>

              <section aria-label="Deudor" className="mt-4 grid gap-2 sm:grid-cols-2">
                <Campo titulo="Contribuyente" valor={v.contribuyente.nombreCompleto} />
                <Campo titulo="Documento" valor={`${v.contribuyente.tipoDoc} ${v.contribuyente.numDoc}`} />
                <Campo titulo="Domicilio fiscal" valor={v.contribuyente.direccionFiscal ?? '—'} />
                {v.tipo === 'RD' && v.predio ? (
                  <Campo
                    titulo="Predio"
                    valor={`${direccionPredio(v.predio)}${v.predio.usoPredio ? ` · uso ${v.predio.usoPredio}` : ''}${
                      v.predio.zona ? ` · zona ${v.predio.zona.codigo}` : ''
                    }`}
                  />
                ) : (
                  <Campo titulo="Tributo" valor={`Impuesto Predial ${v.anioFiscal}`} />
                )}
              </section>

              {v.fiscalizacion && (
                <section aria-label="Determinación por fiscalización" className="mt-4 rounded-md bg-mar-profundo/5 px-3 py-2">
                  <p>
                    Determinación por fiscalización · Expediente <strong>FIS {v.fiscalizacion.numero}</strong>
                    {v.baseImponible && ` · base imponible fiscalizada ${soles(v.baseImponible)}`}
                  </p>
                  {v.fiscalizacion.porTributo.length > 0 && (
                    <table className="mt-2 w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th scope="col" className="py-1 pr-2">Tributo {v.anioFiscal}</th>
                          <th scope="col" className="py-1 pr-2 text-right">Declarado</th>
                          <th scope="col" className="py-1 pr-2 text-right">Fiscalizado</th>
                          <th scope="col" className="py-1 text-right">Omitido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.fiscalizacion.porTributo.map((t) => (
                          <tr key={t.tributo} className="border-t border-slate-200">
                            <td className="py-1 pr-2">{t.tributo}</td>
                            <td className="py-1 pr-2 text-right">{soles(t.declarado)}</td>
                            <td className="py-1 pr-2 text-right">{soles(t.fiscalizado)}</td>
                            <td className="py-1 text-right font-semibold">{soles(t.omitido)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              )}

              {v.tipo === 'OP' && v.baseImponible && (
                <section aria-label="Base imponible" className="mt-4 rounded-md bg-mar-profundo/5 px-3 py-2">
                  <p>
                    Base imponible (autoavalúo según su declaración jurada): <strong>{soles(v.baseImponible)}</strong>
                    {v.uit && ` · UIT ${v.anioFiscal}: ${soles(v.uit)}`}
                  </p>
                  {v.escala.length > 0 && (
                    <p className="text-xs text-slate-600">
                      Tasas (D. Leg. 776, art. 13):{' '}
                      {v.escala
                        .map((t) => `${t.hastaUit ? `de ${t.desdeUit} a ${t.hastaUit} UIT` : `más de ${t.desdeUit} UIT`} ${t.tasa}%`)
                        .join(' · ')}
                    </p>
                  )}
                </section>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <caption className="mb-2 text-left font-semibold text-mar-profundo">Detalle de la deuda al {v.fechaEmision}</caption>
                  <thead>
                    <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="py-2 pr-2">Año</th>
                      <th scope="col" className="py-2 pr-2">Tributo</th>
                      <th scope="col" className="py-2 pr-2">Cuota</th>
                      <th scope="col" className="py-2 pr-2">Vence</th>
                      <th scope="col" className="py-2 pr-2 text-right">Insoluto</th>
                      <th scope="col" className="py-2 pr-2 text-right">Reajuste</th>
                      <th scope="col" className="py-2 pr-2 text-right">Interés</th>
                      <th scope="col" className="py-2 pr-2 text-right">Emisión</th>
                      <th scope="col" className="py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.detalles.map((d) => (
                      <tr key={d.id} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2">{d.anio}</td>
                        <td className="py-1.5 pr-2">{d.tributo.nombre}</td>
                        <td className="py-1.5 pr-2">{d.cuota}</td>
                        <td className="py-1.5 pr-2">{d.vencimiento ?? '—'}</td>
                        <td className="py-1.5 pr-2 text-right">{soles(d.importe)}</td>
                        <td className="py-1.5 pr-2 text-right">{soles(d.reajuste)}</td>
                        <td className="py-1.5 pr-2 text-right">{soles(d.mora)}</td>
                        <td className="py-1.5 pr-2 text-right">{soles(d.derechoEmision)}</td>
                        <td className="py-1.5 text-right font-medium">{soles(d.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 font-semibold text-mar-profundo">
                      <td colSpan={4} className="py-2">
                        Total
                      </td>
                      <td className="py-2 pr-2 text-right">{soles(total('importe'))}</td>
                      <td className="py-2 pr-2 text-right">{soles(total('reajuste'))}</td>
                      <td className="py-2 pr-2 text-right">{soles(total('mora'))}</td>
                      <td className="py-2 pr-2 text-right">{soles(total('derechoEmision'))}</td>
                      <td className="py-2 text-right">{soles(v.totalDeuda)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                Deuda actualizada al {v.hoy.fecha}: <strong>{soles(v.hoy.total)}</strong>. Los intereses y el reajuste siguen
                corriendo hasta la fecha de pago.
              </p>

              <section aria-label="Fundamentos" className="mt-4 space-y-2 text-xs leading-relaxed text-slate-700">
                <p className="font-semibold uppercase tracking-wider text-slate-500">Fundamentos y base legal</p>
                {FUNDAMENTO[v.fiscalizacion ? 'RD_FISCALIZACION' : v.tipo].map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </section>

              {v.fechaNotificacion && (
                <section aria-label="Notificación" className="mt-4 rounded-md border border-slate-200 px-3 py-2">
                  <p>
                    Notificado el <strong>{v.fechaNotificacion}</strong> ·{' '}
                    {MODALIDADES.find((m) => m.value === v.modalidadNotificacion)?.label ?? v.modalidadNotificacion}
                    {v.notificadoNombre && ` · ${v.notificadoNombre}`}
                    {v.notificadoDni && ` (${v.notificadoDni})`}
                  </p>
                  {v.fechaExigible && (
                    <p className="text-slate-600">
                      {v.tipo === 'RD'
                        ? 'Plazo de reclamo: 20 días hábiles. Si no se reclama, será exigible en cobranza coactiva desde el'
                        : 'Exigible en cobranza coactiva desde el'}{' '}
                      <strong>{v.fechaExigible}</strong>.
                    </p>
                  )}
                </section>
              )}

              {v.estado === 'ANULADO' && v.motivoAnulacion && (
                <p className="mt-3 font-medium text-red-700">Anulado: {v.motivoAnulacion}</p>
              )}

              <footer className="mt-12 grid gap-8 text-center text-xs text-slate-500 sm:grid-cols-2">
                <div className="border-t border-slate-400 pt-1">Subgerencia de Rentas · firma y sello</div>
                <div className="border-t border-slate-400 pt-1">Recibí conforme · nombre, DNI, fecha y hora</div>
              </footer>
            </>
          )}
        </main>
        {v && <AccionesValor key={v.id} valor={v} alCambiar={setValor} />}
      </div>
    </div>
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
