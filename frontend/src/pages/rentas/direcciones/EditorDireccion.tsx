import { useState } from 'react'
import { api } from '../../../lib/api'
import { useCatalogo } from '../catalogos/catalogosApi'
import { mensajeError } from '../maestros/maestrosApi'
import {
  MAX_COMPONENTES,
  direccionExistente,
  literalPrevia,
  useConfigDirecciones,
  useUbicacion,
  type DireccionDetalle,
  type DireccionElegida,
} from './direccionesApi'

// Alta o edición de una dirección única (D02–D05). No es un <form>: también se usa dentro del
// formulario de la persona, y un formulario no puede ir dentro de otro.

interface ComponenteForm {
  componente: string
  valor: string
}

interface Form {
  zonaId: string
  urbanizacionId: string
  viaId: string
  componentes: ComponenteForm[]
  referencia: string
  latitud: string
  longitud: string
}

function desdeDetalle(d: DireccionDetalle | null | undefined): Form {
  return {
    zonaId: d?.zonaId ? String(d.zonaId) : '',
    urbanizacionId: d?.urbanizacionId ? String(d.urbanizacionId) : '',
    viaId: d?.viaId ? String(d.viaId) : '',
    componentes: d ? d.componentes.map((c) => ({ componente: c.componente, valor: c.valor })) : [{ componente: 'NUMERO', valor: '' }],
    referencia: d?.referencia ?? '',
    latitud: d?.latitud ?? '',
    longitud: d?.longitud ?? '',
  }
}

function validar(f: Form): string | null {
  if (!f.viaId && !f.urbanizacionId) return 'Indica al menos la vía o la habilitación urbana.'
  if (f.componentes.some((c) => !c.valor.trim())) return 'Completa o quita los componentes vacíos.'
  const codigos = f.componentes.map((c) => c.componente)
  if (new Set(codigos).size !== codigos.length) return 'Un componente no se repite: quita el duplicado.'
  const lat = f.latitud.trim()
  const lon = f.longitud.trim()
  if (Boolean(lat) !== Boolean(lon)) return 'Indica latitud y longitud, o ninguna.'
  if (lat && (!Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90)) return 'La latitud debe estar entre -90 y 90.'
  if (lon && (!Number.isFinite(Number(lon)) || Math.abs(Number(lon)) > 180)) return 'La longitud debe estar entre -180 y 180.'
  return null
}

