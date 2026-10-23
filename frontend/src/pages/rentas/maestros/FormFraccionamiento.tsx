import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError } from './maestrosApi'

// Límites del fraccionamiento del año (specs/rentas-valores-v1.md, decisión 2).

interface Parametros {
  cuotaInicialMinPct: string
  cuotasMax: number
  montoMinimo: string
  interesMensual: string
  ordenanza: string | null
}

const CAMPOS = [
  { key: 'cuotaInicialMinPct', label: 'Cuota inicial mínima (%)', step: '0.01' },
  { key: 'cuotasMax', label: 'Número máximo de cuotas', step: '1' },
  { key: 'montoMinimo', label: 'Deuda mínima para fraccionar (S/)', step: '0.01' },
  { key: 'interesMensual', label: 'Interés de fraccionamiento (% mensual)', step: '0.0001' },
] as const

type Clave = (typeof CAMPOS)[number]['key']
type Valores = Record<Clave, string>

const VACIO: Valores = { cuotaInicialMinPct: '', cuotasMax: '', montoMinimo: '', interesMensual: '' }

export function FormFraccionamiento({ anio }: { anio: number }) {
  const [valores, setValores] = useState<Valores>(VACIO)
  const [ordenanza, setOrdenanza] = useState('')
  const [existe, setExiste] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setIsLoading(true)
      setMensaje(null)
      try {
        const { data } = await api.get<{ parametros: Parametros | null }>(`/rentas/maestros/fraccionamiento/${anio}`)
        if (cancelled) return
        const p = data.parametros
        setExiste(p !== null)
        setValores(
          p
            ? {
                cuotaInicialMinPct: String(p.cuotaInicialMinPct),
                cuotasMax: String(p.cuotasMax),
                montoMinimo: String(p.montoMinimo),
                interesMensual: String(p.interesMensual),
              }
            : VACIO,
        )
        setOrdenanza(p?.ordenanza ?? '')
      } catch (err) {
        if (!cancelled) setMensaje({ ok: false, texto: mensajeError(err) })
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [anio])

  // Valida en cliente con los mismos límites del backend.
  function validar(): string | null {
    for (const c of CAMPOS) {
      const n = Number(valores[c.key])
      if (valores[c.key].trim() === '' || !Number.isFinite(n) || n < 0) return `Completa "${c.label}" con un número válido`
    }
    if (Number(valores.cuotaInicialMinPct) > 100) return 'La cuota inicial mínima es un porcentaje (0-100)'
    const cuotas = Number(valores.cuotasMax)
    if (!Number.isInteger(cuotas) || cuotas < 1 || cuotas > 120) return 'El número máximo de cuotas va de 1 a 120'
    if (Number(valores.interesMensual) > 100) return 'El interés es un porcentaje mensual (0-100)'
    return null
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const error = validar()
    if (error) {
      setMensaje({ ok: false, texto: error })
      return
    }
    setIsSaving(true)
    setMensaje(null)
    try {
      await api.put(`/rentas/maestros/fraccionamiento/${anio}`, {
        cuotaInicialMinPct: Number(valores.cuotaInicialMinPct),
        cuotasMax: Number(valores.cuotasMax),
        montoMinimo: Number(valores.montoMinimo),
        interesMensual: Number(valores.interesMensual),
        ordenanza: ordenanza.trim() || undefined,
      })
      setExiste(true)
      setMensaje({ ok: true, texto: 'Parámetros de fraccionamiento guardados.' })
    } catch (err) {
      setMensaje({ ok: false, texto: mensajeError(err) })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <p className="p-6 text-center text-sm text-slate-500" role="status">
        Cargando…
      </p>
    )
  }

  return (
    <form onSubmit={(e) => void guardar(e)} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <p className="text-sm text-slate-500 sm:col-span-2">
        Límites que exige la ordenanza para aprobar un convenio de fraccionamiento en {anio}.
        {!existe && ' Aún no registrados: sin ellos no se pueden aprobar convenios este año.'}
      </p>
      {CAMPOS.map((c) => (
        <div key={c.key}>
          <label htmlFor={`fra-${c.key}`} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            {c.label}
          </label>
          <input
            id={`fra-${c.key}`}
            type="number"
            inputMode="decimal"
            step={c.step}
            min="0"
            value={valores[c.key]}
            disabled={isSaving}
            onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100"
          />
        </div>
      ))}
      <div className="sm:col-span-2">
        <label htmlFor="fra-ordenanza" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Ordenanza
        </label>
        <input
          id="fra-ordenanza"
          value={ordenanza}
          maxLength={60}
          disabled={isSaving}
          onChange={(e) => setOrdenanza(e.target.value)}
          placeholder="Ej. O.M. N° 005-2026-MDSB"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100"
        />
      </div>
      <div className="sm:col-span-2">
        {mensaje && (
          <p role={mensaje.ok ? 'status' : 'alert'} className={`mb-3 text-sm font-medium ${mensaje.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {mensaje.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {isSaving ? 'Guardando…' : 'Guardar parámetros'}
        </button>
      </div>
    </form>
  )
}
