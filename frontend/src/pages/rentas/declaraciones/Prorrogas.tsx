import { useEffect, useState } from 'react'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useAuth } from '../../../context/AuthContext'
import { api } from '../../../lib/api'
import { nombreDe, useCatalogo } from '../catalogos/catalogosApi'
import { BuscadorContribuyente } from '../contribuyentes/BuscadorContribuyente'
import { documentoTexto } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { RUTA_DJ } from './djApi'

// Registro Tributario → DJ presentadas → Prórrogas (specs/rentas-nucleo-v2.md, Fase 7; J16, J17).
// General (por ordenanza, para todos): la registra un supervisor y nace aprobada. Individual: queda
// solicitada hasta que otro supervisor la apruebe o rechace. Una aprobada mueve el plazo de la DJ (J08).

const SUPERVISION = ['SUPERVISOR', 'ADMIN']
const CLASE = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const ANIO = new Date().getFullYear()
const HOY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

type Estado = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'

interface Prorroga {
  id: number
  contribuyente: { id: number; tipoDoc: string; numDoc: string | null; nombreCompleto: string } | null
  anio: number
  motivo: string | null
  fechaLimite: string
  fechaSolicitud: string
  sustento: string
  estado: Estado
  justificacion: string | null
  anuladaMotivo: string | null
  creadoPor: { usuario: string } | null
  resueltaPor: { usuario: string } | null
  anuladaPor: { usuario: string } | null
}

const ESTILO: Record<Estado, string> = {
  SOLICITADA: 'bg-amber-50 text-amber-800',
  APROBADA: 'bg-emerald-50 text-emerald-800',
  RECHAZADA: 'bg-slate-100 text-slate-600',
  ANULADA: 'bg-slate-100 text-slate-600',
}

interface Nueva {
  persona: { id: number; nombreCompleto: string; documento: string } | null
  general: boolean
  anio: string
  motivo: string
  fechaLimite: string
  fechaSolicitud: string
  sustento: string
}

const VACIA: Nueva = { persona: null, general: false, anio: String(ANIO), motivo: '', fechaLimite: '', fechaSolicitud: HOY, sustento: '' }

