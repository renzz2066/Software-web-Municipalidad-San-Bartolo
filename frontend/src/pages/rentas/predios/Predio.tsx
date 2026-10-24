import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { CLASIFICACIONES, COMPONENTES_CORTOS, ESTADOS_CONSERVACION, MATERIALES, etiqueta } from '../catalogosConstruccion'
import { RUTA_BASE } from '../contribuyentes/tipos'
import { mensajeError } from '../maestros/maestrosApi'
import { MultaDJ } from './MultaDJ'
import { direccion, etiquetaMotivo, type PredioApi } from './tipos'

// Detalle del predio: datos vigentes + historial de DDJJ. Todo cambio entra por una DJ.

export function Predio() {
  const { id } = useParams()
  const [predio, setPredio] = useState<PredioApi | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<PredioApi>(`/predios/${id}`)
        if (!cancelled) setPredio(data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id, recarga])

  const titular = predio?.contribuyentes[0]?.contribuyente
  const activo = predio?.estado !== 'BAJA'

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to={titular ? `${RUTA_BASE}/contribuyentes/${titular.id}` : RUTA_BASE}
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          {titular ? titular.nombreCompleto : 'Registro Tributario'}
        </Link>

        {error ? (
          <p role="alert" className="mt-6 rounded-xl bg-white p-8 text-center text-sm font-medium text-red-700 shadow-md">
            {error}
          </p>
        ) : !predio ? (
          <p role="status" className="mt-6 text-center text-sm text-slate-500">
            Cargando predio…
          </p>
        ) : (
          <>
            <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-slate-500">
                    Predio #{predio.id}
                    {predio.codigoLegacy && ` · SIMUN ${predio.codigoLegacy}`}
                    {predio.codigoCatastro && ` · Catastro ${predio.codigoCatastro}`}
                  </p>
                  <h1 className="text-xl font-bold text-mar-profundo">{direccion(predio)}</h1>
                  <p className="text-sm text-slate-600">
                    {predio.zona ? `Zona ${predio.zona.codigo} · ` : ''}Uso {predio.usoPredio ?? '—'} · Terreno {predio.areaTerreno ?? '—'} m² ·
                    Construido {predio.areaConstruida ?? '—'} m²
                  </p>
                  {!activo && (
                    <p className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">DADO DE BAJA</p>
                  )}
                </div>
                {activo && (
                  <div className="flex flex-wrap gap-2">
                    {(['RECTIFICACION', 'COMPRA', 'VENTA', 'BAJA'] as const).map((m) => (
                      <Link
                        key={m}
                        to={`${RUTA_BASE}/predios/${predio.id}/declaracion?motivo=${m}`}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa ${
                          m === 'RECTIFICACION'
                            ? 'bg-mar-profundo text-white hover:brightness-110'
                            : 'border border-mar-profundo/30 text-mar-profundo hover:bg-mar/5'
                        }`}
                      >
                        DJ {etiquetaMotivo(m).toLowerCase()}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </header>

            <Seccion titulo="Titulares">
              {predio.contribuyentes.length === 0 ? (
                <Vacio texto="Sin titulares vigentes." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {predio.contribuyentes.map((t) => (
                    <li key={t.contribuyente.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <Link to={`${RUTA_BASE}/contribuyentes/${t.contribuyente.id}`} className="font-medium text-mar-profundo hover:underline">
                        {t.contribuyente.nombreCompleto}
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          {t.contribuyente.tipoDoc} {t.contribuyente.numDoc}
                        </span>
                      </Link>
                      <span className="font-semibold">{Number(t.porcentaje)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>

            <Seccion titulo="Construcción">
              {predio.pisos.length === 0 ? (
                <Vacio texto="Terreno sin construcción declarada." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                        <th scope="col" className="px-4 py-2">Nivel</th>
                        <th scope="col" className="px-4 py-2">Año</th>
                        <th scope="col" className="px-4 py-2">Clasificación</th>
                        <th scope="col" className="px-4 py-2">Material</th>
                        <th scope="col" className="px-4 py-2">Conservación</th>
                        <th scope="col" className="px-4 py-2" title={COMPONENTES_CORTOS.join(', ')}>
                          Categorías
                        </th>
                        <th scope="col" className="px-4 py-2 text-right">Área m²</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predio.pisos.map((p) => (
                        <tr key={p.id} className="border-b border-slate-100">
                          <td className="px-4 py-2">{p.nivel}</td>
                          <td className="px-4 py-2">{p.anioConstruccion ?? '—'}</td>
                          <td className="px-4 py-2">{etiqueta(CLASIFICACIONES, p.clasificacion)}</td>
                          <td className="px-4 py-2">{etiqueta(MATERIALES, p.material)}</td>
                          <td className="px-4 py-2">{etiqueta(ESTADOS_CONSERVACION, p.estadoConservacion)}</td>
                          <td className="px-4 py-2 font-mono tracking-widest">{p.categorias ?? '—'}</td>
                          <td className="px-4 py-2 text-right">{p.areaConstruida}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {predio.otrasInstalaciones.length > 0 && (
                <ul className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                  {predio.otrasInstalaciones.map((o) => (
                    <li key={o.id}>
                      {o.descripcion}
                      {o.cantidad && ` · ${o.cantidad} ${o.unidad ?? ''}`}
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>

            <Seccion titulo="Historial de declaraciones juradas">
              {!predio.declaraciones?.length ? (
                <Vacio texto="Sin declaraciones." />
              ) : (
                <ol className="divide-y divide-slate-100">
                  {predio.declaraciones.map((dj) => (
                    <li key={dj.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                      <span>
                        <span className="font-semibold text-mar-profundo">{etiquetaMotivo(dj.motivo)}</span>
                        <span className="text-slate-500"> · año {dj.anio} · por {dj.contribuyente.nombreCompleto}</span>
                        {dj.observacion && <span className="block text-xs text-slate-500">{dj.observacion}</span>}
                        {dj.extemporanea && <MultaDJ dj={dj} alCambiar={() => setRecarga((r) => r + 1)} />}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        DJ {dj.id} · {dj.fecha.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Seccion>
          </>
        )}
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl bg-white shadow-md ring-1 ring-mar-profundo/10" aria-label={titulo}>
      <h2 className="border-b border-slate-100 px-4 py-3 font-semibold text-mar-profundo">{titulo}</h2>
      {children}
    </section>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <p className="p-6 text-center text-sm text-slate-500">{texto}</p>
}
