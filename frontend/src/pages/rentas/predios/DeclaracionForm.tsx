import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { hoyLocal } from '../../../lib/fechas'
import { BuscadorContribuyente } from '../contribuyentes/BuscadorContribuyente'
import { RUTA_BASE, type Contribuyente } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { Bloque, Campo, CamposPredio } from './DatosPredioCampos'
import { CLASE, DATOS_VACIOS, errorConstruccion, formDesdePredio, payloadConstruccion, type DatosForm, type InstalacionForm, type PisoForm } from './predioForm'
import { MOTIVOS, direccion, type Catalogos, type Motivo, type PredioApi } from './tipos'

// Declaración jurada de predio (C3). /predios/nuevo = inscripción; /predios/:id/declaracion?motivo=X = resto.
// El backend graba predio + pisos + condóminos + DJ (con snapshot) en una sola transacción.

interface Persona {
  id: number
  nombre: string
  doc: string
}

interface Condomino extends Persona {
  porcentaje: string
}

const HOY = hoyLocal()
const persona = (c: { id: number; nombreCompleto: string; tipoDoc: string; numDoc: string }): Persona => ({
  id: c.id,
  nombre: c.nombreCompleto,
  doc: `${c.tipoDoc} ${c.numDoc}`,
})

const centavos = (v: string) => Math.round(Number(v) * 100)

