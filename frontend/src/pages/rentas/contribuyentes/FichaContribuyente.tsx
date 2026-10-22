import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { ESTILO_ESTADO, RUTA_BASE, TIPOS_PERSONA, soles, type Contribuyente } from './tipos'

// Ficha 360 del contribuyente (C2): datos, predios, deuda viva y DDJJ en una sola pantalla.

interface PredioFicha {
  porcentaje: string
  esPrincipal: boolean
  fechaAdquisicion: string | null
  predio: {
    id: number
    codigoLegacy: string | null
    numero: string | null
    manzana: string | null
    lote: string | null
    usoPredio: string | null
    areaTerreno: string | null
    areaConstruida: string | null
    valorAutovaluo: string | null
    via: { tipoVia: string; nombre: string } | null
    urbanizacion: { nombre: string } | null
    zona: { codigo: string; nombre: string } | null
  }
}

interface DeudaFila {
  anio: number
  tributo: { id: number; codigo: string; nombre: string }
  cuotas: number
  importe: string
  reajuste: string
  mora: string
  total: string
}

interface DeclaracionFila {
  id: number
  predioId: number
  anio: number
  motivo: string
  fecha: string
  observacion: string | null
  contribuyente: { id: number; nombreCompleto: string }
}

interface Resumen {
  contribuyente: Contribuyente
  predios: PredioFicha[]
  deuda: DeudaFila[]
  totalDeuda: string
  declaraciones: DeclaracionFila[]
}

const PESTANAS = [
  { id: 'predios', titulo: 'Predios' },
  { id: 'deuda', titulo: 'Deuda' },
  { id: 'ddjj', titulo: 'Declaraciones juradas' },
] as const

function direccionPredio(p: PredioFicha['predio']): string {
  const partes = [
    p.via ? `${p.via.tipoVia} ${p.via.nombre}` : null,
    p.numero ? `N° ${p.numero}` : null,
    p.manzana ? `Mz. ${p.manzana}` : null,
    p.lote ? `Lt. ${p.lote}` : null,
    p.urbanizacion?.nombre ?? null,
  ]
  return partes.filter(Boolean).join(' ') || `Predio #${p.id}`
}

