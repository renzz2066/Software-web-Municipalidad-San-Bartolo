import { useEffect, useState } from 'react'
import Decimal from 'decimal.js'
import { api } from '../../../lib/api'
import { mensajeUtilidad } from '../utilitariosApi'
import { AnioCampo, AvisoSeccion } from '../utilitariosUi'

// U1: UIT ↔ soles y fracciones (specs/utilitarios-v1.md). Fuente: GET /rentas/maestros/resumen/:anio.

const FRACCIONES: { num: number; den: number; etiqueta: string }[] = [
  { num: 1, den: 12, etiqueta: '1/12' },
  { num: 1, den: 6, etiqueta: '1/6' },
  { num: 1, den: 4, etiqueta: '1/4' },
  { num: 1, den: 3, etiqueta: '1/3' },
  { num: 1, den: 2, etiqueta: '1/2' },
  { num: 1, den: 1, etiqueta: '1 UIT' },
  { num: 2, den: 1, etiqueta: '2 UIT' },
  { num: 3, den: 1, etiqueta: '3 UIT' },
]

interface Resumen {
  anio: number
  uit: { valor: string; derechoEmision: string; ordenanza: string | null } | null
}

const fmt = (d: Decimal, casas: number) =>
  Number(d.toFixed(casas)).toLocaleString('es-PE', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export function UIT() {
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modo, setModo] = useState<'soles' | 'uit'>('soles')
  const [monto, setMonto] = useState('')

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setError(null)
      setResumen(null)
      try {
        const { data } = await api.get<Resumen>(`/rentas/maestros/resumen/${anio}`)
        if (!cancelled) setResumen(data)
      } catch (err) {
        if (!cancelled) setError(mensajeUtilidad(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [anio])

  const valor = monto.trim().replace(',', '.')
  const numero = valor === '' ? null : Number(valor)
  const montoValido = numero !== null && Number.isFinite(numero) && numero >= 0
  const uit = resumen?.uit ? new Decimal(resumen.uit.valor) : null

  const enSoles = modo === 'soles' ? (montoValido ? new Decimal(valor) : null) : null
  const enUit = modo === 'uit' ? (montoValido ? new Decimal(valor) : null) : null
  const convertido =
    uit && montoValido ? (modo === 'soles' ? enSoles!.div(uit) : enUit!.times(uit)) : null

  const umbral = uit ? uit.div(4) : null

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="flex flex-wrap items-end gap-4">
          <AnioCampo id="uit-anio" valor={anio} alCambiar={setAnio} />
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Convertir de</legend>
            <div className="mt-1 flex gap-4">
              {(['soles', 'uit'] as const).map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="uit-modo"
                    value={m}
                    checked={modo === m}
                    onChange={() => setModo(m)}
                    className="accent-mar"
                  />
                  {m === 'soles' ? 'Soles' : 'UIT'}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <label htmlFor="uit-monto" className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          {modo === 'soles' ? 'Monto en soles' : 'Monto en UIT'}
        </label>
        <input
          id="uit-monto"
          type="text"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder={modo === 'soles' ? 'Ej. 12500.50' : 'Ej. 3.5'}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
        />
        {monto !== '' && !montoValido && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">
            Escribe un número mayor o igual a 0.
          </p>
        )}

        <div className="mt-4">
          {error ? (
            <AvisoSeccion mensaje={error} />
          ) : !resumen ? (
            <p role="status" className="text-sm text-slate-500">
              Cargando UIT…
            </p>
          ) : !uit ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              El año {resumen.anio} no tiene UIT registrada en Maestros.
            </p>
          ) : (
            <div className="rounded-md bg-mar/5 px-3 py-3">
              <p className="text-xs uppercase tracking-wider text-slate-500">UIT {resumen.anio}</p>
              <p className="mt-1 text-2xl font-bold text-mar-profundo">S/ {fmt(uit, 2)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Derecho de emisión: S/ {fmt(new Decimal(resumen.uit?.derechoEmision ?? 0), 2)} ·{' '}
                {resumen.uit?.ordenanza ?? 'sin ordenanza'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        {convertido && montoValido && (
          <>
            <p className="rounded-md bg-mar/10 px-3 py-3 text-base font-semibold text-mar-profundo">
              {modo === 'soles'
                ? `S/ ${fmt(enSoles!, 2)} = ${fmt(convertido, 4)} UIT`
                : `${fmt(enUit!, 4)} UIT = S/ ${fmt(convertido, 2)}`}
            </p>
            {umbral && modo === 'soles' && (
              <p className="mt-2 text-sm text-slate-600">
                {enSoles!.gt(umbral)
                  ? `Supera 1/4 UIT (S/ ${fmt(umbral, 2)}).`
                  : `No alcanza 1/4 UIT (S/ ${fmt(umbral, 2)}).`}
              </p>
            )}
          </>
        )}

        {uit && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Valor en soles de cada fracción de la UIT</caption>
              <thead>
                <tr className="border-b border-slate-300 text-xs uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-2 py-2">Fracción</th>
                  <th scope="col" className="px-2 py-2 text-right">Soles</th>
                  <th scope="col" className="px-2 py-2 text-right">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {FRACCIONES.map((f) => {
                  const enSolesFraccion = uit.times(f.num).div(f.den)
                  const supera = modo === 'soles' && montoValido && enSoles!.gt(enSolesFraccion)
                  return (
                    <tr key={f.etiqueta} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 font-medium text-mar-profundo">{f.etiqueta}</td>
                      <td className="px-2 py-1.5 text-right">S/ {fmt(enSolesFraccion, 2)}</td>
                      <td className="px-2 py-1.5 text-right text-xs text-slate-500">{supera ? 'lo supera' : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Lectura de la UIT registrada en Rentas → Maestros. No modifica nada.
        </p>
      </div>
    </div>
  )
}
