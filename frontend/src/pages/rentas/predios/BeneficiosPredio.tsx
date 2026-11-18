import { useState } from 'react'
import { api } from '../../../lib/api'
import { nombreDe, useCatalogo } from '../catalogos/catalogosApi'
import { mensajeError } from '../maestros/maestrosApi'
import type { BeneficioPredio } from './tipos'

// Inafectación o exoneración del predio (R06), por resolución. Un predio inafecto exige que sus
// titulares sean inafectos (lo valida el backend). Se aplica al determinar (Fase 5). Se revoca, no se borra.

const CLASE = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ANIO = new Date().getFullYear()
const REGIMENES = ['INAFECTACION', 'EXONERACION']

interface Nuevo {
  codigo: string
  porcentaje: string
  resolucion: string
  fechaResolucion: string
  expediente: string
  baseLegal: string
  anioDesde: string
  anioHasta: string
}

const VACIO: Nuevo = { codigo: '', porcentaje: '', resolucion: '', fechaResolucion: '', expediente: '', baseLegal: '', anioDesde: String(ANIO), anioHasta: '' }

export function BeneficiosPredio({
  predioId,
  beneficios,
  editable,
  alCambiar,
}: {
  predioId: number
  beneficios: BeneficioPredio[]
  editable: boolean
  alCambiar: () => void
}) {
  const todos = useCatalogo('BENEFICIO')
  const catalogo = todos.filter((i) => REGIMENES.includes(String(i.atributos?.regimen ?? '')))
  const [nuevo, setNuevo] = useState<Nuevo | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const elegido = catalogo.find((i) => i.codigo === nuevo?.codigo)
  const inafectacion = elegido?.atributos?.regimen === 'INAFECTACION'

  async function registrar() {
    if (!nuevo) return
    if (!nuevo.codigo || !nuevo.resolucion.trim() || !nuevo.fechaResolucion || !nuevo.anioDesde) {
      setError('Completa el beneficio, la resolución, su fecha y el año desde el que aplica')
      return
    }
    if (!inafectacion && !nuevo.porcentaje && elegido?.atributos?.porcentaje == null) {
      setError('Indica el porcentaje de la exoneración')
      return
    }
    setOcupado(true)
    setError(null)
    try {
      await api.post(`/predios/${predioId}/beneficios`, {
        codigo: nuevo.codigo,
        porcentaje: !inafectacion && nuevo.porcentaje ? Number(nuevo.porcentaje) : null,
        resolucion: nuevo.resolucion.trim(),
        fechaResolucion: nuevo.fechaResolucion,
        expediente: nuevo.expediente.trim() || null,
        baseLegal: nuevo.baseLegal.trim() || null,
        anioDesde: Number(nuevo.anioDesde),
        anioHasta: nuevo.anioHasta ? Number(nuevo.anioHasta) : null,
      })
      setNuevo(null)
      alCambiar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function revocar(b: BeneficioPredio) {
    const observacion = window.prompt(`Motivo para revocar la resolución ${b.resolucion}:`)
    if (!observacion?.trim()) return
    setOcupado(true)
    setError(null)
    try {
      await api.patch(`/predios/${predioId}/beneficios/${b.id}/revocar`, { observacion: observacion.trim() })
      alCambiar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  const campo = (k: keyof Nuevo, v: string) => setNuevo((n) => (n ? { ...n, [k]: v } : n))
  const base = elegido?.atributos?.baseLegal

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Inafectación o exoneración reconocida por resolución. Un predio inafecto exige titulares inafectos.</p>
        {editable && !nuevo && (
          <button
            type="button"
            onClick={() => setNuevo(VACIO)}
            className="rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
            Registrar resolución
          </button>
        )}
      </div>

      {nuevo && (
        <div className="grid gap-3 rounded-md bg-mar/5 p-4 sm:grid-cols-3">
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Beneficio</span>
            <select value={nuevo.codigo} onChange={(e) => campo('codigo', e.target.value)} className={CLASE}>
              <option value="">Elige…</option>
              {catalogo.map((i) => (
                <option key={i.codigo} value={i.codigo}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </label>
          {inafectacion ? (
            <p className="self-end pb-2 text-xs text-slate-500">Inafectación: 100%.</p>
          ) : (
            <Campo
              etiqueta={`% de exoneración${elegido?.atributos?.porcentaje != null ? ` (por defecto ${String(elegido.atributos.porcentaje)})` : ''}`}
              valor={nuevo.porcentaje}
              max={6}
              decimal
              onChange={(v) => campo('porcentaje', v)}
            />
          )}
          <Campo etiqueta="N° de resolución" valor={nuevo.resolucion} max={40} onChange={(v) => campo('resolucion', v)} />
          <label className="text-sm">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Fecha de la resolución</span>
            <input type="date" value={nuevo.fechaResolucion} onChange={(e) => campo('fechaResolucion', e.target.value)} className={CLASE} />
          </label>
          <Campo etiqueta="Expediente (opcional)" valor={nuevo.expediente} max={30} onChange={(v) => campo('expediente', v)} />
          <Campo etiqueta="Desde el año" valor={nuevo.anioDesde} max={4} numerico onChange={(v) => campo('anioDesde', v)} />
          <Campo etiqueta="Hasta el año (opcional)" valor={nuevo.anioHasta} max={4} numerico onChange={(v) => campo('anioHasta', v)} />
          <Campo etiqueta={`Base legal${base ? ` (por defecto: ${String(base)})` : ''}`} valor={nuevo.baseLegal} max={150} onChange={(v) => campo('baseLegal', v)} />
          <div className="flex gap-2 sm:col-span-3">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void registrar()}
              className="rounded-md bg-mar-profundo px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
            >
              {ocupado ? 'Guardando…' : 'Registrar'}
            </button>
            <button type="button" onClick={() => setNuevo(null)} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
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

      {beneficios.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Sin resoluciones registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-3 py-2">Beneficio</th>
                <th scope="col" className="px-3 py-2 text-right">%</th>
                <th scope="col" className="px-3 py-2">Resolución</th>
                <th scope="col" className="px-3 py-2">Años</th>
                <th scope="col" className="px-3 py-2">Estado</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {beneficios.map((b) => (
                <tr key={b.id} className={`border-b border-slate-100 ${b.vigente ? '' : 'text-slate-400'}`}>
                  <td className="px-3 py-2">
                    {nombreDe(todos, b.codigo)}
                    <span className="block text-xs text-slate-500">{b.baseLegal}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(b.porcentaje)}</td>
                  <td className="px-3 py-2">
                    {b.resolucion} · {b.fechaResolucion.slice(0, 10)}
                    {b.expediente && <span className="block text-xs text-slate-500">Exp. {b.expediente}</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {b.anioDesde}–{b.anioHasta ?? '…'}
                  </td>
                  <td className="px-3 py-2">
                    {b.vigente ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">Vigente</span>
                    ) : (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500" title={b.observacion ?? undefined}>
                        Revocada
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editable && b.vigente && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void revocar(b)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-ladrillo hover:bg-ladrillo/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                      >
                        Revocar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Campo({
  etiqueta,
  valor,
  max,
  numerico,
  decimal,
  onChange,
}: {
  etiqueta: string
  valor: string
  max: number
  numerico?: boolean
  decimal?: boolean
  onChange: (v: string) => void
}) {
  return (
    <label className="text-sm">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{etiqueta}</span>
      <input
        value={valor}
        maxLength={max}
        inputMode={numerico ? 'numeric' : decimal ? 'decimal' : undefined}
        onChange={(e) => onChange(numerico ? e.target.value.replace(/\D/g, '') : decimal ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)}
        className={CLASE}
      />
    </label>
  )
}
