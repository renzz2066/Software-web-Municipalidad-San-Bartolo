import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useAuth } from '../../../context/AuthContext'
import { api } from '../../../lib/api'
import { nombreDe, useCatalogo } from '../catalogos/catalogosApi'
import { CLASIFICACIONES, ESTADOS_CONSERVACION, MATERIALES, etiqueta } from '../catalogosConstruccion'
import { RUTA_BASE } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { ESTILO_ESTADO_DJ, ETIQUETA_ESTADO_DJ, RUTA_DJ, etiquetaPredio, type AnexoApi, type DjDetalle } from './djApi'

// Ficha de la DJ presentada: cabecera, documentos y anexos. Se edita o anula mientras está
// pendiente (J04); se reabre una liquidada (J05, supervisor). Nunca se borra.

const SUPERVISION = ['SUPERVISOR', 'ADMIN']

export function FichaDj() {
  const { id } = useParams()
  const { user } = useAuth()
  const motivos = useCatalogo('MOTIVO_DJ')
  const subMotivos = useCatalogo('SUB_MOTIVO_DJ')
  const adjuntos = useCatalogo('TIPO_DOC_ADJUNTO')
  const [dj, setDj] = useState<DjDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)
  const [motivoAnular, setMotivoAnular] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        const { data } = await api.get<DjDetalle>(`/declaraciones/${id}`)
        if (vivo) setDj(data)
      } catch (err) {
        if (vivo) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [id])

  async function accion(ruta: string, body?: object) {
    setOcupado(true)
    setError(null)
    try {
      const { data } = await api.post<DjDetalle>(`/declaraciones/${id}/${ruta}`, body)
      setDj(data)
      setAnulando(false)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  const pendiente = dj?.estado === 'PENDIENTE'

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo={dj ? `DJ ${dj.numeroTexto}` : 'Declaración jurada'}
          descripcion={dj ? `${nombreDe(motivos, dj.motivo)}${dj.subMotivo ? ` · ${nombreDe(subMotivos, dj.subMotivo)}` : ''} · presentada el ${dj.fechaPresentacion.slice(0, 10)}` : undefined}
          volverA={{ etiqueta: 'DJ presentadas', ruta: RUTA_DJ }}
          accion={pendiente ? { etiqueta: 'Editar DJ', icono: 'bi bi-pencil', to: `${RUTA_DJ}/${id}/editar` } : undefined}
        />

        {!dj ? (
          <p role={error ? 'alert' : 'status'} className={`mt-6 text-sm ${error ? 'font-medium text-ladrillo' : 'text-slate-500'}`}>
            {error ?? 'Cargando…'}
          </p>
        ) : (
          <>
            <section className="mt-4 rounded-panel border border-borde bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <dl className="grid flex-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contribuyente</dt>
                    <dd className="mt-0.5">
                      <Link to={`${RUTA_BASE}/contribuyentes/${dj.contribuyente.id}`} className="font-medium text-mar hover:underline">
                        {dj.contribuyente.nombreCompleto}
                      </Link>
                    </dd>
                  </div>
                  <Dato etiqueta="Tipo" valor={dj.tipo === 'INFORMATIVA' ? 'Informativa (no genera cuenta)' : 'Declarativa'} />
                  <Dato etiqueta="Formulario / folios" valor={[dj.numeroFormulario, dj.folios ? `${dj.folios} folios` : null].filter(Boolean).join(' · ') || '—'} />
                  {dj.djPrevio && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rectifica a</dt>
                      <dd className="mt-0.5">
                        <Link to={`${RUTA_DJ}/${dj.djPrevio.id}`} className="font-mono text-mar hover:underline">
                          {dj.djPrevio.numeroTexto}
                        </Link>
                      </dd>
                    </div>
                  )}
                  <Dato etiqueta="Registrada por" valor={dj.creadoPor ? `${dj.creadoPor.nombres} ${dj.creadoPor.apellidos}`.trim() : '—'} />
                  {dj.observacion && <Dato etiqueta="Observación" valor={dj.observacion} />}
                  {dj.estado === 'ANULADA' && (
                    <Dato
                      etiqueta="Anulada"
                      valor={`${dj.anuladaMotivo ?? ''} (${dj.anuladaPor ? dj.anuladaPor.usuario : '—'}, ${dj.anuladaAt?.slice(0, 10) ?? ''})`}
                    />
                  )}
                </dl>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${ESTILO_ESTADO_DJ[dj.estado]}`}>{ETIQUETA_ESTADO_DJ[dj.estado]}</span>
              </div>

              {dj.documentos.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Documentos adjuntos</p>
                  <ul className="mt-1 space-y-0.5 text-slate-700">
                    {dj.documentos.map((d, i) => (
                      <li key={i}>
                        {nombreDe(adjuntos, d.tipo)}
                        {d.numero && ` N° ${d.numero}`}
                        {d.fecha && ` · ${d.fecha.slice(0, 10)}`}
                        {d.observacion && <span className="text-slate-500"> · {d.observacion}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(pendiente || dj.estado === 'EN_REVISION' || dj.estado === 'LIQUIDADA') && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  {anulando ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-0 flex-1 text-sm">
                        <span className="block text-xs text-slate-500">Motivo de la anulación (mínimo 10 caracteres)</span>
                        <input
                          value={motivoAnular}
                          maxLength={250}
                          onChange={(e) => setMotivoAnular(e.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={ocupado || motivoAnular.trim().length < 10}
                        onClick={() => void accion('anular', { motivo: motivoAnular.trim() })}
                        className="rounded-md bg-ladrillo px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                      >
                        Confirmar anulación
                      </button>
                      <button type="button" onClick={() => setAnulando(false)} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {dj.estado !== 'LIQUIDADA' && (
                        <button
                          type="button"
                          onClick={() => setAnulando(true)}
                          className="rounded-md border border-ladrillo/40 px-3 py-1.5 text-xs font-medium text-ladrillo hover:bg-ladrillo/5 focus-visible:outline-3 focus-visible:outline-turquesa"
                        >
                          Anular DJ
                        </button>
                      )}
                      {dj.estado === 'LIQUIDADA' && SUPERVISION.includes(user?.rol ?? '') && (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => void accion('reabrir')}
                          className="rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                        >
                          Reabrir DJ
                        </button>
                      )}
                    </div>
                  )}
                  {error && (
                    <p role="alert" className="mt-2 text-sm font-medium text-ladrillo">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </section>

            {dj.anexos.map((a) => (
              <Anexo key={a.id} a={a} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Anexo({ a }: { a: AnexoApi }) {
  const condiciones = useCatalogo('CONDICION_PROPIEDAD')
  const usos = useCatalogo('USO_PREDIO')
  const subUsos = useCatalogo('SUB_USO_PREDIO')
  const transferencia = useCatalogo('TIPO_DOC_TRANSFERENCIA')
  return (
    <section className="mt-6 rounded-panel border border-borde bg-white" aria-label={`Anexo ${a.numero}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-mar-profundo">
          Anexo {a.numero} ·{' '}
          <Link to={`${RUTA_BASE}/predios/${a.predio.id}`} className="text-mar hover:underline">
            {etiquetaPredio(a.predio)}
          </Link>
        </h2>
        {a.predioNuevo && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">Predio nuevo (inactivo hasta liquidar)</span>}
      </div>
      <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-4">
        <Dato etiqueta="Condición / %" valor={`${nombreDe(condiciones, a.condicion)} · ${Number(a.porcentaje)}%`} />
        <Dato etiqueta="Adquisición" valor={a.fechaAdquisicion?.slice(0, 10) ?? '—'} />
        {a.fechaDescargo && <Dato etiqueta="Descargo" valor={a.fechaDescargo.slice(0, 10)} />}
        <Dato etiqueta="Predial desde" valor={String(a.anioAfectacion)} />
        <Dato etiqueta="Arbitrios desde" valor={a.fechaAfectacionArbitrios.slice(0, 7)} />
        <Dato etiqueta="Terreno" valor={`${Number(a.areaTerreno)} m²${a.areaComun ? ` · común ${Number(a.areaComun)} m²` : ''}`} />
        {a.valorTransferencia && <Dato etiqueta="Valor de transferencia" valor={`${a.moneda === 'USD' ? 'US$' : 'S/'} ${Number(a.valorTransferencia)}`} />}
        {a.partidaRegistral && <Dato etiqueta="Partida registral" valor={a.partidaRegistral} />}
      </dl>

      {a.usos.length > 0 && (
        <Lista titulo="Usos">
          {a.usos.map((u, i) => (
            <li key={i}>
              {nombreDe(usos, u.uso)}
              {u.subUso && ` · ${nombreDe(subUsos, u.subUso)}`} · {Number(u.area)} m²
              {u.inquilino && ` · inquilino ${u.inquilino}`}
              {u.predominante && <span className="ml-1 rounded bg-mar/10 px-1 text-xs font-semibold text-mar-profundo">predominante</span>}
            </li>
          ))}
        </Lista>
      )}
      {a.niveles.length > 0 && (
        <Lista titulo="Niveles">
          {a.niveles.map((n, i) => (
            <li key={i}>
              Nivel {n.nivel} · {n.anioConstruccion ?? '—'} · {etiqueta(CLASIFICACIONES, n.clasificacion)} · {etiqueta(MATERIALES, n.material)} ·{' '}
              {etiqueta(ESTADOS_CONSERVACION, n.estadoConservacion)} · <span className="font-mono tracking-widest">{n.categorias}</span> · {Number(n.areaPropia)} m²
              {n.areaComun && ` + común ${Number(n.areaComun)} m² (${Number(n.participacion)}%)`}
            </li>
          ))}
        </Lista>
      )}
      {a.obras.length > 0 && (
        <Lista titulo="Obras complementarias">
          {a.obras.map((o, i) => (
            <li key={i}>
              {o.descripcion} · {Number(o.cantidad)} {o.unidad ?? ''}
              {o.valorDeclarado && ` · S/ ${Number(o.valorDeclarado)}`}
            </li>
          ))}
        </Lista>
      )}
      {a.rusticos.length > 0 && (
        <Lista titulo="Aranceles rústicos">
          {a.rusticos.map((r, i) => (
            <li key={i}>
              {r.categoria}
              {r.clasificacion && ` · ${r.clasificacion}`} · {Number(r.hectareas)} ha
            </li>
          ))}
        </Lista>
      )}
      {a.adquirientes.length > 0 && (
        <Lista titulo="Adquirientes o transferentes">
          {a.adquirientes.map((x, i) => (
            <li key={i}>
              <span className="font-medium">{x.rol === 'ADQUIRIENTE' ? 'Adquiriente' : 'Transferente'}:</span>{' '}
              {x.persona ? (
                <Link to={`${RUTA_BASE}/contribuyentes/${x.persona.id}`} className="text-mar hover:underline">
                  {x.nombreCompleto}
                </Link>
              ) : (
                x.nombreCompleto
              )}
              {x.numDoc && ` · ${x.tipoDoc} ${x.numDoc}`}
              {x.documentoTransferencia && ` · ${nombreDe(transferencia, x.documentoTransferencia)}`}
            </li>
          ))}
        </Lista>
      )}
    </section>
  )
}

function Lista({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <ul className="mt-1 space-y-0.5 text-slate-700">{children}</ul>
    </div>
  )
}

function Dato({ etiqueta: e, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{e}</dt>
      <dd className="mt-0.5 text-slate-800">{valor}</dd>
    </div>
  )
}
