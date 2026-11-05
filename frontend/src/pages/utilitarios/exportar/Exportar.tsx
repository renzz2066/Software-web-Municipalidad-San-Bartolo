import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { hoyLocal } from '../../../lib/fechas'
import { aCsv, descargarCsv, nombreArchivo, type ColumnaCsv } from '../../../lib/exportarCsv'
import { mensajeUtilidad } from '../utilitariosApi'
import { AnioCampo } from '../utilitariosUi'
import { Glosario } from './Glosario'

// D1 + D3: exportar listados a CSV y glosario (specs/utilitarios-v1.md, U6).
// Cada dataset pide sus propios GET; un 403 se pinta como «Sin acceso» en esa fila.

interface Dataset {
  id: string
  titulo: string
  ayuda: string
  icono: string
  columnas: ColumnaCsv[]
  /** Si pide año o fecha, aparece el campo. */
  campo?: 'anio' | 'fecha'
  pedir: (p: { anio: number; fecha: string }) => Promise<Record<string, unknown>[]>
}

/** Mapa clave del objeto → título legible de la columna. */
const columnas = (mapa: Record<string, string>): ColumnaCsv[] =>
  Object.entries(mapa).map(([clave, titulo]) => ({ clave, titulo }))

/** Consume todas las páginas de un listado paginado, con tope de seguridad. */
async function paginar<T>(url: string, params: Record<string, unknown>, maxPaginas = 20): Promise<T[]> {
  const TAM = 50
  const todas: T[] = []
  let pagina = 1
  let total = Infinity
  while (pagina <= maxPaginas && todas.length < total) {
    const { data } = await api.get<{ items: T[]; total: number }>(url, { params: { ...params, page: pagina, pageSize: TAM } })
    total = data.total
    todas.push(...data.items)
    if (data.items.length === 0) break
    pagina++
  }
  return todas
}

const DATASETS: Dataset[] = [
  {
    id: 'contribuyentes',
    titulo: 'Contribuyentes',
    ayuda: 'Registro tributario completo (máx. 1 000 filas).',
    icono: 'bi-people',
    columnas: columnas({
      tipoPersona: 'Tipo de persona',
      tipoDoc: 'Tipo doc',
      numDoc: 'N° doc',
      nombreCompleto: 'Nombre',
      direccionFiscal: 'Dirección',
      estado: 'Estado',
    }),
    pedir: async () => {
      const filas = await paginar<Record<string, unknown>>('/contribuyentes', {}, 20)
      return filas.map((c) => ({
        tipoPersona: c.tipoPersona,
        tipoDoc: c.tipoDoc,
        numDoc: c.numDoc,
        nombreCompleto: c.nombreCompleto,
        direccionFiscal: c.direccionFiscal ?? '',
        estado: c.estado,
      }))
    },
  },
  {
    id: 'recibos',
    titulo: 'Recibos de caja',
    ayuda: 'Recibos cobrados en una fecha.',
    icono: 'bi-receipt',
    campo: 'fecha',
    columnas: columnas({
      numero: 'N° recibo',
      fechaCaja: 'Fecha',
      contribuyente: 'Contribuyente',
      numDoc: 'N° doc',
      medioPago: 'Medio de pago',
      estado: 'Estado',
      total: 'Total',
      cajero: 'Cajero',
    }),
    pedir: async ({ fecha }) => {
      const { data } = await api.get<
        { numero: string; fechaCaja: string; total: string; medioPago: string; estado: string; cajero: string; contribuyente: { numDoc: string; nombreCompleto: string } }[]
      >('/caja/recibos', { params: { fecha } })
      return data.map((r) => ({
        numero: r.numero,
        fechaCaja: r.fechaCaja,
        contribuyente: r.contribuyente.nombreCompleto,
        numDoc: r.contribuyente.numDoc,
        medioPago: r.medioPago,
        estado: r.estado,
        total: r.total,
        cajero: r.cajero,
      }))
    },
  },
  {
    id: 'feriados',
    titulo: 'Feriados del año',
    ayuda: 'Días no hábiles registrados en Maestros.',
    icono: 'bi-calendar3',
    campo: 'anio',
    columnas: columnas({ fecha: 'Fecha', descripcion: 'Descripción' }),
    pedir: async ({ anio }) => {
      const { data } = await api.get<{ fecha: string; descripcion: string }[]>(`/rentas/maestros/feriados/${anio}`)
      return data.map((f) => ({ fecha: f.fecha.slice(0, 10), descripcion: f.descripcion }))
    },
  },
  {
    id: 'tasas',
    titulo: 'Series IPM y TIM',
    ayuda: 'Tasas de reajuste e interés moratorio vigentes.',
    icono: 'bi-graph-up',
    columnas: columnas({ tipo: 'Serie', vigenciaDesde: 'Vigente desde', valor: 'Valor (%)', ordenanza: 'Ordenanza' }),
    pedir: async () => {
      const [tim, ipm] = await Promise.all([
        api.get<{ tipo: string; vigenciaDesde: string; valor: string; ordenanza: string | null }[]>('/rentas/maestros/tasas-mora/TIM'),
        api.get<{ tipo: string; vigenciaDesde: string; valor: string; ordenanza: string | null }[]>('/rentas/maestros/tasas-mora/IPM'),
      ])
      return [...tim.data, ...ipm.data].map((t) => ({
        tipo: t.tipo,
        vigenciaDesde: t.vigenciaDesde.slice(0, 10),
        valor: t.valor,
        ordenanza: t.ordenanza ?? '',
      }))
    },
  },
  {
    id: 'infracciones',
    titulo: 'Infracciones del año',
    ayuda: 'Cuadro de infracciones sancionables del año.',
    icono: 'bi-exclamation-octagon',
    campo: 'anio',
    columnas: columnas({
      codigo: 'Código',
      articulo: 'Artículo',
      numeral: 'Numeral',
      descripcion: 'Descripción',
      base: 'Base',
      porcentajeNatural: '% Persona natural',
      porcentajeJuridica: '% Persona jurídica',
    }),
    pedir: async ({ anio }) => {
      const { data } = await api.get<
        { codigo: string; articulo: string; numeral: string; descripcion: string; base: string; porcentajeNatural: string; porcentajeJuridica: string }[]
      >(`/rentas/maestros/infracciones/${anio}`)
      return data
    },
  },
  {
    id: 'fiscalizadores',
    titulo: 'Fiscalizadores',
    ayuda: 'Maestro de inspectores disponibles.',
    icono: 'bi-person-badge',
    columnas: columnas({ nombre: 'Nombre', dni: 'DNI', activo: 'Activo' }),
    pedir: async () => {
      const { data } = await api.get<{ nombre: string; dni: string; activo: boolean }[]>('/rentas/maestros/fiscalizadores')
      return data.map((f) => ({ ...f, activo: f.activo ? 'Sí' : 'No' }))
    },
  },
]

