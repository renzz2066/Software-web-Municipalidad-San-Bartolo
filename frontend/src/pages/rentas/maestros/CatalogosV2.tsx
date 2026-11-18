import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import {
  olvidarCatalogo,
  type Atributos,
  type DefGrupo,
  type GrupoCatalogo,
  type ItemCatalogo,
  type ReglaMuni,
} from '../catalogos/catalogosApi'
import { mensajeError } from './maestrosApi'

// Catálogos con código y reglas de la muni (specs/rentas-nucleo-v2.md, Fase 0).
// Se siembran con el valor nacional; cada muni los ajusta. El código no se edita y los ítems
// que usa el sistema se pueden renombrar, no desactivar. Sin borrado: se desactiva.

const CLASE = 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const BOTON =
  'rounded-md bg-mar-profundo px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'
const BOTON_SECUNDARIO =
  'rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40'

interface Form {
  codigo: string
  nombre: string
  abreviatura: string
  padreId: string
  orden: string
  ordenanza: string
  activo: boolean
  atributos: Record<string, string | boolean>
}

const formVacio = (): Form => ({ codigo: '', nombre: '', abreviatura: '', padreId: '', orden: '', ordenanza: '', activo: true, atributos: {} })

export function CatalogosV2() {
  const [grupos, setGrupos] = useState<DefGrupo[]>([])
  const [grupo, setGrupo] = useState<GrupoCatalogo>('MOTIVO_DJ')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<DefGrupo[]>('/catalogos/grupos')
      .then((r) => setGrupos(r.data))
      .catch((err) => setError(mensajeError(err)))
  }, [])

  const def = grupos.find((g) => g.grupo === grupo)

  return (
    <div className="space-y-10">
      <section aria-labelledby="titulo-catalogos" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titulo-catalogos" className="font-semibold text-mar-profundo">
              Catálogos de Rentas
            </h2>
            <p className="text-sm text-slate-600">Nacen con el valor nacional; ajústalos a la ordenanza de la muni.</p>
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Catálogo</span>
            <select value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoCatalogo)} className={`${CLASE} min-w-72`}>
              {grupos.map((g) => (
                <option key={g.grupo} value={g.grupo}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-ladrillo">
            {error}
          </p>
        )}
        {def && <TablaCatalogo key={def.grupo} def={def} grupos={grupos} />}
      </section>
      <ReglasMuni />
    </div>
  )
}

