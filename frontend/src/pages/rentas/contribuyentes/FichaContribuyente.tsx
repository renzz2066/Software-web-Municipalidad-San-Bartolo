import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { useAccesos } from '../../../context/AccesosContext'
import { PageHeader } from '../../../components/layout/PageHeader'
import { PanelCalculo } from '../calculo/PanelCalculo'
import { ValoresContribuyente } from '../valores/ValoresContribuyente'
import { ConveniosContribuyente } from '../fraccionamiento/ConveniosContribuyente'
import { ExpedientesContribuyente } from '../fiscalizacion/ExpedientesContribuyente'
import { hoyIso, useEstadoCuenta } from '../estado-cuenta/estadoCuentaApi'
import { TablaEstadoCuenta } from '../estado-cuenta/TablaEstadoCuenta'
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
  contribuyente: Contribuyente & {
    via: { tipoVia: string; nombre: string } | null
    zona: { codigo: string; nombre: string } | null
    urbanizacion: { nombre: string } | null
    distrito: { departamento: string; provincia: string; distrito: string } | null
  }
  predios: PredioFicha[]
  deuda: DeudaFila[]
  totalDeuda: string
  declaraciones: DeclaracionFila[]
}

const PESTANAS = [
  { id: 'predios', titulo: 'Predios' },
  { id: 'deuda', titulo: 'Deuda' },
  { id: 'ddjj', titulo: 'Declaraciones juradas' },
  { id: 'calculo', titulo: 'Calcular deuda' },
  { id: 'valores', titulo: 'Valores', nivel: 'rentas.control-recaudacion' },
  { id: 'convenios', titulo: 'Convenios', nivel: 'rentas.control-recaudacion' },
  { id: 'fiscalizacion', titulo: 'Fiscalización', nivel: 'rentas.fiscalizacion' },
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
  const [refreshKey, setRefreshKey] = useState(0)
  const { tiene } = useAccesos()

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
  }, [id, refreshKey])

  const c = datos?.contribuyente

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo={c?.nombreCompleto ?? 'Ficha del contribuyente'}
          descripcion={
            c ? `${c.tipoDoc} ${c.numDoc}${c.codigoLegacy ? ` · SIMUN ${c.codigoLegacy}` : ''}` : undefined
          }
          volverA={{ etiqueta: 'Registro Tributario', ruta: RUTA_BASE }}
          accion={
            c && c.estado !== 'BAJA'
              ? {
                  etiqueta: 'Inscribir predio',
                  icono: 'bi bi-house-add',
                  to: `${RUTA_BASE}/predios/nuevo?declarante=${c.id}`,
                }
              : undefined
          }
        />

        {error ? (
          <p
            role="alert"
            className="mt-6 rounded-panel border border-borde bg-white p-8 text-center text-sm font-medium text-ladrillo"
          >
            {error}
          </p>
        ) : !datos || !c ? (
          <p role="status" className="mt-6 text-center text-sm text-tinta-suave">
            Cargando ficha…
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-panel border border-borde bg-white p-5">
              <div className="min-w-0">
                <p className="text-sm text-slate-600">
                  {c.direccionFiscal ?? 'Sin domicilio fiscal registrado'}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={`rounded-md px-2 py-0.5 font-semibold ${ESTILO_ESTADO[c.estado]}`}>{c.estado}</span>
                  {TIPOS_PERSONA.find((t) => t.value === c.tipoPersona)?.label}
                  {c.celular && <span>· Cel. {c.celular}</span>}
                  {c.email && <span>· {c.email}</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-500">Insoluto pendiente</p>
                <p
                  className={`font-serif text-2xl font-bold ${
                    Number(datos.totalDeuda) > 0 ? 'text-ladrillo' : 'text-ok'
                  }`}
                >
                  {soles(datos.totalDeuda)}
                </p>
                <p className="text-xs text-slate-500">Sin mora; ver pestaña Deuda</p>
                <Link
                  to={`${RUTA_BASE}/contribuyentes/${c.id}/editar`}
                  className="mt-2 inline-block rounded-md border border-mar-profundo/30 px-3 py-1.5 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  <i aria-hidden="true" className="bi bi-pencil mr-1" />
                  Editar datos
                </Link>
              </div>
            </div>

            <details className="mt-3 rounded-panel border border-borde bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa">
                Domicilio fiscal, cónyuge y representante legal
              </summary>
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Dato etiqueta="Ubigeo" valor={c.distrito ? `${c.distrito.departamento} / ${c.distrito.provincia} / ${c.distrito.distrito} (${c.ubigeo})` : c.ubigeo ?? '—'} />
                <Dato
                  etiqueta="Sector / Urbanización"
                  valor={[c.zona ? `${c.zona.codigo} · ${c.zona.nombre}` : null, c.urbanizacion?.nombre ?? null].filter(Boolean).join(' · ') || '—'}
                />
                <Dato
                  etiqueta="Dirección"
                  valor={
                    [
                      c.via ? `${c.via.tipoVia} ${c.via.nombre}` : null,
                      c.numero ? `N° ${c.numero}` : null,
                      c.interior ? `Dpto. ${c.interior}` : null,
                      c.manzana ? `Mz. ${c.manzana}` : null,
                      c.lote ? `Lt. ${c.lote}` : null,
                    ]
                      .filter(Boolean)
                      .join(' ') || '—'
                  }
                />
                <Dato etiqueta="Referencia" valor={c.referencia ?? '—'} />
                <Dato etiqueta="Cónyuge" valor={[c.conyugeNombre, c.conyugeNumDoc ? `DNI ${c.conyugeNumDoc}` : null].filter(Boolean).join(' · ') || '—'} />
                <Dato
                  etiqueta="Representante legal"
                  valor={
                    [
                      c.representanteNombre,
                      c.representanteNumDoc ? `DNI ${c.representanteNumDoc}` : null,
                      c.representanteDireccion,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  }
                />
              </dl>
            </details>

            <nav aria-label="Secciones de la ficha" role="tablist" className="mt-6 flex gap-1 overflow-x-auto">
              {PESTANAS.filter((p) => !('nivel' in p) || tiene(p.nivel)).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p.id}
                  onClick={() => setPestana(p.id)}
                  className={`whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa ${
                    pestana === p.id ? 'bg-white text-mar-profundo' : 'text-slate-600 hover:bg-white/60'
                  }`}
                >
                  {p.titulo}
                  {(p.id === 'predios' || p.id === 'deuda' || p.id === 'ddjj') && (
                    <span className="ml-1 text-xs text-slate-400">
                      ({p.id === 'predios' ? datos.predios.length : p.id === 'deuda' ? datos.deuda.length : datos.declaraciones.length})
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <main role="tabpanel" className="overflow-x-auto rounded-panel border border-borde bg-white">
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

              {pestana === 'deuda' && <DeudaALaFecha contribuyenteId={c.id} refreshKey={refreshKey} />}

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
              {pestana === 'calculo' && (
                <div className="p-6">
                  <PanelCalculo contribuyenteId={c.id} alEjecutar={() => setRefreshKey((k) => k + 1)} />
                </div>
              )}
              {pestana === 'valores' && <ValoresContribuyente contribuyenteId={c.id} />}
              {pestana === 'fiscalizacion' && <ExpedientesContribuyente contribuyenteId={c.id} />}
              {pestana === 'convenios' &&<ConveniosContribuyente contribuyenteId={c.id} alGrabar={() => setRefreshKey((k) => k + 1)} />}
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

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-slate-700">{valor}</dd>
    </div>
  )
}

// Estado de cuenta con reajuste y mora a la fecha elegida (C6).
function DeudaALaFecha({ contribuyenteId, refreshKey }: { contribuyenteId: number; refreshKey: number }) {
  const [fecha, setFecha] = useState(hoyIso)
  const { datos, error, isLoading } = useEstadoCuenta(contribuyenteId, fecha, refreshKey)
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="deuda-fecha" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Deuda al
          </label>
          <input
            id="deuda-fecha"
            type="date"
            value={fecha}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
        </div>
        <Link
          to={`${RUTA_BASE}/contribuyentes/${contribuyenteId}/estado-cuenta?fecha=${fecha}`}
          className="rounded-md border border-mar-profundo/30 px-3 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-printer mr-1" />
          Versión imprimible
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-ladrillo">
          {error}
        </p>
      ) : isLoading || !datos ? (
        <p role="status" className="text-sm text-slate-500">
          Calculando deuda…
        </p>
      ) : (
        <TablaEstadoCuenta datos={datos} />
      )}
    </div>
  )
}
