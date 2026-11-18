import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { useAuth } from '../../../context/AuthContext'
import { api } from '../../../lib/api'
import { nombreDe, useCatalogo } from '../catalogos/catalogosApi'
import { mensajeError } from '../maestros/maestrosApi'
import { ESTILO_ESTADO, ETIQUETA_ESTADO, RUTA_BASE, documentoTexto } from '../contribuyentes/tipos'
import { EditorDireccion } from './EditorDireccion'
import { RUTA_DIRECCIONES, SUPERVISION, type DireccionDetalle } from './direccionesApi'

// Ficha de una dirección única (D01–D05): datos, quiénes la usan y, para un supervisor, editar o
// dar de baja. Sin :id es el alta.
export function FichaDireccion() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const supervisa = SUPERVISION.includes(user?.rol ?? '')
  const tipos = useCatalogo('COMPONENTE_DIRECCION')
  const [d, setD] = useState<DireccionDetalle | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const [recarga, setRecarga] = useState(0)
  const cargar = () => setRecarga((n) => n + 1)

  useEffect(() => {
    if (!id) return
    let vivo = true
    async function traer() {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await api.get<DireccionDetalle>(`/direcciones/${id}`)
        if (vivo) setD(data)
      } catch (err) {
        if (vivo) setError(mensajeError(err))
      } finally {
        if (vivo) setIsLoading(false)
      }
    }
    void traer()
    return () => {
      vivo = false
    }
  }, [id, recarga])

  async function cambiarEstado(activo: boolean) {
    if (!d) return
    setOcupado(true)
    setError(null)
    try {
      const { data } = await api.patch<DireccionDetalle>(`/direcciones/${d.id}/estado`, { activo })
      setD(data)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setOcupado(false)
    }
  }

  if (!id) {
    return (
      <div className="p-4 sm:p-8">
        <div className="mx-auto max-w-content">
          <PageHeader titulo="Nueva dirección" volverA={{ etiqueta: 'Direcciones', ruta: RUTA_DIRECCIONES }} />
          <main className="mt-4 rounded-panel border border-borde bg-white p-6">
            <EditorDireccion
              alGuardar={(nueva) => navigate(`${RUTA_DIRECCIONES}/${nueva.id}`)}
              alCancelar={() => navigate(RUTA_DIRECCIONES)}
              alUsarExistente={(existente) => navigate(`${RUTA_DIRECCIONES}/${existente}`)}
            />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo={d?.direccion ?? 'Dirección'}
          descripcion={d?.referencia ? `Ref.: ${d.referencia}` : undefined}
          volverA={{ etiqueta: 'Direcciones', ruta: RUTA_DIRECCIONES }}
          accion={supervisa && d && !editando ? { etiqueta: 'Editar dirección', icono: 'bi bi-pencil', onClick: () => setEditando(true) } : undefined}
        />

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-500" role="status">
            Cargando…
          </p>
        ) : !d ? (
          <p role="alert" className="mt-6 text-sm font-medium text-ladrillo">
            {error ?? 'La dirección no existe.'}
          </p>
        ) : (
          <>
            <main className="mt-4 rounded-panel border border-borde bg-white p-6">
              {editando ? (
                <EditorDireccion
                  inicial={d}
                  alGuardar={() => {
                    setEditando(false)
                    cargar()
                  }}
                  alCancelar={() => setEditando(false)}
                  alUsarExistente={(existente) => navigate(`${RUTA_DIRECCIONES}/${existente}`)}
                />
              ) : (
                <dl className="grid gap-4 text-sm sm:grid-cols-3">
                  <Dato etiqueta="Distrito" valor={d.distrito ? `${d.distrito.departamento} / ${d.distrito.provincia} / ${d.distrito.distrito} (${d.ubigeo})` : d.ubigeo} />
                  <Dato etiqueta="Sector" valor={d.zona ? `${d.zona.codigo} · ${d.zona.nombre}` : '—'} />
                  <Dato etiqueta="Habilitación urbana" valor={d.urbanizacion?.nombre ?? '—'} />
                  <Dato etiqueta="Vía" valor={d.via ? `${d.via.tipoVia} ${d.via.nombre}` : '—'} />
                  <Dato
                    etiqueta="Componentes"
                    valor={d.componentes.map((c) => `${nombreDe(tipos, c.componente)}: ${c.valor}`).join(' · ') || '—'}
                  />
                  <Dato etiqueta="Coordenadas" valor={d.latitud && d.longitud ? `${d.latitud}, ${d.longitud}` : '—'} />
                  <Dato etiqueta="Estado" valor={d.activo ? 'Activa' : 'Dada de baja: no se asigna a nadie nuevo'} />
                </dl>
              )}
              {error && (
                <p role="alert" className="mt-4 text-sm font-medium text-ladrillo">
                  {error}
                </p>
              )}
              {supervisa && !editando && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void cambiarEstado(!d.activo)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40 ${
                      d.activo ? 'border-ladrillo/40 text-ladrillo hover:bg-ladrillo/5' : 'border-mar-profundo/30 text-mar-profundo hover:bg-mar/5'
                    }`}
                  >
                    {d.activo ? 'Dar de baja' : 'Reactivar'}
                  </button>
                  <p className="mt-1 text-xs text-slate-500">
                    {d.activo ? 'Quien ya la tiene la conserva; no se podrá elegir para nadie más.' : 'Vuelve a estar disponible para elegirla.'}
                  </p>
                </div>
              )}
            </main>

            <section className="mt-6 rounded-panel border border-borde bg-white" aria-labelledby="personas-direccion">
              <h2 id="personas-direccion" className="px-4 pt-4 font-serif text-lg font-semibold text-mar-profundo">
                Personas con este domicilio fiscal
              </h2>
              {d.contribuyentes.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Nadie la usa todavía.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {d.contribuyentes.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`${RUTA_BASE}/contribuyentes/${c.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
                      >
                        <span>
                          <span className="font-medium text-mar-profundo">{c.nombreCompleto}</span>
                          <span className="ml-2 font-mono text-xs text-slate-500">{documentoTexto(c)}</span>
                        </span>
                        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${ESTILO_ESTADO[c.estado]}`}>{ETIQUETA_ESTADO[c.estado]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="px-4 py-3 text-xs text-slate-500">
                {d._count.contribuyentes} persona{d._count.contribuyentes === 1 ? '' : 's'}
                {d._count.contribuyentes > d.contribuyentes.length ? ` (se muestran ${d.contribuyentes.length})` : ''}
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{etiqueta}</dt>
      <dd className="mt-1 text-slate-800">{valor}</dd>
    </div>
  )
}