function TablaCatalogo({ def, grupos }: { def: DefGrupo; grupos: DefGrupo[] }) {
  const [items, setItems] = useState<ItemCatalogo[]>([])
  const [padres, setPadres] = useState<ItemCatalogo[]>([])
  const [editando, setEditando] = useState<ItemCatalogo | 'nuevo' | null>(null)
  const [form, setForm] = useState<Form>(formVacio)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const atributos = Object.entries(def.atributos)
  const nombrePadre = def.padre ? grupos.find((g) => g.grupo === def.padre)?.nombre : null

  useEffect(() => {
    let vivo = true
    Promise.all([
      api.get<ItemCatalogo[]>('/catalogos', { params: { grupo: def.grupo, incluirInactivos: 'true' } }),
      def.padre ? api.get<ItemCatalogo[]>('/catalogos', { params: { grupo: def.padre } }) : Promise.resolve({ data: [] }),
    ])
      .then(([a, b]) => {
        if (!vivo) return
        setItems(a.data)
        setPadres(b.data)
      })
      .catch((err) => vivo && setError(mensajeError(err)))
      .finally(() => vivo && setIsLoading(false))
    return () => {
      vivo = false
    }
  }, [def.grupo, def.padre, refresh])

  function editar(item: ItemCatalogo | null) {
    setError(null)
    setEditando(item ?? 'nuevo')
    setForm(
      item
        ? {
            codigo: item.codigo,
            nombre: item.nombre,
            abreviatura: item.abreviatura ?? '',
            padreId: item.padreId ? String(item.padreId) : '',
            orden: String(item.orden),
            ordenanza: item.ordenanza ?? '',
            activo: item.activo,
            atributos: Object.fromEntries(Object.entries(item.atributos ?? {}).map(([k, v]) => [k, typeof v === 'boolean' ? v : String(v)])),
          }
        : formVacio(),
    )
  }

  function cuerpo() {
    const attrs: Atributos = {}
    for (const [clave, a] of atributos) {
      const v = form.atributos[clave]
      if (a.tipo === 'booleano') {
        if (v === true) attrs[clave] = true
      } else if (typeof v === 'string' && v.trim()) {
        attrs[clave] = a.tipo === 'numero' ? Number(v) : v.trim()
      }
    }
    return {
      nombre: form.nombre.trim(),
      abreviatura: form.abreviatura.trim() || null,
      padreId: form.padreId ? Number(form.padreId) : null,
      ...(form.orden.trim() ? { orden: Number(form.orden) } : {}),
      ordenanza: form.ordenanza.trim() || null,
      activo: form.activo,
      atributos: attrs,
    }
  }

  async function guardar() {
    if (editando === 'nuevo' && !/^[A-Z0-9_]{1,20}$/.test(form.codigo)) {
      setError('El código tiene hasta 20 caracteres: mayúsculas, números o _')
      return
    }
    if (!form.nombre.trim()) {
      setError('Completa el nombre')
      return
    }
    if (def.abreviatura === 'requerida' && !form.abreviatura.trim()) {
      setError('Completa la abreviatura')
      return
    }
    if (def.padre && !form.padreId) {
      setError(`Elige de qué ítem de "${nombrePadre}" depende`)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      if (editando === 'nuevo') await api.post('/catalogos', { grupo: def.grupo, codigo: form.codigo, ...cuerpo() })
      else if (editando) await api.patch(`/catalogos/${editando.id}`, cuerpo())
      olvidarCatalogo(def.grupo)
      setEditando(null)
      setIsLoading(true)
      setRefresh((k) => k + 1)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsSaving(false)
    }
  }

  const sistema = editando !== null && editando !== 'nuevo' && editando.sistema

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Reglas: <span className="font-medium">{def.reglas}</span>
          {nombrePadre && <> · Cada ítem depende de un ítem de “{nombrePadre}”.</>}
        </p>
        <button type="button" onClick={() => editar(null)} disabled={editando !== null} className={BOTON_SECUNDARIO}>
          <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
          Agregar ítem
        </button>
      </div>

      {editando && (
        <div className="grid gap-3 rounded-md bg-mar/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Código" ayuda={editando === 'nuevo' ? 'No se podrá cambiar' : 'No se edita'}>
            <input
              value={form.codigo}
              disabled={editando !== 'nuevo'}
              maxLength={20}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
              className={`${CLASE} uppercase disabled:bg-slate-100`}
            />
          </Campo>
          <Campo etiqueta="Nombre">
            <input value={form.nombre} maxLength={120} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className={CLASE} />
          </Campo>
          {def.abreviatura && (
            <Campo etiqueta={`Abreviatura${def.abreviatura === 'requerida' ? '' : ' (opcional)'}`}>
              <input value={form.abreviatura} maxLength={20} onChange={(e) => setForm((f) => ({ ...f, abreviatura: e.target.value }))} className={CLASE} />
            </Campo>
          )}
          {def.padre && (
            <Campo etiqueta={`Depende de (${nombrePadre})`}>
              <select value={form.padreId} onChange={(e) => setForm((f) => ({ ...f, padreId: e.target.value }))} className={CLASE}>
                <option value="">Elige…</option>
                {padres.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {atributos.map(([clave, a]) => (
            <Campo key={clave} etiqueta={a.etiqueta}>
              {a.tipo === 'booleano' ? (
                <input
                  type="checkbox"
                  checked={form.atributos[clave] === true}
                  onChange={(e) => setForm((f) => ({ ...f, atributos: { ...f.atributos, [clave]: e.target.checked } }))}
                  className="h-4 w-4 accent-mar-profundo"
                />
              ) : a.tipo === 'opcion' ? (
                <select
                  value={String(form.atributos[clave] ?? '')}
                  onChange={(e) => setForm((f) => ({ ...f, atributos: { ...f.atributos, [clave]: e.target.value } }))}
                  className={CLASE}
                >
                  <option value="">{a.requerido ? 'Elige…' : '—'}</option>
                  {a.opciones.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={a.tipo === 'numero' ? 'number' : 'text'}
                  inputMode={a.tipo === 'numero' ? 'decimal' : undefined}
                  value={String(form.atributos[clave] ?? '')}
                  maxLength={a.tipo === 'texto' ? a.max : undefined}
                  onChange={(e) => setForm((f) => ({ ...f, atributos: { ...f.atributos, [clave]: e.target.value } }))}
                  className={CLASE}
                />
              )}
            </Campo>
          ))}
          <Campo etiqueta="Orden">
            <input type="number" min={0} value={form.orden} onChange={(e) => setForm((f) => ({ ...f, orden: e.target.value }))} className={CLASE} />
          </Campo>
          <Campo etiqueta="Ordenanza (opcional)">
            <input value={form.ordenanza} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, ordenanza: e.target.value }))} className={CLASE} />
          </Campo>
          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              checked={form.activo}
              disabled={sistema}
              onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              className="h-4 w-4 accent-mar-profundo"
            />
            Activo {sistema && <span className="text-xs text-slate-500">(lo usa el sistema)</span>}
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button type="button" onClick={() => void guardar()} disabled={isSaving} className={BOTON}>
              {isSaving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-ladrillo">
          {error}
        </p>
      )}

      {isLoading ? (
        <p role="status" className="text-sm text-slate-500">
          Cargando…
        </p>
      ) : (
        <div className="max-h-[28rem] overflow-auto rounded-md ring-1 ring-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-2 py-2">Código</th>
                <th scope="col" className="px-2 py-2">Nombre</th>
                {def.abreviatura && <th scope="col" className="px-2 py-2">Abrev.</th>}
                {def.padre && <th scope="col" className="px-2 py-2">Depende de</th>}
                {atributos.map(([clave, a]) => (
                  <th key={clave} scope="col" className="px-2 py-2">
                    {a.etiqueta}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 text-right">Orden</th>
                <th scope="col" className="px-2 py-2 text-center">Activo</th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6 + atributos.length} className="px-2 py-4 text-center text-slate-500">
                    Sin ítems. Agrega el primero.
                  </td>
                </tr>
              )}
              {items.map((i) => (
                <tr key={i.id} className={`border-b border-slate-100 ${i.activo ? '' : 'text-slate-400'}`}>
                  <td className="px-2 py-2 font-mono text-xs">
                    {i.codigo}
                    {i.sistema && (
                      <i aria-label="Lo usa el sistema" title="Lo usa el sistema" className="bi bi-lock ml-1 text-slate-400" />
                    )}
                  </td>
                  <td className="px-2 py-2">{i.nombre}</td>
                  {def.abreviatura && <td className="px-2 py-2">{i.abreviatura ?? '—'}</td>}
                  {def.padre && <td className="px-2 py-2">{i.padre?.nombre ?? '—'}</td>}
                  {atributos.map(([clave]) => (
                    <td key={clave} className="px-2 py-2">
                      {formatoAtributo(i.atributos?.[clave])}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums">{i.orden}</td>
                  <td className="px-2 py-2 text-center">
                    {i.activo ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">Sí</span>
                    ) : (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500">No</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => editar(i)}
                      disabled={editando !== null}
                      aria-label={`Editar ${i.nombre}`}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-mar/10 hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                    >
                      <i aria-hidden="true" className="bi bi-pencil" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6 + atributos.length} className="px-2 py-2 text-xs text-slate-500">
                  {items.length} ítems · {items.filter((i) => i.activo).length} activos
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function formatoAtributo(v: unknown): string {
  if (v === undefined || v === null) return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  return String(v)
}

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-0.5 block text-xs text-slate-500">{ayuda}</span>}
    </label>
  )
}

// ---- Reglas de la muni (ReglaMuni) ----

const ETIQUETAS_OPCION: Record<string, string> = {
  MES_DEL_HECHO: 'El mismo mes del hecho',
  MES_SIGUIENTE: 'El mes siguiente al hecho',
}

// Agrupaciones de meses habituales para las cuotas de arbitrios (L07).
const PRESETS_CUOTAS: { cuotas: number; etiqueta: string }[] = [
  { cuotas: 1, etiqueta: '1 cuota anual' },
  { cuotas: 2, etiqueta: '2 cuotas semestrales' },
  { cuotas: 3, etiqueta: '3 cuotas cuatrimestrales' },
  { cuotas: 4, etiqueta: '4 cuotas trimestrales' },
  { cuotas: 6, etiqueta: '6 cuotas bimestrales' },
  { cuotas: 12, etiqueta: '12 cuotas mensuales' },
]

function agrupar(cuotas: number): number[][] {
  const tam = 12 / cuotas
  return Array.from({ length: cuotas }, (_, i) => Array.from({ length: tam }, (_, j) => i * tam + j + 1))
}

function ReglasMuni() {
  const [reglas, setReglas] = useState<ReglaMuni[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    api
      .get<ReglaMuni[]>('/catalogos/reglas')
      .then((r) => setReglas(r.data))
      .catch((err) => setError(mensajeError(err)))
  }, [refresh])

  return (
    <section aria-labelledby="titulo-reglas" className="space-y-4">
      <div>
        <h2 id="titulo-reglas" className="font-semibold text-mar-profundo">
          Reglas de la municipalidad
        </h2>
        <p className="text-sm text-slate-600">Lo que fija la ordenanza de esta muni y no es un catálogo. Indica la ordenanza que lo respalda.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-ladrillo">
          {error}
        </p>
      )}
      <ul className="divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
        {reglas.map((r) => (
          <li key={r.clave} className="p-4">
            <EditorRegla regla={r} alGuardar={() => setRefresh((k) => k + 1)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function EditorRegla({ regla, alGuardar }: { regla: ReglaMuni; alGuardar: () => void }) {
  const [valor, setValor] = useState<unknown>(regla.valor)
  const [ordenanza, setOrdenanza] = useState(regla.ordenanza ?? '')
  const [opciones, setOpciones] = useState<ItemCatalogo[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const grupoCodigos = regla.def.tipo === 'codigos' ? regla.def.grupo : null

  useEffect(() => {
    if (!grupoCodigos) return
    api
      .get<ItemCatalogo[]>('/catalogos', { params: { grupo: grupoCodigos } })
      .then((r) => setOpciones(r.data))
      .catch(() => setOpciones([]))
  }, [grupoCodigos])

  const cambiado = useMemo(
    () => JSON.stringify(valor) !== JSON.stringify(regla.valor) || ordenanza.trim() !== (regla.ordenanza ?? ''),
    [valor, ordenanza, regla],
  )

  async function guardar() {
    setIsSaving(true)
    setMensaje(null)
    try {
      await api.put(`/catalogos/reglas/${encodeURIComponent(regla.clave)}`, { valor, ordenanza: ordenanza.trim() || null })
      setMensaje({ ok: true, texto: 'Regla guardada' })
      alGuardar()
    } catch (err) {
      setMensaje({ ok: false, texto: mensajeError(err) })
    } finally {
      setIsSaving(false)
    }
  }

  const idBase = `regla-${regla.clave.replace(/\W/g, '-')}`
  const cuotas = Array.isArray(valor) ? (valor as number[][]) : []
  const preset = PRESETS_CUOTAS.find((p) => JSON.stringify(agrupar(p.cuotas)) === JSON.stringify(cuotas))

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_minmax(16rem,22rem)_14rem_auto] lg:items-end">
      <div>
        <p className="text-sm font-medium text-slate-800">
          {regla.descripcion} <span className="text-xs font-normal text-slate-500">({regla.regla})</span>
        </p>
        {!regla.guardada && <p className="text-xs text-slate-500">Valor nacional por defecto.</p>}
      </div>
      <div>
        {regla.def.tipo === 'codigos' && (
          <fieldset>
            <legend className="sr-only">{regla.descripcion}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {opciones.map((o) => {
                const lista = Array.isArray(valor) ? (valor as string[]) : []
                return (
                  <label key={o.codigo} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={lista.includes(o.codigo)}
                      onChange={(e) => setValor(e.target.checked ? [...lista, o.codigo] : lista.filter((c) => c !== o.codigo))}
                      className="h-4 w-4 accent-mar-profundo"
                    />
                    {o.nombre}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}
        {regla.def.tipo === 'opcion' && (
          <select aria-label={regla.descripcion} value={String(valor)} onChange={(e) => setValor(e.target.value)} className={CLASE}>
            {regla.def.opciones.map((o) => (
              <option key={o} value={o}>
                {ETIQUETAS_OPCION[o] ?? o}
              </option>
            ))}
          </select>
        )}
        {regla.def.tipo === 'booleano' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={valor === true} onChange={(e) => setValor(e.target.checked)} className="h-4 w-4 accent-mar-profundo" />
            Permitido
          </label>
        )}
        {regla.def.tipo === 'ubigeo' && (
          <input
            aria-label={regla.descripcion}
            value={typeof valor === 'string' ? valor : ''}
            maxLength={6}
            inputMode="numeric"
            placeholder="150129"
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ''))}
            className={CLASE}
          />
        )}
        {regla.def.tipo === 'cuotas' && (
          <select
            aria-label={regla.descripcion}
            value={preset ? String(preset.cuotas) : ''}
            onChange={(e) => setValor(agrupar(Number(e.target.value)))}
            className={CLASE}
          >
            {!preset && <option value="">Personalizada ({cuotas.length} cuotas)</option>}
            {PRESETS_CUOTAS.map((p) => (
              <option key={p.cuotas} value={p.cuotas}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        )}
      </div>
      <label className="block text-sm" htmlFor={`${idBase}-ord`}>
        <span className="mb-1 block text-xs font-medium text-slate-600">Ordenanza</span>
        <input id={`${idBase}-ord`} value={ordenanza} maxLength={60} onChange={(e) => setOrdenanza(e.target.value)} className={CLASE} />
      </label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void guardar()} disabled={!cambiado || isSaving} className={BOTON}>
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
        {mensaje && (
          <span role={mensaje.ok ? 'status' : 'alert'} className={`text-xs font-medium ${mensaje.ok ? 'text-emerald-700' : 'text-ladrillo'}`}>
            {mensaje.texto}
          </span>
        )}
      </div>
    </div>
  )
}