export function Prorrogas() {
  const { user } = useAuth()
  const supervisor = SUPERVISION.includes(user?.rol ?? '')
  const motivos = useCatalogo('MOTIVO_DJ')
  const [anio, setAnio] = useState(String(ANIO))
  const [filas, setFilas] = useState<Prorroga[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nueva, setNueva] = useState<Nueva | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    api
      .get<Prorroga[]>('/declaraciones/prorrogas', { params: { anio: anio || undefined } })
      .then(({ data }) => vivo && setFilas(data))
      .catch((err) => vivo && setError(mensajeError(err)))
    return () => {
      vivo = false
    }
  }, [anio, recarga])

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (!nueva) return
    if (!nueva.general && !nueva.persona) {
      setError('Elige la persona o marca la prórroga como general.')
      return
    }
    setOcupado(true)
    setError(null)
    try {
      await api.post('/declaraciones/prorrogas', {
        contribuyenteId: nueva.general ? null : nueva.persona?.id,
        anio: Number(nueva.anio),
        motivo: nueva.motivo || null,
        fechaLimite: nueva.fechaLimite,
        fechaSolicitud: nueva.fechaSolicitud,
        sustento: nueva.sustento.trim(),
      })
      setNueva(null)
      setAnio(nueva.anio)
      setRecarga((r) => r + 1)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  async function accion(p: Prorroga, ruta: 'resolver' | 'anular', body: object) {
    setOcupado(true)
    setError(null)
    try {
      await api.post(`/declaraciones/prorrogas/${p.id}/${ruta}`, body)
      setRecarga((r) => r + 1)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Prórrogas de presentación"
          descripcion="Amplían el plazo para presentar la DJ (J16). Una prórroga aprobada mueve el vencimiento con el que se propone la multa 176.1."
          volverA={{ etiqueta: 'DJ presentadas', ruta: RUTA_DJ }}
        />

        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-panel border border-borde bg-white p-4">
          <label className="text-sm">
            <span className="block text-xs text-slate-500">Año del plazo</span>
            <input value={anio} maxLength={4} inputMode="numeric" onChange={(e) => setAnio(e.target.value.replace(/\D/g, ''))} className={`${CLASE} w-24`} />
          </label>
          {!nueva && (
            <button
              type="button"
              onClick={() => setNueva({ ...VACIA, anio: anio || String(ANIO) })}
              className="ml-auto rounded-md bg-mar-profundo px-3 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              <i aria-hidden="true" className="bi bi-calendar-plus mr-1" />
              Registrar prórroga
            </button>
          )}
        </div>

        {nueva && (
          <form onSubmit={(e) => void registrar(e)} className="mt-4 grid gap-3 rounded-panel border border-borde bg-white p-4 sm:grid-cols-3" aria-label="Nueva prórroga">
            <div className="sm:col-span-3">
              {supervisor && (
                <label className="mb-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={nueva.general} onChange={(e) => setNueva({ ...nueva, general: e.target.checked })} />
                  General, por ordenanza (para todos los contribuyentes; nace aprobada)
                </label>
              )}
              {!nueva.general &&
                (nueva.persona ? (
                  <p className="text-sm">
                    <span className="font-medium text-mar-profundo">{nueva.persona.nombreCompleto}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{nueva.persona.documento}</span>
                    <button type="button" onClick={() => setNueva({ ...nueva, persona: null })} className="ml-2 rounded-md px-2 py-1 text-xs font-medium text-mar hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
                      Cambiar
                    </button>
                  </p>
                ) : (
                  <BuscadorContribuyente
                    id="prorroga-persona"
                    label="Contribuyente que la solicita"
                    alElegir={(c) => setNueva({ ...nueva, persona: { id: c.id, nombreCompleto: c.nombreCompleto, documento: documentoTexto(c) } })}
                  />
                ))}
            </div>
            <label className="text-sm">
              <span className="block text-xs text-slate-500">Año del plazo que se prorroga</span>
              <input value={nueva.anio} maxLength={4} inputMode="numeric" onChange={(e) => setNueva({ ...nueva, anio: e.target.value.replace(/\D/g, '') })} className={CLASE} />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500">Motivo de DJ</span>
              <select value={nueva.motivo} onChange={(e) => setNueva({ ...nueva, motivo: e.target.value })} className={CLASE}>
                <option value="">Todos los motivos con plazo</option>
                {motivos.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500">Nueva fecha límite</span>
              <input type="date" value={nueva.fechaLimite} onChange={(e) => setNueva({ ...nueva, fechaLimite: e.target.value })} className={CLASE} />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500">Fecha de la solicitud</span>
              <input type="date" value={nueva.fechaSolicitud} max={HOY} onChange={(e) => setNueva({ ...nueva, fechaSolicitud: e.target.value })} className={CLASE} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="block text-xs text-slate-500">Sustento (ordenanza, expediente o documento)</span>
              <input value={nueva.sustento} maxLength={250} onChange={(e) => setNueva({ ...nueva, sustento: e.target.value })} className={CLASE} />
            </label>
            <div className="flex gap-2 sm:col-span-3">
              <button
                type="submit"
                disabled={ocupado || !nueva.fechaLimite || !nueva.sustento.trim()}
                className="rounded-md bg-mar-profundo px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
              >
                Registrar
              </button>
              <button type="button" onClick={() => setNueva(null)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-ladrillo">
            {error}
          </p>
        )}

        <div className="mt-4 overflow-x-auto rounded-panel border border-borde bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Prórrogas del año {anio}</caption>
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-3 py-2">Alcance</th>
                <th scope="col" className="px-2 py-2">Motivo</th>
                <th scope="col" className="px-2 py-2">Nueva fecha límite</th>
                <th scope="col" className="px-2 py-2">Sustento</th>
                <th scope="col" className="px-2 py-2">Estado</th>
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filas === null ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-slate-500">
                    No hay prórrogas registradas para {anio || 'ese año'}.
                  </td>
                </tr>
              ) : (
                filas.map((p) => (
                  <FilaProrroga
                    key={`${p.id}-${p.estado}`}
                    p={p}
                    motivo={p.motivo ? nombreDe(motivos, p.motivo) : 'Todos'}
                    puedeResolver={supervisor && p.estado === 'SOLICITADA' && p.creadoPor?.usuario !== user?.usuario}
                    puedeAnular={supervisor && (p.estado === 'SOLICITADA' || p.estado === 'APROBADA')}
                    ocupado={ocupado}
                    alAccion={(ruta, body) => void accion(p, ruta, body)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FilaProrroga({
  p,
  motivo,
  puedeResolver,
  puedeAnular,
  ocupado,
  alAccion,
}: {
  p: Prorroga
  motivo: string
  puedeResolver: boolean
  puedeAnular: boolean
  ocupado: boolean
  alAccion: (ruta: 'resolver' | 'anular', body: object) => void
}) {
  const [modo, setModo] = useState<'APROBAR' | 'RECHAZAR' | 'ANULAR' | null>(null)
  const [texto, setTexto] = useState('')
  const resuelta = p.estado === 'ANULADA' ? p.anuladaMotivo : p.justificacion
  const quien = p.estado === 'ANULADA' ? p.anuladaPor?.usuario : p.resueltaPor?.usuario
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2">
        {p.contribuyente ? (
          <>
            {p.contribuyente.nombreCompleto}
            <span className="block font-mono text-xs text-slate-500">
              {p.contribuyente.tipoDoc} {p.contribuyente.numDoc ?? ''}
            </span>
          </>
        ) : (
          <span className="font-medium">General (ordenanza)</span>
        )}
        <span className="block text-xs text-slate-500">Solicitada el {p.fechaSolicitud} · {p.creadoPor?.usuario ?? '—'}</span>
      </td>
      <td className="px-2 py-2">{motivo}</td>
      <td className="px-2 py-2 whitespace-nowrap tabular-nums">{p.fechaLimite}</td>
      <td className="px-2 py-2 text-slate-700">{p.sustento}</td>
      <td className="px-2 py-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO[p.estado]}`}>{p.estado.toLowerCase()}</span>
        {resuelta && (
          <span className="mt-1 block text-xs text-slate-500">
            {resuelta}
            {quien ? ` (${quien})` : ''}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        {modo ? (
          <div className="flex min-w-[220px] flex-col gap-1">
            <input
              aria-label={modo === 'ANULAR' ? 'Motivo de la anulación' : 'Justificación'}
              value={texto}
              maxLength={250}
              placeholder={modo === 'ANULAR' ? 'Motivo (mín. 10 caracteres)' : 'Justificación (mín. 10 caracteres)'}
              onChange={(e) => setTexto(e.target.value)}
              className={CLASE}
            />
            <div className="flex gap-1">
              <button
                type="button"
                disabled={ocupado || texto.trim().length < 10}
                onClick={() => alAccion(modo === 'ANULAR' ? 'anular' : 'resolver', modo === 'ANULAR' ? { motivo: texto.trim() } : { accion: modo, justificacion: texto.trim() })}
                className="rounded-md bg-mar-profundo px-2 py-1 text-xs font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
              >
                Confirmar
              </button>
              <button type="button" onClick={() => setModo(null)} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-1">
            {puedeResolver && (
              <>
                <button type="button" onClick={() => setModo('APROBAR')} className="rounded-md border border-emerald-700/40 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline-3 focus-visible:outline-turquesa">
                  Aprobar
                </button>
                <button type="button" onClick={() => setModo('RECHAZAR')} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa">
                  Rechazar
                </button>
              </>
            )}
            {puedeAnular && (
              <button type="button" onClick={() => setModo('ANULAR')} className="rounded-md border border-ladrillo/40 px-2 py-1 text-xs font-medium text-ladrillo hover:bg-ladrillo/5 focus-visible:outline-3 focus-visible:outline-turquesa">
                Anular
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