export function EditorDireccion({
  inicial,
  alGuardar,
  alCancelar,
  alUsarExistente,
}: {
  inicial?: DireccionDetalle | null
  alGuardar: (d: DireccionElegida) => void
  alCancelar?: () => void
  // Si la dirección ya existe (409), el formulario de la persona puede usar esa directamente.
  alUsarExistente?: (id: number) => void
}) {
  const [form, setForm] = useState<Form>(() => desdeDetalle(inicial))
  const [error, setError] = useState<string | null>(null)
  const [existente, setExistente] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const { catalogos, error: errorUbicacion } = useUbicacion()
  const tipos = useCatalogo('COMPONENTE_DIRECCION')
  const config = useConfigDirecciones()
  const idBase = inicial ? `dir-${inicial.id}` : 'dir-nueva'
  const distrito = inicial ? (inicial.distrito?.distrito ?? null) : (config?.distrito?.distrito ?? null)
  const previa = literalPrevia(form, catalogos, tipos, distrito)

  function cambiar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
    setError(null)
    setExistente(null)
  }
  function cambiarComponente(i: number, campo: keyof ComponenteForm, valor: string) {
    cambiar(
      'componentes',
      form.componentes.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)),
    )
  }
  function mover(i: number, paso: -1 | 1) {
    const j = i + paso
    if (j < 0 || j >= form.componentes.length) return
    const lista = [...form.componentes]
    ;[lista[i], lista[j]] = [lista[j], lista[i]]
    cambiar('componentes', lista)
  }
  function agregar() {
    const libre = tipos.find((t) => !form.componentes.some((c) => c.componente === t.codigo))
    if (libre) cambiar('componentes', [...form.componentes, { componente: libre.codigo, valor: '' }])
  }

  async function guardar() {
    const e = validar(form)
    if (e) {
      setError(e)
      return
    }
    setIsSaving(true)
    setError(null)
    const body = {
      zonaId: form.zonaId ? Number(form.zonaId) : null,
      urbanizacionId: form.urbanizacionId ? Number(form.urbanizacionId) : null,
      viaId: form.viaId ? Number(form.viaId) : null,
      componentes: form.componentes.map((c) => ({ componente: c.componente, valor: c.valor.trim() })),
      referencia: form.referencia.trim() || null,
      latitud: form.latitud.trim() ? Number(form.latitud) : null,
      longitud: form.longitud.trim() ? Number(form.longitud) : null,
    }
    try {
      const { data } = inicial
        ? await api.patch<DireccionDetalle>(`/direcciones/${inicial.id}`, body)
        : await api.post<DireccionDetalle>('/direcciones', body)
      alGuardar({ id: data.id, direccion: data.direccion, referencia: data.referencia, activo: data.activo })
    } catch (err) {
      setError(mensajeError(err))
      setExistente(direccionExistente(err))
    } finally {
      setIsSaving(false)
    }
  }

  const tiposLibres = (actual: string) => tipos.filter((t) => t.codigo === actual || !form.componentes.some((c) => c.componente === t.codigo))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Sector (zona)" id={`${idBase}-zona`}>
          <select id={`${idBase}-zona`} value={form.zonaId} onChange={(e) => cambiar('zonaId', e.target.value)} className={CLASE_INPUT}>
            <option value="">—</option>
            {catalogos?.zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.codigo} · {z.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Habilitación urbana" id={`${idBase}-urb`}>
          <select id={`${idBase}-urb`} value={form.urbanizacionId} onChange={(e) => cambiar('urbanizacionId', e.target.value)} className={CLASE_INPUT}>
            <option value="">—</option>
            {catalogos?.urbanizaciones.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Vía" id={`${idBase}-via`}>
          <select id={`${idBase}-via`} value={form.viaId} onChange={(e) => cambiar('viaId', e.target.value)} className={CLASE_INPUT}>
            <option value="">—</option>
            {catalogos?.vias.map((v) => (
              <option key={v.id} value={v.id}>
                {v.tipoVia} {v.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      {errorUbicacion && <p className="text-xs text-ladrillo">No se pudieron cargar sectores, habilitaciones y vías. Recarga la página.</p>}
      {catalogos && catalogos.vias.length === 0 && catalogos.urbanizaciones.length === 0 && (
        <p className="text-xs text-amber-700">No hay vías ni habilitaciones: créalas en Rentas → Maestros → Ubicación.</p>
      )}

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Componentes, en el orden en que se leen</legend>
        <ul className="mt-2 space-y-2">
          {form.componentes.map((c, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <div className="w-40">
                <label htmlFor={`${idBase}-comp-${i}`} className="sr-only">
                  Componente {i + 1}
                </label>
                <select id={`${idBase}-comp-${i}`} value={c.componente} onChange={(e) => cambiarComponente(i, 'componente', e.target.value)} className={CLASE_INPUT}>
                  {!tipos.some((t) => t.codigo === c.componente) && <option value={c.componente}>{c.componente}</option>}
                  {tiposLibres(c.componente).map((t) => (
                    <option key={t.codigo} value={t.codigo}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 flex-1">
                <label htmlFor={`${idBase}-val-${i}`} className="sr-only">
                  Valor del componente {i + 1}
                </label>
                <input
                  id={`${idBase}-val-${i}`}
                  value={c.valor}
                  maxLength={20}
                  onChange={(e) => cambiarComponente(i, 'valor', e.target.value)}
                  className={`${CLASE_INPUT} uppercase`}
                />
              </div>
              <BotonIcono etiqueta="Subir componente" icono="bi-arrow-up" onClick={() => mover(i, -1)} disabled={i === 0} />
              <BotonIcono etiqueta="Bajar componente" icono="bi-arrow-down" onClick={() => mover(i, 1)} disabled={i === form.componentes.length - 1} />
              <BotonIcono etiqueta="Quitar componente" icono="bi-x-lg" onClick={() => cambiar('componentes', form.componentes.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={agregar}
          disabled={form.componentes.length >= Math.min(MAX_COMPONENTES, tipos.length)}
          className="mt-2 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
          Agregar componente
        </button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Campo label="Referencia" id={`${idBase}-ref`}>
            <input id={`${idBase}-ref`} value={form.referencia} maxLength={250} onChange={(e) => cambiar('referencia', e.target.value)} className={`${CLASE_INPUT} uppercase`} />
          </Campo>
        </div>
        <Campo label="Latitud" id={`${idBase}-lat`}>
          <input id={`${idBase}-lat`} value={form.latitud} inputMode="decimal" placeholder="-12.389" onChange={(e) => cambiar('latitud', e.target.value)} className={CLASE_INPUT} />
        </Campo>
        <Campo label="Longitud" id={`${idBase}-lon`}>
          <input id={`${idBase}-lon`} value={form.longitud} inputMode="decimal" placeholder="-76.779" onChange={(e) => cambiar('longitud', e.target.value)} className={CLASE_INPUT} />
        </Campo>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dirección literal</p>
        <p className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
          {previa || 'Se arma sola con la vía, los componentes y la habilitación.'}
        </p>
        {inicial && inicial._count.contribuyentes > 1 && (
          <p className="mt-1 text-xs text-amber-700">
            La usan {inicial._count.contribuyentes} personas: el cambio se verá en el domicilio de todas.
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="text-sm font-medium text-ladrillo">
          <p>{error}</p>
          {existente && alUsarExistente && (
            <button type="button" onClick={() => alUsarExistente(existente)} className="mt-1 font-semibold text-mar underline hover:text-mar-profundo">
              Usar la dirección ya registrada
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void guardar()}
          disabled={isSaving}
          className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {isSaving ? 'Guardando…' : inicial ? 'Guardar dirección' : 'Registrar dirección'}
        </button>
        {alCancelar && (
          <button type="button" onClick={alCancelar} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

const CLASE_INPUT =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa aria-[invalid=true]:border-ladrillo'

function Campo({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}

function BotonIcono({ etiqueta, icono, onClick, disabled }: { etiqueta: string; icono: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className="mb-0.5 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-30"
    >
      <i aria-hidden="true" className={`bi ${icono}`} />
    </button>
  )
}
