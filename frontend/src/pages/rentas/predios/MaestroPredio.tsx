import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { nombreDe, useCatalogo } from '../catalogos/catalogosApi'
import { mensajeError } from '../maestros/maestrosApi'
import { RUTA_DIRECCIONES } from '../direcciones/direccionesApi'
import { LADOS, type Lado, type PredioApi, type TipoPredio } from './tipos'

// Predio maestro (Fase 3): identificación (R01), datos de arbitrios (R02) y condición de los titulares
// (R05). La ubicación, el área y la construcción no se editan aquí: entran por la DJ.

const CLASE = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'

type Linderos = Record<Lado, { metros: string; colindante: string }>

interface Form {
  tipo: TipoPredio
  nombre: string
  latitud: string
  longitud: string
  linderos: Linderos
  frecuenciaBarrido: string
  ubicacionParque: string
  frontis: string
  condiciones: Record<number, string>
}

function desde(p: PredioApi): Form {
  const linderos = Object.fromEntries(
    LADOS.map((l) => [l, { metros: p[`lindero${l}Metros`] ?? '', colindante: p[`lindero${l}Colindante`] ?? '' }]),
  ) as Linderos
  return {
    tipo: p.tipo,
    nombre: p.nombre ?? '',
    latitud: p.latitud ?? '',
    longitud: p.longitud ?? '',
    linderos,
    frecuenciaBarrido: p.frecuenciaBarrido ?? '',
    ubicacionParque: p.ubicacionParque ?? '',
    frontis: p.frontis ?? '',
    condiciones: Object.fromEntries(p.contribuyentes.map((t) => [t.contribuyente.id, t.condicion ?? ''])),
  }
}

const numero = (v: string) => (v.trim() ? Number(v) : null)

function validar(f: Form): string | null {
  if (Boolean(f.latitud.trim()) !== Boolean(f.longitud.trim())) return 'Indica latitud y longitud, o ninguna.'
  if (f.latitud.trim() && (!Number.isFinite(Number(f.latitud)) || Math.abs(Number(f.latitud)) > 90)) return 'La latitud debe estar entre -90 y 90.'
  if (f.longitud.trim() && (!Number.isFinite(Number(f.longitud)) || Math.abs(Number(f.longitud)) > 180)) return 'La longitud debe estar entre -180 y 180.'
  for (const l of LADOS) {
    const m = f.linderos[l].metros.trim()
    if (m && !(Number(m) > 0)) return `El lindero ${l.toLowerCase()} debe medir más de 0 m.`
  }
  if (f.frontis.trim() && !(Number(f.frontis) >= 0)) return 'El frontis no puede ser negativo.'
  return null
}

