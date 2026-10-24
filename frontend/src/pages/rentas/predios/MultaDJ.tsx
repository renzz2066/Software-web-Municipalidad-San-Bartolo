import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { RUTA_BASE } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import type { PredioApi } from './tipos'

// DJ presentada fuera de plazo (specs/rentas-fiscalizacion-v1.md, F7, decisión 6): se propone la multa
// 176.1 y quien registra la emite o la descarta con motivo. No se genera sola como en SIMUN.

type DJ = NonNullable<PredioApi['declaraciones']>[number]

const MOTIVO_MIN = 10

export function MultaDJ({ dj, alCambiar }: { dj: DJ; alCambiar: () => void }) {
  const [descartando, setDescartando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function decidir(accion: 'EMITIR' | 'DESCARTAR') {
    if (accion === 'DESCARTAR' && motivo.trim().length < MOTIVO_MIN) {
      return setError(`Indica por qué no corresponde la multa (mínimo ${MOTIVO_MIN} caracteres)`)
    }
    setProcesando(true)
    setError(null)
    try {
      await api.post(`/rentas/fiscalizacion/declaraciones/${dj.id}/multa`, { accion, motivo: accion === 'DESCARTAR' ? motivo.trim() : undefined })
      alCambiar()
    } catch (err) {
      setError(mensajeError(err))
      setProcesando(false)
    }
  }

  const multa = dj.multas[0]
  return (
    <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
      Presentada fuera de plazo: la adquisición fue el {dj.fechaHecho} y el plazo venció el {dj.vencePlazo} (D.L. 776 art. 14).
      {multa ? (
        <>
          {' '}
          Multa emitida:{' '}
          <Link
            to={`${RUTA_BASE}/valores/${multa.id}`}
            className="font-mono font-semibold text-mar underline focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            RM N° {multa.anio}-{multa.numero}
          </Link>
          .
        </>
      ) : dj.multaDescartada ? (
        <> Multa descartada: {dj.multaDescartada}</>
      ) : (
        <span className="mt-1 block">
          {descartando ? (
            <span className="flex flex-wrap items-center gap-2">
              <label htmlFor={`descarte-${dj.id}`} className="sr-only">
                Motivo para no aplicar la multa
              </label>
              <input
                id={`descarte-${dj.id}`}
                maxLength={200}
                placeholder="Motivo (p. ej. el hecho se acreditó dentro de plazo)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs focus-visible:outline-3 focus-visible:outline-turquesa"
              />
              <button
                type="button"
                onClick={() => void decidir('DESCARTAR')}
                disabled={procesando}
                className="rounded-md border border-amber-400 px-2 py-1 font-medium hover:bg-amber-100 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
              >
                Confirmar descarte
              </button>
              <button type="button" onClick={() => setDescartando(false)} disabled={procesando} className="px-1 font-medium underline">
                Volver
              </button>
            </span>
          ) : (
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void decidir('EMITIR')}
                disabled={procesando}
                className="rounded-md bg-mar-profundo px-2 py-1 font-semibold text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
              >
                {procesando ? 'Emitiendo…' : 'Emitir multa 176.1'}
              </button>
              <button
                type="button"
                onClick={() => setDescartando(true)}
                disabled={procesando}
                className="rounded-md border border-amber-400 px-2 py-1 font-medium hover:bg-amber-100 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
              >
                No corresponde
              </button>
            </span>
          )}
        </span>
      )}
      {error && (
        <span role="alert" className="mt-1 block font-medium text-red-700">
          {error}
        </span>
      )}
    </span>
  )
}
