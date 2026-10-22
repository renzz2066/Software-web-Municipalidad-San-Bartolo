import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { CLASIFICACIONES, COMPONENTES_CORTOS, ESTADOS_CONSERVACION, MATERIALES } from '../catalogosConstruccion'
import { BuscadorContribuyente } from '../contribuyentes/BuscadorContribuyente'
import { RUTA_BASE, type Contribuyente } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
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

interface PisoForm {
  nivel: string
  anioConstruccion: string
  clasificacion: string
  material: string
  estadoConservacion: string
  categorias: string
  areaConstruida: string
}

interface InstalacionForm {
  descripcion: string
  unidad: string
  cantidad: string
}

interface DatosForm {
  viaId: string
  urbanizacionId: string
  zonaId: string
  numero: string
  manzana: string
  lote: string
  referencia: string
  codigoCatastro: string
  areaTerreno: string
  usoPredio: string
}

const HOY = new Date().toISOString().slice(0, 10)
const DATOS_VACIOS: DatosForm = {
  viaId: '',
  urbanizacionId: '',
  zonaId: '',
  numero: '',
  manzana: '',
  lote: '',
  referencia: '',
  codigoCatastro: '',
  areaTerreno: '',
  usoPredio: '',
}
const PISO_VACIO: PisoForm = {
  nivel: '',
  anioConstruccion: '',
  clasificacion: 'CASA_HABITACION',
  material: 'LADRILLO',
  estadoConservacion: 'BUENO',
  categorias: '',
  areaConstruida: '',
}
const CLASE =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'

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
          const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
          setDatos({
            viaId: s(p.viaId),
            urbanizacionId: s(p.urbanizacionId),
            zonaId: s(p.zonaId),
            numero: s(p.numero),
            manzana: s(p.manzana),
            lote: s(p.lote),
            referencia: s(p.referencia),
            codigoCatastro: s(p.codigoCatastro),
            areaTerreno: s(p.areaTerreno),
            usoPredio: s(p.usoPredio),
          })
          setPisos(
            p.pisos.map((x) => ({
              nivel: x.nivel,
              anioConstruccion: s(x.anioConstruccion),
              clasificacion: s(x.clasificacion),
              material: s(x.material),
              estadoConservacion: s(x.estadoConservacion),
              categorias: s(x.categorias),
              areaConstruida: s(x.areaConstruida),
            })),
          )
          setInstalaciones(p.otrasInstalaciones.map((o) => ({ descripcion: o.descripcion, unidad: s(o.unidad), cantidad: s(o.cantidad) })))
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
    if (!datos.viaId) return 'Selecciona la vía del predio'
    if (!(Number(datos.areaTerreno) > 0)) return 'El área de terreno debe ser mayor que 0'
    if (!datos.usoPredio.trim()) return 'Indica el uso del predio'
    for (const [i, p] of pisos.entries()) {
      if (!p.nivel.trim()) return `Piso ${i + 1}: indica el nivel`
      if (!(Number(p.areaConstruida) > 0)) return `Piso ${i + 1}: el área debe ser mayor que 0`
      if (!/^[A-I-]{7}$/.test(p.categorias.toUpperCase())) return `Piso ${i + 1}: las categorías son 7 letras A-I o "-"`
    }
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
    const optNum = (x: string) => (x.trim() ? Number(x) : null)
    const body = {
      motivo,
      anio: Number(anio),
      fecha,
      declaranteId: declarante!.id,
      predioId: id ? Number(id) : undefined,
      observacion: opt(observacion),
      predio: esBaja
        ? undefined
        : {
            viaId: Number(datos.viaId),
            urbanizacionId: optNum(datos.urbanizacionId),
            zonaId: optNum(datos.zonaId),
            numero: opt(datos.numero),
            manzana: opt(datos.manzana),
            lote: opt(datos.lote),
            referencia: opt(datos.referencia),
            codigoCatastro: opt(datos.codigoCatastro),
            areaTerreno: Number(datos.areaTerreno),
            usoPredio: datos.usoPredio.trim(),
          },
      pisos: esBaja
        ? []
        : pisos.map((p) => ({
            nivel: p.nivel.trim(),
            anioConstruccion: optNum(p.anioConstruccion),
            clasificacion: p.clasificacion,
            material: p.material,
            estadoConservacion: p.estadoConservacion,
            categorias: p.categorias.toUpperCase(),
            areaConstruida: Number(p.areaConstruida),
          })),
      otrasInstalaciones: esBaja
        ? []
        : instalaciones
            .filter((o) => o.descripcion.trim())
            .map((o) => ({ descripcion: o.descripcion.trim(), unidad: opt(o.unidad), cantidad: o.cantidad ? Number(o.cantidad) : undefined })),
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
  const cambiarDato = (k: keyof DatosForm, v: string) => setDatos((d) => ({ ...d, [k]: v }))
  const cambiarPiso = (i: number, k: keyof PisoForm, v: string) => setPisos((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)))

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
              <Bloque titulo="Ubicación y terreno">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Campo id="via" label="Vía *">
                      <select id="via" value={datos.viaId} onChange={(e) => cambiarDato('viaId', e.target.value)} className={CLASE}>
                        <option value="">Selecciona…</option>
                        {catalogos?.vias.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.tipoVia} {v.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  <Campo id="numero" label="Número">
                    <input id="numero" maxLength={10} value={datos.numero} onChange={(e) => cambiarDato('numero', e.target.value)} className={CLASE} />
                  </Campo>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo id="mz" label="Mz.">
                      <input id="mz" maxLength={10} value={datos.manzana} onChange={(e) => cambiarDato('manzana', e.target.value)} className={CLASE} />
                    </Campo>
                    <Campo id="lt" label="Lote">
                      <input id="lt" maxLength={10} value={datos.lote} onChange={(e) => cambiarDato('lote', e.target.value)} className={CLASE} />
                    </Campo>
                  </div>
                  <div className="sm:col-span-2">
                    <Campo id="urb" label="Urbanización">
                      <select id="urb" value={datos.urbanizacionId} onChange={(e) => cambiarDato('urbanizacionId', e.target.value)} className={CLASE}>
                        <option value="">—</option>
                        {catalogos?.urbanizaciones.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                  <Campo id="zona" label="Zona (arbitrios)">
                    <select id="zona" value={datos.zonaId} onChange={(e) => cambiarDato('zonaId', e.target.value)} className={CLASE}>
                      <option value="">—</option>
                      {catalogos?.zonas.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.codigo} · {z.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo id="catastro" label="Código catastral">
                    <input id="catastro" maxLength={20} value={datos.codigoCatastro} onChange={(e) => cambiarDato('codigoCatastro', e.target.value)} className={CLASE} />
                  </Campo>
                  <Campo id="area" label="Área terreno m² *">
                    <input id="area" type="number" step="0.01" min="0" value={datos.areaTerreno} onChange={(e) => cambiarDato('areaTerreno', e.target.value)} className={CLASE} />
                  </Campo>
                  <Campo id="uso" label="Uso del predio *">
                    <input id="uso" maxLength={10} placeholder="CASA" value={datos.usoPredio} onChange={(e) => cambiarDato('usoPredio', e.target.value)} className={`${CLASE} uppercase`} />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo id="ref" label="Referencia">
                      <input id="ref" maxLength={150} value={datos.referencia} onChange={(e) => cambiarDato('referencia', e.target.value)} className={CLASE} />
                    </Campo>
                  </div>
                </div>
                {catalogos && catalogos.vias.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">No hay vías registradas: créalas en Rentas → Maestros → Ubicación.</p>
                )}
              </Bloque>

              <Bloque titulo="Construcción (pisos)">
                <p className="mb-2 text-xs text-slate-500">Categorías: 7 letras A–I en orden {COMPONENTES_CORTOS.join(', ')}; "-" si no tiene. Ej.: CCDEEDE.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="px-1 py-1">Nivel</th>
                        <th scope="col" className="px-1 py-1">Año constr.</th>
                        <th scope="col" className="px-1 py-1">Clasificación</th>
                        <th scope="col" className="px-1 py-1">Material</th>
                        <th scope="col" className="px-1 py-1">Conservación</th>
                        <th scope="col" className="px-1 py-1">Categorías</th>
                        <th scope="col" className="px-1 py-1">Área m²</th>
                        <th scope="col" className="px-1 py-1"><span className="sr-only">Quitar</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pisos.map((p, i) => (
                        <tr key={i}>
                          <td className="w-20 px-1 py-1"><input aria-label={`Nivel piso ${i + 1}`} maxLength={10} value={p.nivel} onChange={(e) => cambiarPiso(i, 'nivel', e.target.value)} className={CLASE} /></td>
                          <td className="w-24 px-1 py-1"><input aria-label={`Año piso ${i + 1}`} inputMode="numeric" maxLength={4} value={p.anioConstruccion} onChange={(e) => cambiarPiso(i, 'anioConstruccion', e.target.value)} className={CLASE} /></td>
                          <td className="px-1 py-1"><Opciones label={`Clasificación piso ${i + 1}`} value={p.clasificacion} opciones={CLASIFICACIONES} onChange={(v) => cambiarPiso(i, 'clasificacion', v)} /></td>
                          <td className="px-1 py-1"><Opciones label={`Material piso ${i + 1}`} value={p.material} opciones={MATERIALES} onChange={(v) => cambiarPiso(i, 'material', v)} /></td>
                          <td className="px-1 py-1"><Opciones label={`Conservación piso ${i + 1}`} value={p.estadoConservacion} opciones={ESTADOS_CONSERVACION} onChange={(v) => cambiarPiso(i, 'estadoConservacion', v)} /></td>
                          <td className="w-28 px-1 py-1"><input aria-label={`Categorías piso ${i + 1}`} maxLength={7} value={p.categorias} onChange={(e) => cambiarPiso(i, 'categorias', e.target.value.toUpperCase())} className={`${CLASE} font-mono tracking-widest`} /></td>
                          <td className="w-24 px-1 py-1"><input aria-label={`Área piso ${i + 1}`} type="number" step="0.01" min="0" value={p.areaConstruida} onChange={(e) => cambiarPiso(i, 'areaConstruida', e.target.value)} className={CLASE} /></td>
                          <td className="px-1 py-1">
                            <button type="button" aria-label={`Quitar piso ${i + 1}`} onClick={() => setPisos((ps) => ps.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700">
                              <i aria-hidden="true" className="bi bi-trash" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => setPisos((ps) => [...ps, { ...PISO_VACIO, nivel: String(ps.length + 1).padStart(2, '0') }])}
                  className="mt-2 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-sm font-medium text-mar-profundo hover:bg-mar/5"
                >
                  <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
                  Agregar piso
                </button>

                <h3 className="mt-6 text-sm font-semibold text-mar-profundo">Otras instalaciones</h3>
                {instalaciones.map((o, i) => (
                  <div key={i} className="mt-2 grid grid-cols-[1fr_6rem_6rem_auto] gap-2">
                    <input aria-label={`Descripción instalación ${i + 1}`} placeholder="Cerco perimétrico" maxLength={150} value={o.descripcion} onChange={(e) => setInstalaciones((xs) => xs.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} className={CLASE} />
                    <input aria-label={`Unidad instalación ${i + 1}`} placeholder="ML" maxLength={10} value={o.unidad} onChange={(e) => setInstalaciones((xs) => xs.map((x, j) => (j === i ? { ...x, unidad: e.target.value } : x)))} className={CLASE} />
                    <input aria-label={`Cantidad instalación ${i + 1}`} type="number" step="0.01" min="0" value={o.cantidad} onChange={(e) => setInstalaciones((xs) => xs.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))} className={CLASE} />
                    <button type="button" aria-label={`Quitar instalación ${i + 1}`} onClick={() => setInstalaciones((xs) => xs.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700">
                      <i aria-hidden="true" className="bi bi-trash" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setInstalaciones((xs) => [...xs, { descripcion: '', unidad: '', cantidad: '' }])}
                  className="mt-2 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-sm font-medium text-mar-profundo hover:bg-mar/5"
                >
                  <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
                  Agregar instalación
                </button>
              </Bloque>

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

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10" aria-label={titulo}>
      <h2 className="mb-4 font-semibold text-mar-profundo">{titulo}</h2>
      {children}
    </section>
  )
}

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}

function Opciones({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string
  value: string
  opciones: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={CLASE}>
      {opciones.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