export function MaestroPredio({ predio, editable, alCambiar }: { predio: PredioApi; editable: boolean; alCambiar: () => void }) {
  const frecuencias = useCatalogo('FRECUENCIA_BARRIDO')
  const parques = useCatalogo('UBICACION_PARQUE')
  const condiciones = useCatalogo('CONDICION_PROPIEDAD')
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    if (!form) return
    const e = validar(form)
    if (e) {
      setError(e)
      return
    }
    setOcupado(true)
    setError(null)
    const linderos = Object.fromEntries(
      LADOS.flatMap((l) => [
        [`lindero${l}Metros`, numero(form.linderos[l].metros)],
        [`lindero${l}Colindante`, form.linderos[l].colindante.trim() || null],
      ]),
    )
    try {
      await api.patch(`/predios/${predio.id}/maestro`, {
        tipo: form.tipo,
        nombre: form.nombre.trim() || null,
        latitud: numero(form.latitud),
        longitud: numero(form.longitud),
        ...linderos,
        frecuenciaBarrido: form.frecuenciaBarrido || null,
        ubicacionParque: form.ubicacionParque || null,
        frontis: numero(form.frontis),
        titulares: Object.entries(form.condiciones)
          .filter(([, c]) => c)
          .map(([id, condicion]) => ({ contribuyenteId: Number(id), condicion })),
      })
      setForm(null)
      alCambiar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  if (!form) {
    const lindero = (l: Lado) => {
      const m = predio[`lindero${l}Metros`]
      const c = predio[`lindero${l}Colindante`]
      return [m ? `${Number(m)} m` : null, c].filter(Boolean).join(' · ') || '—'
    }
    return (
      <div className="p-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Dato etiqueta="Tipo" valor={predio.tipo === 'RUSTICO' ? 'Rústico' : 'Urbano'} />
          <Dato etiqueta="Nombre" valor={predio.nombre ?? '—'} />
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dirección única</dt>
            <dd className="mt-0.5 text-slate-800">
              {predio.direccion ? (
                <Link to={`${RUTA_DIRECCIONES}/${predio.direccion.id}`} className="text-mar hover:underline">
                  {predio.direccion.direccion}
                </Link>
              ) : (
                'Sin dirección: se asigna en la próxima DJ'
              )}
            </dd>
          </div>
          {LADOS.map((l) => (
            <Dato key={l} etiqueta={`Lindero ${l.toLowerCase()}`} valor={lindero(l)} />
          ))}
          <Dato etiqueta="Coordenadas" valor={predio.latitud && predio.longitud ? `${predio.latitud}, ${predio.longitud}` : '—'} />
          <Dato etiqueta="Frecuencia de barrido" valor={predio.frecuenciaBarrido ? nombreDe(frecuencias, predio.frecuenciaBarrido) : '—'} />
          <Dato etiqueta="Ubicación respecto a parques" valor={predio.ubicacionParque ? nombreDe(parques, predio.ubicacionParque) : '—'} />
          <Dato etiqueta="Frontis" valor={predio.frontis ? `${Number(predio.frontis)} m` : '—'} />
        </dl>
        {editable && (
          <button
            type="button"
            onClick={() => setForm(desde(predio))}
            className="mt-4 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-pencil mr-1" />
            Editar datos del predio
          </button>
        )}
      </div>
    )
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const setLindero = (l: Lado, k: 'metros' | 'colindante', v: string) =>
    setForm((f) => (f ? { ...f, linderos: { ...f.linderos, [l]: { ...f.linderos[l], [k]: v } } } : f))

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Tipo</span>
          <select value={form.tipo} onChange={(e) => set('tipo', e.target.value as TipoPredio)} className={CLASE}>
            <option value="URBANO">Urbano</option>
            <option value="RUSTICO">Rústico</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre del predio (opcional)</span>
          <input value={form.nombre} maxLength={120} onChange={(e) => set('nombre', e.target.value)} className={`${CLASE} uppercase`} />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Linderos</legend>
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          {LADOS.map((l) => (
            <div key={l} className="flex gap-2">
              <label className="w-28 text-sm">
                <span className="block text-xs text-slate-500">{l} (m)</span>
                <input value={form.linderos[l].metros} inputMode="decimal" onChange={(e) => setLindero(l, 'metros', e.target.value.replace(/[^\d.]/g, ''))} className={CLASE} />
              </label>
              <label className="min-w-0 flex-1 text-sm">
                <span className="block text-xs text-slate-500">Colinda con</span>
                <input value={form.linderos[l].colindante} maxLength={120} onChange={(e) => setLindero(l, 'colindante', e.target.value)} className={`${CLASE} uppercase`} />
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Latitud</span>
          <input value={form.latitud} inputMode="decimal" placeholder="-12.389" onChange={(e) => set('latitud', e.target.value)} className={CLASE} />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Longitud</span>
          <input value={form.longitud} inputMode="decimal" placeholder="-76.779" onChange={(e) => set('longitud', e.target.value)} className={CLASE} />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Frecuencia de barrido</span>
          <Select items={frecuencias} value={form.frecuenciaBarrido} onChange={(v) => set('frecuenciaBarrido', v)} />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Ubicación respecto a parques</span>
          <Select items={parques} value={form.ubicacionParque} onChange={(v) => set('ubicacionParque', v)} />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Frontis (m)</span>
          <input value={form.frontis} inputMode="decimal" onChange={(e) => set('frontis', e.target.value.replace(/[^\d.]/g, ''))} className={CLASE} />
        </label>
      </div>

      {predio.contribuyentes.length > 0 && (
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Condición de propiedad de los titulares</legend>
          <ul className="mt-1 space-y-2">
            {predio.contribuyentes.map((t) => (
              <li key={t.contribuyente.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-0 flex-1">{t.contribuyente.nombreCompleto}</span>
                <span className="w-64">
                  <Select
                    etiqueta={`Condición de ${t.contribuyente.nombreCompleto}`}
                    items={condiciones}
                    value={form.condiciones[t.contribuyente.id] ?? ''}
                    onChange={(v) => setForm((f) => (f ? { ...f, condiciones: { ...f.condiciones, [t.contribuyente.id]: v } } : f))}
                  />
                </span>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-ladrillo">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void guardar()}
          className="rounded-md bg-mar-profundo px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {ocupado ? 'Guardando…' : 'Guardar datos'}
        </button>
        <button type="button" onClick={() => setForm(null)} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function Select({ items, value, onChange, etiqueta }: { items: { codigo: string; nombre: string }[]; value: string; onChange: (v: string) => void; etiqueta?: string }) {
  const falta = value && !items.some((i) => i.codigo === value)
  return (
    <select aria-label={etiqueta} value={value} onChange={(e) => onChange(e.target.value)} className={CLASE}>
      <option value="">—</option>
      {falta && <option value={value}>{value}</option>}
      {items.map((i) => (
        <option key={i.codigo} value={i.codigo}>
          {i.nombre}
        </option>
      ))}
    </select>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-slate-800">{valor}</dd>
    </div>
  )
}
