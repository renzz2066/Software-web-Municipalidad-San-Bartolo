import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { api } from '../../../lib/api'
import { useCatalogo } from '../catalogos/catalogosApi'
import { BuscadorContribuyente } from '../contribuyentes/BuscadorContribuyente'
import { documentoTexto, type Contribuyente } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { AnexoEditor, Bloque, CLASE, Campo, Select } from './AnexoEditor'
import { RUTA_DJ, aBody, anexoVacio, desdeDetalle, etiquetaPredio, formVacio, validarForm, type DjDetalle, type DjForm } from './djApi'

// Alta y edición de la DJ presentada (Fase 4; J01–J07, J13). Una DJ por contribuyente con un
// anexo por predio. Queda PENDIENTE: se determina y liquida desde su ficha (Fase 5). Con :id edita.
// Reemplaza al formulario de DJ de v1 (Fase 6): las rutas viejas redirigen aquí.
export function DjFormulario() {
  const { id } = useParams()
  const editando = Boolean(id)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const motivos = useCatalogo('MOTIVO_DJ')
  const subMotivosTodos = useCatalogo('SUB_MOTIVO_DJ')
  const tiposAdjunto = useCatalogo('TIPO_DOC_ADJUNTO')
  const [form, setForm] = useState<DjForm>(formVacio)
  const [numero, setNumero] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(editando || params.has('contribuyente') || params.has('predio'))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        if (id) {
          const { data } = await api.get<DjDetalle>(`/declaraciones/${id}`)
          if (vivo) {
            setForm(desdeDetalle(data))
            setNumero(data.numeroTexto)
          }
        } else {
          // Desde la ficha de la persona o del predio: ?contribuyente=&motivo=&predio= precargan la DJ.
          const motivo = params.get('motivo')
          if (motivo) setForm((f) => ({ ...f, motivo }))
          if (params.get('contribuyente')) {
            const { data } = await api.get<Contribuyente>(`/contribuyentes/${params.get('contribuyente')}`)
            if (vivo) setForm((f) => ({ ...f, contribuyente: { id: data.id, nombreCompleto: data.nombreCompleto, documento: documentoTexto(data) } }))
          }
          if (params.get('predio')) {
            const { data } = await api.get<{ id: number; nombre: string | null; tipo: 'URBANO' | 'RUSTICO'; direccion: { direccion: string } | null }>(`/predios/${params.get('predio')}`)
            if (vivo) setForm((f) => ({ ...f, anexos: [{ ...anexoVacio(), predio: { id: data.id, etiqueta: etiquetaPredio(data), tipo: data.tipo } }] }))
          }
        }
      } catch (err) {
        if (vivo) setError(mensajeError(err))
      } finally {
        if (vivo) setIsLoading(false)
      }
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [id, params])

  const set = <K extends keyof DjForm>(k: K, v: DjForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const subMotivos = subMotivosTodos.filter((s) => s.padre?.codigo === form.motivo)
  const tipoMotivo = motivos.find((m) => m.codigo === form.motivo)?.atributos?.tipo

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const v = validarForm(form)
    if (v) {
      setError(v)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const body = aBody(form)
      const { data } = editando ? await api.put<DjDetalle>(`/declaraciones/${id}`, body) : await api.post<DjDetalle>('/declaraciones', body)
      navigate(`${RUTA_DJ}/${data.id}`)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsSaving(false)
    }
  }

  const volver = editando ? { etiqueta: `DJ ${numero ?? ''}`, ruta: `${RUTA_DJ}/${id}` } : { etiqueta: 'DJ presentadas', ruta: RUTA_DJ }

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader titulo={editando ? `Editar DJ ${numero ?? ''}` : 'Nueva declaración jurada'} descripcion="Un anexo por cada predio que declara la persona." volverA={volver} />

        {isLoading ? (
          <p role="status" className="mt-6 text-sm text-slate-500">
            Cargando…
          </p>
        ) : (
          <form onSubmit={(e) => void guardar(e)} noValidate className="mt-4 space-y-6">
            <section className="space-y-4 rounded-panel border border-borde bg-white p-4">
              <Bloque titulo="Contribuyente que declara">
                {form.contribuyente ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium text-mar-profundo">{form.contribuyente.nombreCompleto}</span>
                      <span className="ml-2 font-mono text-xs text-slate-500">{form.contribuyente.documento}</span>
                    </span>
                    {!editando && (
                      <button type="button" onClick={() => set('contribuyente', null)} className="rounded-md px-2 py-1 text-xs font-medium text-mar hover:bg-white focus-visible:outline-3 focus-visible:outline-turquesa">
                        Cambiar
                      </button>
                    )}
                  </div>
                ) : (
                  <BuscadorContribuyente
                    id="dj-contribuyente"
                    label="Buscar contribuyente"
                    alElegir={(c) => set('contribuyente', { id: c.id, nombreCompleto: c.nombreCompleto, documento: documentoTexto(c) })}
                  />
                )}
              </Bloque>

              <div className="grid gap-3 sm:grid-cols-4">
                <Campo id="dj-motivo" label="Motivo *">
                  <Select
                    id="dj-motivo"
                    items={motivos}
                    value={form.motivo}
                    onChange={(v) => setForm((f) => ({ ...f, motivo: v, subMotivo: '', anexos: f.anexos.map((a) => ({ ...a, subMotivo: '' })) }))}
                  />
                </Campo>
                {subMotivos.length > 0 && (
                  <Campo id="dj-submotivo" label="Sub-motivo">
                    <Select id="dj-submotivo" items={subMotivos} value={form.subMotivo} onChange={(v) => set('subMotivo', v)} />
                  </Campo>
                )}
                <Campo id="dj-fecha" label="Fecha de presentación *">
                  <input id="dj-fecha" type="date" value={form.fechaPresentacion} onChange={(e) => set('fechaPresentacion', e.target.value)} className={CLASE} />
                </Campo>
                <Campo id="dj-formulario" label="N° de formulario físico">
                  <input id="dj-formulario" value={form.numeroFormulario} maxLength={20} onChange={(e) => set('numeroFormulario', e.target.value)} className={`${CLASE} uppercase`} />
                </Campo>
                <Campo id="dj-folios" label="Folios">
                  <input id="dj-folios" value={form.folios} inputMode="numeric" maxLength={4} onChange={(e) => set('folios', e.target.value.replace(/\D/g, ''))} className={CLASE} />
                </Campo>
                <div className="sm:col-span-3">
                  <Campo id="dj-obs" label="Observación">
                    <input id="dj-obs" value={form.observacion} maxLength={250} onChange={(e) => set('observacion', e.target.value)} className={CLASE} />
                  </Campo>
                </div>
              </div>
              {tipoMotivo && (
                <p className="text-xs text-slate-500">
                  DJ {String(tipoMotivo).toLowerCase()}
                  {tipoMotivo === 'INFORMATIVA' ? ': no genera cuenta corriente (J07).' : ': al liquidar genera la cuenta de los años que afecta.'}
                </p>
              )}

              <Bloque titulo="Documentos adjuntos">
                {form.documentos.map((d, i) => (
                  <div key={i} className="grid items-end gap-2 sm:grid-cols-[12rem_1fr_10rem_1fr_auto]">
                    <Campo id={`dj-doc-tipo-${i}`} label="Tipo">
                      <Select id={`dj-doc-tipo-${i}`} items={tiposAdjunto} value={d.tipo} vacio={false} onChange={(v) => set('documentos', form.documentos.map((x, j) => (j === i ? { ...x, tipo: v } : x)))} />
                    </Campo>
                    <Campo id={`dj-doc-num-${i}`} label="Número">
                      <input id={`dj-doc-num-${i}`} value={d.numero} maxLength={40} onChange={(e) => set('documentos', form.documentos.map((x, j) => (j === i ? { ...x, numero: e.target.value } : x)))} className={`${CLASE} uppercase`} />
                    </Campo>
                    <Campo id={`dj-doc-fecha-${i}`} label="Fecha">
                      <input id={`dj-doc-fecha-${i}`} type="date" value={d.fecha} onChange={(e) => set('documentos', form.documentos.map((x, j) => (j === i ? { ...x, fecha: e.target.value } : x)))} className={CLASE} />
                    </Campo>
                    <Campo id={`dj-doc-obs-${i}`} label="Observación">
                      <input id={`dj-doc-obs-${i}`} value={d.observacion} maxLength={250} onChange={(e) => set('documentos', form.documentos.map((x, j) => (j === i ? { ...x, observacion: e.target.value } : x)))} className={CLASE} />
                    </Campo>
                    <button
                      type="button"
                      aria-label={`Quitar documento ${i + 1}`}
                      onClick={() => set('documentos', form.documentos.filter((_, j) => j !== i))}
                      className="mb-0.5 rounded-md p-2 text-slate-500 hover:bg-ladrillo/10 hover:text-ladrillo focus-visible:outline-3 focus-visible:outline-turquesa"
                    >
                      <i aria-hidden="true" className="bi bi-x-lg" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set('documentos', [...form.documentos, { tipo: tiposAdjunto[0]?.codigo ?? 'OTROS', numero: '', fecha: '', observacion: '' }])}
                  className="rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
                  Agregar documento
                </button>
              </Bloque>
            </section>

            {form.anexos.map((a, i) => (
              <AnexoEditor
                key={i}
                numero={i + 1}
                anexo={a}
                motivo={form.motivo}
                onChange={(x) => set('anexos', form.anexos.map((y, j) => (j === i ? x : y)))}
                onQuitar={form.anexos.length > 1 ? () => set('anexos', form.anexos.filter((_, j) => j !== i)) : undefined}
              />
            ))}
            <button
              type="button"
              onClick={() => set('anexos', [...form.anexos, anexoVacio()])}
              className="rounded-md border border-mar-profundo/30 bg-white px-3 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
              Agregar anexo (otro predio)
            </button>

            <div>
              {error && (
                <p role="alert" className="mb-3 text-sm font-medium text-ladrillo">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                >
                  {isSaving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar DJ'}
                </button>
                <Link to={volver.ruta} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
                  Cancelar
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