function FilaExport({ dataset, anio, fecha }: { dataset: Dataset; anio: number; fecha: string }) {
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function exportar() {
    setCargando(true)
    setMensaje(null)
    try {
      const filas = await dataset.pedir({ anio, fecha })
      if (filas.length === 0) {
        setMensaje('Sin datos para exportar.')
        return
      }
      descargarCsv(nombreArchivo(dataset.titulo, `-${dataset.campo === 'anio' ? anio : fecha}`), aCsv(filas, dataset.columnas))
      setMensaje(`Descargado: ${filas.length} fila(s).`)
    } catch (err) {
      setMensaje(mensajeUtilidad(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-mar-profundo">
          <i aria-hidden="true" className={`bi ${dataset.icono}`} />
          {dataset.titulo}
        </p>
        <p className="text-xs text-slate-500">{dataset.ayuda}</p>
        {mensaje && (
          <p role={mensaje.startsWith('Descargado') ? 'status' : 'alert'} className="mt-1 text-xs font-medium text-slate-600">
            {mensaje}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void exportar()}
        disabled={cargando}
        className="shrink-0 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
      >
        {cargando ? 'Generando…' : 'Descargar CSV'}
      </button>
    </li>
  )
}

const PESTANAS = [
  { id: 'csv', titulo: 'Exportar CSV' },
  { id: 'glosario', titulo: 'Glosario' },
] as const

export function Exportar() {
  const [params, setParams] = useSearchParams()
  const pestana = params.get('tab') === 'glosario' ? 'glosario' : 'csv'
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [fecha, setFecha] = useState(() => hoyLocal())

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/utilitarios"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Utilitarios
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
            >
              <i className="bi bi-file-earmark-spreadsheet" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Exportación de Datos</h1>
              <p className="text-sm text-slate-500">
                Descarga listados en CSV (Excel los abre con acentos y sin separar mal las columnas) y consulta el glosario.
              </p>
            </div>
          </div>
        </header>

        <nav aria-label="Secciones" role="tablist" className="mt-6 flex gap-1 overflow-x-auto">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setParams({ tab: p.id })}
              className={`whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa ${
                pestana === p.id ? 'bg-white text-mar-profundo shadow-sm' : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              {p.titulo}
            </button>
          ))}
        </nav>

        <main role="tabpanel" className="rounded-b-xl rounded-tr-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          {pestana === 'glosario' ? (
            <Glosario />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end gap-4">
                <AnioCampo id="exp-anio" valor={anio} alCambiar={setAnio} />
                <div>
                  <label htmlFor="exp-fecha" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Fecha de caja
                  </label>
                  <input
                    id="exp-fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa sm:w-44"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Los campos de arriba alimentan a las filas que los necesitan. Cada fila usa el permiso del módulo origen.
              </p>

              <ul className="divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
                {DATASETS.map((d) => (
                  <FilaExport key={d.id} dataset={d} anio={anio} fecha={fecha} />
                ))}
              </ul>

              <p className="text-xs text-slate-500">
                El archivo se genera en tu navegador (BOM UTF-8 y separador <code>;</code>). No se envía nada al servidor.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
