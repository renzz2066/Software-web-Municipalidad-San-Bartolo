import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { Bloque, Campo, CamposPredio } from '../predios/DatosPredioCampos'
import { CLASE, errorConstruccion, formDesdePredio, payloadConstruccion, predioDeFicha } from '../predios/predioForm'
import { direccion, type Catalogos } from '../predios/tipos'
import { type Expediente, RUTA_EXPEDIENTES, useExpediente } from './fiscalizacionApi'

// Ficha de inspección de un predio (specs/rentas-fiscalizacion-v1.md, F3): el mismo formulario de la
// DJ, precargado con lo declarado (o con la ficha ya guardada). No cambia el predio: eso lo hace la
// resolución del expediente con una DJ de motivo FISCALIZACION.

function Formulario({ expediente, predioId, catalogos }: { expediente: Expediente; predioId: number; catalogos: Catalogos | null }) {
  const navigate = useNavigate()
  const fila = expediente.predios.find((p) => p.predioId === predioId)!
  const inicial = formDesdePredio(fila.ficha ? predioDeFicha(fila.ficha) : fila.predio)
  const [datos, setDatos] = useState(inicial.datos)
  const [pisos, setPisos] = useState(inicial.pisos)
  const [instalaciones, setInstalaciones] = useState(inicial.instalaciones)
  const [observacion, setObservacion] = useState(fila.ficha?.observacion ?? '')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const volver = `${RUTA_EXPEDIENTES}/${expediente.id}`

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const v = errorConstruccion(datos, pisos)
    if (v) return setError(v)
    setGuardando(true)
    setError(null)
    try {
      await api.put(`/rentas/fiscalizacion/expedientes/${expediente.id}/fichas/${predioId}`, {
        ...payloadConstruccion(datos, pisos, instalaciones),
        observacion: observacion.trim() || undefined,
      })
      navigate(volver)
    } catch (err) {
      setError(mensajeError(err))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={(e) => void guardar(e)} noValidate className="mt-3 space-y-6">
      <Bloque titulo={`Ficha de inspección · ${direccion(fila.predio)}`}>
        <p className="text-sm text-slate-600">
          Expediente FIS {expediente.numero} · {expediente.contribuyente.nombreCompleto}. Registra lo verificado en la inspección
          {expediente.inspeccion ? ` del ${expediente.inspeccion.fecha}` : ''}; se parte de lo declarado.
          {!fila.ficha && ' Corrige solo lo que difiera.'}
        </p>
      </Bloque>
      <CamposPredio
        catalogos={catalogos}
        datos={datos}
        setDatos={setDatos}
        pisos={pisos}
        setPisos={setPisos}
        instalaciones={instalaciones}
        setInstalaciones={setInstalaciones}
      />
      <Bloque titulo="Observaciones de la inspección">
        <Campo id="ficha-obs" label="Lo observado en campo (opcional)">
          <textarea id="ficha-obs" rows={3} maxLength={500} value={observacion} onChange={(e) => setObservacion(e.target.value)} className={CLASE} />
        </Campo>
      </Bloque>
      <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
        {error && (
          <p role="alert" className="mb-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : 'Guardar ficha'}
          </button>
          <Link to={volver} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  )
}

export function FichaInspeccion() {
  const { id, predioId } = useParams()
  const { expediente, error } = useExpediente(id)
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<Catalogos>('/predios/catalogos')
      .then(({ data }) => {
        if (!cancelled) setCatalogos(data)
      })
      .catch(() => {
        // Sin catálogos los selectores quedan vacíos; el error real lo mostrará el guardado.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fila = expediente?.predios.find((p) => p.predioId === Number(predioId))
  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to={`${RUTA_EXPEDIENTES}/${id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Expediente
        </Link>
        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : !expediente ? (
          <p role="status" className="mt-4 text-sm text-slate-500">
            Cargando expediente…
          </p>
        ) : !fila ? (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            El predio no forma parte de este expediente.
          </p>
        ) : expediente.estado !== 'ABIERTO' && expediente.estado !== 'INSPECCIONADO' ? (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            El expediente está {expediente.estado.toLowerCase()}: la ficha ya no se puede modificar.
          </p>
        ) : (
          <Formulario expediente={expediente} predioId={fila.predioId} catalogos={catalogos} />
        )}
      </div>
    </div>
  )
}