export function DeclaracionForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const motivoInicial = (id ? params.get('motivo') : 'INSCRIPCION') as Motivo | null
  const [motivo, setMotivo] = useState<Motivo>(motivoInicial ?? 'RECTIFICACION')
  const [anio, setAnio] = useState(String(new Date().getFullYear()))
  const [fecha, setFecha] = useState(HOY)
  const [observacion, setObservacion] = useState('')
  const [declarante, setDeclarante] = useState<Persona | null>(null)
  const [datos, setDatos] = useState<DatosForm>(DATOS_VACIOS)
  const [pisos, setPisos] = useState<PisoForm[]>([])
  const [instalaciones, setInstalaciones] = useState<InstalacionForm[]>([])
  const [condominos, setCondominos] = useState<Condomino[]>([])
  const [predio, setPredio] = useState<PredioApi | null>(null)
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const cat = await api.get<Catalogos>('/predios/catalogos')
        if (cancelled) return
        setCatalogos(cat.data)
        if (id) {
          const { data: p } = await api.get<PredioApi>(`/predios/${id}`)
          if (cancelled) return
          setPredio(p)
          const form = formDesdePredio(p)
          setDatos(form.datos)
          setPisos(form.pisos)
          setInstalaciones(form.instalaciones)
          const titulares = p.contribuyentes.map((t) => ({ ...persona(t.contribuyente), porcentaje: String(Number(t.porcentaje)) }))
          const principal = titulares[0] ?? null
          // Compra: el comprador declara y se agrega. Venta: el vendedor declara y sale.
          setDeclarante(motivoInicial === 'COMPRA' ? null : principal)
          setCondominos(motivoInicial === 'VENTA' && principal ? titulares.filter((t) => t.id !== principal.id) : titulares)
        } else {
          const decId = params.get('declarante')
          if (decId) {
            const { data: c } = await api.get<Contribuyente>(`/contribuyentes/${decId}`)
            if (cancelled) return
            setDeclarante(persona(c))
            setCondominos([{ ...persona(c), porcentaje: '100' }])
          }
        }
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
    // Carga inicial: los parámetros de la URL no cambian dentro de esta pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const esBaja = motivo === 'BAJA'
  const sumaCentavos = condominos.reduce((acc, c) => acc + centavos(c.porcentaje || '0'), 0)

  function validar(): string | null {
    if (!declarante) return 'Elige al declarante'
    if (!/^\d{4}$/.test(anio)) return 'Indica el año fiscal'
    if (fecha > HOY) return 'La fecha no puede ser futura'
    if (esBaja) return null
    const errorPredio = errorConstruccion(datos, pisos)
    if (errorPredio) return errorPredio
    if (condominos.length === 0) return 'Agrega al menos un titular'
    if (sumaCentavos !== 10000) return `Los porcentajes deben sumar 100% (suman ${(sumaCentavos / 100).toFixed(2)}%)`
    const enLista = condominos.some((c) => c.id === declarante.id)
    if (motivo === 'VENTA' && enLista) return 'En una venta el declarante (vendedor) no debe seguir como titular'
    if (motivo !== 'VENTA' && !enLista) return 'El declarante debe figurar entre los titulares'
    return null
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const v = validar()
    if (v) {
      setError(v)
      return
    }
    const opt = (x: string) => (x.trim() ? x.trim() : undefined)
    const construccion = payloadConstruccion(datos, pisos, instalaciones)
    const body = {
      motivo,
      anio: Number(anio),
      fecha,
      declaranteId: declarante!.id,
      predioId: id ? Number(id) : undefined,
      observacion: opt(observacion),
      predio: esBaja ? undefined : construccion.predio,
      pisos: esBaja ? [] : construccion.pisos,
      otrasInstalaciones: esBaja ? [] : construccion.otrasInstalaciones,
      condominos: esBaja ? [] : condominos.map((c) => ({ contribuyenteId: c.id, porcentaje: Number(c.porcentaje) })),
    }
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await api.post<{ predioId: number }>('/predios/declaraciones', body)
      navigate(`${RUTA_BASE}/predios/${data.predioId}`)
    } catch (err) {
      setError(mensajeError(err))
      setIsSaving(false)
    }
  }

  const volver = id ? `${RUTA_BASE}/predios/${id}` : declarante ? `${RUTA_BASE}/contribuyentes/${declarante.id}` : RUTA_BASE

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to={volver}
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Volver
        </Link>

        <form onSubmit={(e) => void enviar(e)} noValidate className="mt-3 space-y-6">
          <Bloque titulo={id ? `Declaración jurada · ${predio ? direccion(predio) : `Predio #${id}`}` : 'Declaración jurada · Inscripción de predio'}>
            <div className="grid gap-4 sm:grid-cols-4">
              <Campo id="motivo" label="Motivo">
                <select
                  id="motivo"
                  value={motivo}
                  disabled={!id}
                  onChange={(e) => setMotivo(e.target.value as Motivo)}
                  className={CLASE}
                >
                  {MOTIVOS.filter((m) => (id ? m.value !== 'INSCRIPCION' : m.value === 'INSCRIPCION')).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo id="anio" label="Año fiscal">
                <input id="anio" inputMode="numeric" maxLength={4} value={anio} onChange={(e) => setAnio(e.target.value)} className={CLASE} />
              </Campo>
              <Campo id="fecha" label="Fecha de presentación">
                <input id="fecha" type="date" max={HOY} value={fecha} onChange={(e) => setFecha(e.target.value)} className={CLASE} />
              </Campo>
              <Campo id="obs" label="Observación">
                <input id="obs" maxLength={250} value={observacion} onChange={(e) => setObservacion(e.target.value)} className={CLASE} />
              </Campo>
            </div>
            <p className="mt-2 text-xs text-slate-500">{MOTIVOS.find((m) => m.value === motivo)?.ayuda}</p>

            <div className="mt-4">
              {declarante ? (
                <p className="text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Declarante: </span>
                  <span className="font-medium text-mar-profundo">{declarante.nombre}</span>{' '}
                  <span className="font-mono text-xs text-slate-500">{declarante.doc}</span>
                  <button type="button" onClick={() => setDeclarante(null)} className="ml-2 text-xs font-medium text-mar hover:underline">
                    cambiar
                  </button>
                </p>
              ) : (
                <BuscadorContribuyente
                  id="buscar-declarante"
                  label={motivo === 'COMPRA' ? 'Declarante (comprador)' : 'Declarante'}
                  alElegir={(c) => {
                    const p = persona(c)
                    setDeclarante(p)
                    // En compra, el comprador entra como titular para que se reparta el %.
                    if (motivo !== 'VENTA' && !condominos.some((x) => x.id === p.id)) {
                      setCondominos((cs) => [...cs, { ...p, porcentaje: cs.length ? '0' : '100' }])
                    }
                  }}
                />
              )}
            </div>
          </Bloque>

          {!esBaja && (
            <>
              <CamposPredio
                catalogos={catalogos}
                datos={datos}
                setDatos={setDatos}
                pisos={pisos}
                setPisos={setPisos}
                instalaciones={instalaciones}
                setInstalaciones={setInstalaciones}
              />

              <Bloque titulo="Titulares (condóminos)">
                <ul className="divide-y divide-slate-100">
                  {condominos.map((c, i) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                      <span className="flex-1">
                        <span className="font-medium text-mar-profundo">{c.nombre}</span>{' '}
                        <span className="font-mono text-xs text-slate-500">{c.doc}</span>
                        {i === 0 && <span className="ml-2 text-xs text-slate-500">(principal)</span>}
                      </span>
                      <label className="flex items-center gap-1">
                        <span className="sr-only">Porcentaje de {c.nombre}</span>
                        <input type="number" step="0.01" min="0" max="100" value={c.porcentaje} onChange={(e) => setCondominos((cs) => cs.map((x) => (x.id === c.id ? { ...x, porcentaje: e.target.value } : x)))} className={`${CLASE} w-24 text-right`} />
                        %
                      </label>
                      <button type="button" aria-label={`Quitar a ${c.nombre}`} onClick={() => setCondominos((cs) => cs.filter((x) => x.id !== c.id))} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700">
                        <i aria-hidden="true" className="bi bi-x-lg" />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className={`mt-2 text-sm font-medium ${sumaCentavos === 10000 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Suma: {(sumaCentavos / 100).toFixed(2)}%
                </p>
                <div className="mt-3 max-w-md">
                  <BuscadorContribuyente
                    id="buscar-condomino"
                    label="Agregar titular"
                    excluir={condominos.map((c) => c.id)}
                    alElegir={(c) => setCondominos((cs) => [...cs, { ...persona(c), porcentaje: cs.length ? '0' : '100' }])}
                  />
                </div>
              </Bloque>
            </>
          )}

          <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
            {error && (
              <p role="alert" className="mb-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40 ${
                  esBaja ? 'bg-red-700' : 'bg-mar-profundo'
                }`}
              >
                {isSaving ? 'Registrando…' : esBaja ? 'Registrar baja del predio' : 'Registrar declaración'}
              </button>
              <Link to={volver} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