export function FichaContribuyente() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [datos, setDatos] = useState<Resumen | null>(null)
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['id']>('predios')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<Resumen>(`/contribuyentes/${id}/resumen`)
        if (!cancelled) setDatos(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id])

  const c = datos?.contribuyente

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to={RUTA_BASE}
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Registro Tributario
        </Link>

        {error ? (
          <p role="alert" className="mt-6 rounded-xl bg-white p-8 text-center text-sm font-medium text-red-700 shadow-md">
            {error}
          </p>
        ) : !datos || !c ? (
          <p role="status" className="mt-6 text-center text-sm text-slate-500">
            Cargando ficha…
          </p>
        ) : (
          <>
            <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-slate-500">
                    {c.tipoDoc} {c.numDoc}
                    {c.codigoLegacy && ` · SIMUN ${c.codigoLegacy}`}
                  </p>
                  <h1 className="text-xl font-bold text-mar-profundo">{c.nombreCompleto}</h1>
                  <p className="text-sm text-slate-600">{c.direccionFiscal ?? 'Sin domicilio fiscal registrado'}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className={`rounded-md px-2 py-0.5 font-semibold ${ESTILO_ESTADO[c.estado]}`}>{c.estado}</span>
                    {TIPOS_PERSONA.find((t) => t.value === c.tipoPersona)?.label}
                    {c.celular && <span>· Cel. {c.celular}</span>}
                    {c.email && <span>· {c.email}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Deuda pendiente</p>
                  <p className={`text-2xl font-bold ${Number(datos.totalDeuda) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {soles(datos.totalDeuda)}
                  </p>
                  <p className="text-xs text-slate-500">Insoluto + reajuste + mora registrados</p>
                  <Link
                    to={`${RUTA_BASE}/contribuyentes/${c.id}/editar`}
                    className="mt-2 inline-block rounded-md border border-mar-profundo/30 px-3 py-1.5 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    <i aria-hidden="true" className="bi bi-pencil mr-1" />
                    Editar datos
                  </Link>
                  {c.estado !== 'BAJA' && (
                    <Link
                      to={`${RUTA_BASE}/predios/nuevo?declarante=${c.id}`}
                      className="ml-2 mt-2 inline-block rounded-md bg-mar-profundo px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
                    >
                      <i aria-hidden="true" className="bi bi-house-add mr-1" />
                      Inscribir predio
                    </Link>
                  )}
                </div>
              </div>
            </header>

            <nav aria-label="Secciones de la ficha" role="tablist" className="mt-6 flex gap-1 overflow-x-auto">
              {PESTANAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.id}
                  onClick={() => setPestana(p.id)}
                  className={`whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa ${
                    pestana === p.id ? 'bg-white text-mar-profundo shadow-sm' : 'text-slate-600 hover:bg-white/60'
                  }`}
                >
                  {p.titulo}
                  <span className="ml-1 text-xs text-slate-400">
                    ({p.id === 'predios' ? datos.predios.length : p.id === 'deuda' ? datos.deuda.length : datos.declaraciones.length})
                  </span>
                </button>
              ))}
            </nav>

            <main role="tabpanel" className="overflow-x-auto rounded-b-xl rounded-tr-xl bg-white shadow-md ring-1 ring-mar-profundo/10">
              {pestana === 'predios' &&
                (datos.predios.length === 0 ? (
                  <Vacio texto="Sin predios registrados." />
                ) : (
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="px-4 py-3">Ubicación</th>
                        <th scope="col" className="px-4 py-3">Uso</th>
                        <th scope="col" className="px-4 py-3 text-right">Terreno m²</th>
                        <th scope="col" className="px-4 py-3 text-right">Autoavalúo</th>
                        <th scope="col" className="px-4 py-3 text-right">% propiedad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.predios.map((pc) => (
                        <tr
                          key={pc.predio.id}
                          tabIndex={0}
                          onClick={() => navigate(`${RUTA_BASE}/predios/${pc.predio.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') navigate(`${RUTA_BASE}/predios/${pc.predio.id}`)
                          }}
                          className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                        >
                          <td className="px-4 py-3 text-mar-profundo">{direccionPredio(pc.predio)}</td>
                          <td className="px-4 py-3 text-slate-600">{pc.predio.usoPredio ?? '—'}</td>
                          <td className="px-4 py-3 text-right">{pc.predio.areaTerreno ?? '—'}</td>
                          <td className="px-4 py-3 text-right">{pc.predio.valorAutovaluo ? soles(pc.predio.valorAutovaluo) : '—'}</td>
                          <td className="px-4 py-3 text-right">{Number(pc.porcentaje)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}

              {pestana === 'deuda' &&
                (datos.deuda.length === 0 ? (
                  <Vacio texto="Sin deuda pendiente." />
                ) : (
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="px-4 py-3">Año</th>
                        <th scope="col" className="px-4 py-3">Tributo</th>
                        <th scope="col" className="px-4 py-3 text-right">Cuotas</th>
                        <th scope="col" className="px-4 py-3 text-right">Insoluto</th>
                        <th scope="col" className="px-4 py-3 text-right">Reajuste</th>
                        <th scope="col" className="px-4 py-3 text-right">Mora</th>
                        <th scope="col" className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.deuda.map((d) => (
                        <tr key={`${d.anio}-${d.tributo.id}`} className="border-b border-slate-100">
                          <td className="px-4 py-3">{d.anio}</td>
                          <td className="px-4 py-3 text-mar-profundo">{d.tributo.nombre}</td>
                          <td className="px-4 py-3 text-right">{d.cuotas}</td>
                          <td className="px-4 py-3 text-right">{soles(d.importe)}</td>
                          <td className="px-4 py-3 text-right">{soles(d.reajuste)}</td>
                          <td className="px-4 py-3 text-right">{soles(d.mora)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{soles(d.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}

              {pestana === 'ddjj' &&
                (datos.declaraciones.length === 0 ? (
                  <Vacio texto="Sin declaraciones juradas." />
                ) : (
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="px-4 py-3">Fecha</th>
                        <th scope="col" className="px-4 py-3">Año</th>
                        <th scope="col" className="px-4 py-3">Motivo</th>
                        <th scope="col" className="px-4 py-3">Predio</th>
                        <th scope="col" className="px-4 py-3">Declarante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.declaraciones.map((dj) => (
                        <tr key={dj.id} className="border-b border-slate-100">
                          <td className="px-4 py-3">{dj.fecha.slice(0, 10)}</td>
                          <td className="px-4 py-3">{dj.anio}</td>
                          <td className="px-4 py-3">{dj.motivo}</td>
                          <td className="px-4 py-3">
                            <Link to={`${RUTA_BASE}/predios/${dj.predioId}`} className="font-medium text-mar hover:underline">
                              #{dj.predioId}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{dj.contribuyente.nombreCompleto}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
            </main>
          </>
        )}
      </div>
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="p-8 text-center text-sm text-slate-500">{texto}</p>
}
