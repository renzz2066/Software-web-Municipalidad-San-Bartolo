import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { CLASIFICACIONES, CONCEPTOS_ARBITRIO, ESTADOS_CONSERVACION, MATERIALES } from '../catalogosConstruccion'
import { Catalogo } from './Catalogo'
import { FormFraccionamiento } from './FormFraccionamiento'
import { TablaEditable, type Columna } from './TablaEditable'
import { mensajeError, type ResumenAnio, type Urbanizacion, type Via, type Zona } from './maestrosApi'

// Maestros de Rentas (specs/rentas-nucleo-v1.md, C4): parámetros por año + ubicación.
// Feriados y fraccionamiento: specs/rentas-valores-v1.md (decisiones 2 y 3).
// Fiscalizadores e infracciones: specs/rentas-fiscalizacion-v1.md (decisiones 2 y 5).

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = Array.from({ length: 8 }, (_, i) => ANIO_ACTUAL + 1 - i)

const PESTANAS = [
  { id: 'uit', titulo: 'UIT' },
  { id: 'escala', titulo: 'Escala predial' },
  { id: 'aranceles', titulo: 'Aranceles' },
  { id: 'valores', titulo: 'Valores unitarios' },
  { id: 'depreciacion', titulo: 'Depreciación' },
  { id: 'tarifas', titulo: 'Tarifas arbitrios' },
  { id: 'mora', titulo: 'TIM / IPM' },
  { id: 'fraccionamiento', titulo: 'Fraccionamiento' },
  { id: 'feriados', titulo: 'Feriados' },
  { id: 'fiscalizacion', titulo: 'Fiscalización' },
  { id: 'ubicacion', titulo: 'Ubicación' },
] as const

type PestanaId = (typeof PESTANAS)[number]['id']

const COMPONENTES = [
  ['MUROS_COLUMNAS', 'Muros y columnas'],
  ['TECHOS', 'Techos'],
  ['PISOS', 'Pisos'],
  ['PUERTAS_VENTANAS', 'Puertas y ventanas'],
  ['REVESTIMIENTOS', 'Revestimientos'],
  ['BANOS', 'Baños'],
  ['INSTALACIONES', 'Instalaciones eléctricas y sanitarias'],
].map(([value, label]) => ({ value, label }))

const CATEGORIAS = 'ABCDEFGHI'.split('').map((c) => ({ value: c, label: c }))

const COL_ESCALA: Columna[] = [
  { key: 'tramo', label: 'Tramo', tipo: 'numero', decimales: 0 },
  { key: 'desdeUit', label: 'Desde (UIT)', tipo: 'numero' },
  { key: 'hastaUit', label: 'Hasta (UIT)', tipo: 'numero', opcional: true, placeholder: 'Sin tope' },
  { key: 'tasa', label: 'Tasa (%)', tipo: 'numero', decimales: 4 },
]

const COL_VALORES: Columna[] = [
  { key: 'componente', label: 'Componente', tipo: 'select', opciones: COMPONENTES },
  { key: 'categoria', label: 'Categoría', tipo: 'select', opciones: CATEGORIAS },
  { key: 'valor', label: 'Valor (S/ por m²)', tipo: 'numero' },
]

const COL_DEPRECIACION: Columna[] = [
  { key: 'clasificacion', label: 'Clasificación', tipo: 'select', opciones: CLASIFICACIONES },
  { key: 'material', label: 'Material', tipo: 'select', opciones: MATERIALES },
  { key: 'antiguedadHasta', label: 'Antigüedad hasta (años)', tipo: 'numero', decimales: 0 },
  { key: 'estadoConservacion', label: 'Conservación', tipo: 'select', opciones: ESTADOS_CONSERVACION },
  { key: 'porcentaje', label: 'Depreciación (%)', tipo: 'numero' },
]

const COL_FERIADOS: Columna[] = [
  { key: 'fecha', label: 'Fecha', tipo: 'fecha' },
  { key: 'descripcion', label: 'Descripción', tipo: 'texto' },
]

const COL_INFRACCIONES: Columna[] = [
  { key: 'codigo', label: 'Código (art.num)', tipo: 'texto', placeholder: '176.1' },
  { key: 'descripcion', label: 'Infracción', tipo: 'texto' },
  {
    key: 'base',
    label: 'Base',
    tipo: 'select',
    opciones: [
      { value: 'UIT', label: '% de la UIT' },
      { value: 'TRIBUTO_OMITIDO', label: '% del tributo omitido' },
    ],
  },
  { key: 'porcentajeNatural', label: '% persona natural', tipo: 'numero' },
  { key: 'porcentajeJuridica', label: '% persona jurídica', tipo: 'numero' },
]

const COL_MORA: Columna[] = [
  { key: 'vigenciaDesde', label: 'Vigente desde', tipo: 'fecha' },
  { key: 'valor', label: 'Valor', tipo: 'numero', decimales: 5 },
  { key: 'ordenanza', label: 'Norma', tipo: 'texto', opcional: true },
]

export function Maestros() {
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [pestana, setPestana] = useState<PestanaId>('uit')
  const [resumen, setResumen] = useState<ResumenAnio | null>(null)
  const [zonas, setZonas] = useState<Zona[]>([])
  const [urbs, setUrbs] = useState<Urbanizacion[]>([])
  const [vias, setVias] = useState<Via[]>([])
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const refrescar = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    async function cargar() {
      setError(null)
      try {
        const [r, z, u, v] = await Promise.all([
          api.get<ResumenAnio>(`/rentas/maestros/resumen/${anio}`),
          api.get<Zona[]>('/rentas/maestros/zonas'),
          api.get<Urbanizacion[]>('/rentas/maestros/urbanizaciones'),
          api.get<Via[]>('/rentas/maestros/vias'),
        ])
        if (cancelled) return
        setResumen(r.data)
        setZonas(z.data)
        setUrbs(u.data)
        setVias(v.data)
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [anio, refreshKey])

  const colAranceles = useMemo<Columna[]>(
    () => [
      {
        key: 'viaId',
        label: 'Vía',
        tipo: 'select',
        opciones: vias.map((v) => ({ value: String(v.id), label: `${v.tipoVia} ${v.nombre}` })),
      },
      {
        key: 'urbanizacionId',
        label: 'Urbanización',
        tipo: 'select',
        opcional: true,
        placeholder: 'Todas',
        opciones: urbs.map((u) => ({ value: String(u.id), label: u.nombre })),
      },
      { key: 'valorM2', label: 'Arancel (S/ por m²)', tipo: 'numero' },
    ],
    [vias, urbs],
  )

  const colTarifas = useMemo<Columna[]>(
    () => [
      { key: 'concepto', label: 'Concepto', tipo: 'select', opciones: CONCEPTOS_ARBITRIO },
      {
        key: 'zonaId',
        label: 'Zona',
        tipo: 'select',
        opcional: true,
        placeholder: 'Todas',
        opciones: zonas.map((z) => ({ value: String(z.id), label: `${z.codigo} · ${z.nombre}` })),
      },
      { key: 'uso', label: 'Uso del predio', tipo: 'texto', opcional: true, placeholder: 'Todos' },
      { key: 'tasa', label: 'Monto anual (S/)', tipo: 'numero' },
    ],
    [zonas],
  )

  async function abrirAnio() {
    const hacia = anio + 1
    if (!window.confirm(`Se copiarán los parámetros de ${anio} a ${hacia} (solo las tablas vacías en ${hacia}). ¿Continuar?`)) {
      return
    }
    setAviso(null)
    setError(null)
    try {
      const { data } = await api.post<{ copiados: Record<string, number> }>('/rentas/maestros/abrir-anio', {
        desde: anio,
        hacia,
      })
      const total = Object.values(data.copiados).reduce((a, b) => a + b, 0)
      setAviso(`Año ${hacia} abierto: ${total} filas copiadas. Registra la UIT ${hacia} antes de calcular.`)
      setAnio(hacia)
    } catch (err) {
      setError(mensajeError(err))
    }
  }

  const bloqueado = resumen?.bloqueado ?? false

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/rentas"
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          Rentas
        </Link>

        <header className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
              >
                <i className="bi bi-table" />
              </span>
              <div>
                <h1 className="text-lg font-bold text-mar-profundo">Maestros de Rentas</h1>
                <p className="text-sm text-slate-500">Parámetros del año para calcular predial y arbitrios.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="anio" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Año fiscal
                </label>
                <select
                  id="anio"
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value))}
                  className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  {ANIOS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void abrirAnio()}
                className="rounded-md border border-mar-profundo/30 px-4 py-2 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <i aria-hidden="true" className="bi bi-calendar-plus mr-1" />
                Abrir año {anio + 1}
              </button>
            </div>
          </div>

          {resumen && (
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
              <Dato titulo="UIT" valor={resumen.uit ? `S/ ${resumen.uit.valor}` : 'Falta'} falta={!resumen.uit} />
              <Dato titulo="Tramos" valor={resumen.conteos.escalaPredial} falta={!resumen.conteos.escalaPredial} />
              <Dato titulo="Aranceles" valor={resumen.conteos.aranceles} falta={!resumen.conteos.aranceles} />
              <Dato titulo="Valores unit." valor={resumen.conteos.valoresUnitarios} falta={!resumen.conteos.valoresUnitarios} />
              <Dato titulo="Depreciación" valor={resumen.conteos.depreciaciones} falta={!resumen.conteos.depreciaciones} />
              <Dato titulo="Tarifas" valor={resumen.conteos.tarifasArbitrios} falta={!resumen.conteos.tarifasArbitrios} />
            </dl>
          )}
          {bloqueado && (
            <p role="status" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <i aria-hidden="true" className="bi bi-lock mr-1" />
              {anio} ya tiene deuda calculada: sus parámetros son de solo lectura.
            </p>
          )}
          {aviso && (
            <p role="status" className="mt-4 text-sm font-medium text-emerald-700">
              {aviso}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </header>

        <nav aria-label="Tablas de maestros" className="mt-6 flex gap-1 overflow-x-auto" role="tablist">
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
            </button>
          ))}
        </nav>

        <main role="tabpanel" className="rounded-b-xl rounded-tr-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          {pestana === 'uit' && <FormUit key={`${anio}-${resumen?.uit?.valor ?? ''}`} anio={anio} resumen={resumen} bloqueado={bloqueado} alGuardar={refrescar} />}
          {pestana === 'escala' && (
            <TablaEditable
              url={`/rentas/maestros/escala-predial/${anio}`}
              columnas={COL_ESCALA}
              bloqueado={bloqueado}
              ayuda="Tramos sobre la base imponible en UIT. D.L. 776: hasta 15 UIT 0.2%, de 15 a 60 UIT 0.6%, más de 60 UIT 1.0%."
              alGuardar={refrescar}
            />
          )}
          {pestana === 'aranceles' && (
            <TablaEditable
              url={`/rentas/maestros/aranceles/${anio}`}
              columnas={colAranceles}
              bloqueado={bloqueado}
              ayuda="Arancel urbano por vía. Si la vía cruza varias urbanizaciones con distinto valor, registra una fila por urbanización."
              alGuardar={refrescar}
            />
          )}
          {pestana === 'valores' && (
            <TablaEditable
              url={`/rentas/maestros/valores-unitarios/${anio}`}
              columnas={COL_VALORES}
              bloqueado={bloqueado}
              ayuda="Cuadro de valores unitarios oficiales de edificación (categorías A a I)."
              alGuardar={refrescar}
            />
          )}
          {pestana === 'depreciacion' && (
            <TablaEditable
              url={`/rentas/maestros/depreciaciones/${anio}`}
              columnas={COL_DEPRECIACION}
              bloqueado={bloqueado}
              ayuda="Porcentaje según clasificación, material, antigüedad (tope del rango) y estado de conservación."
              alGuardar={refrescar}
            />
          )}
          {pestana === 'tarifas' && (
            <TablaEditable
              url={`/rentas/maestros/tarifas-arbitrios/${anio}`}
              columnas={colTarifas}
              bloqueado={bloqueado}
              ayuda="Monto anual por predio. Zona o uso vacíos = aplica a todos; la tarifa más específica tiene prioridad al calcular."
              alGuardar={refrescar}
            />
          )}
          {pestana === 'mora' && (
            <div className="space-y-8">
              <section>
                <h2 className="mb-2 font-semibold text-mar-profundo">TIM (% mensual)</h2>
                <TablaEditable url="/rentas/maestros/tasas-mora/TIM" columnas={COL_MORA} conOrdenanza={false} />
              </section>
              <section>
                <h2 className="mb-2 font-semibold text-mar-profundo">IPM (índice del mes)</h2>
                <TablaEditable
                  url="/rentas/maestros/tasas-mora/IPM"
                  columnas={COL_MORA}
                  conOrdenanza={false}
                  ayuda="Se usa para reajustar las cuotas 2 a 4 del predial."
                />
              </section>
            </div>
          )}
          {pestana === 'fraccionamiento' && <FormFraccionamiento key={anio} anio={anio} />}
          {pestana === 'feriados' && (
            <TablaEditable
              url={`/rentas/maestros/feriados/${anio}`}
              columnas={COL_FERIADOS}
              conOrdenanza={false}
              ayuda={`Feriados de ${anio} para contar días hábiles (plazo de reclamo de una RD). Sábados y domingos ya se descuentan solos.`}
            />
          )}
          {pestana === 'fiscalizacion' && (
            <div className="space-y-8">
              <Catalogo
                titulo="Fiscalizadores"
                url="/rentas/maestros/fiscalizadores"
                campos={[
                  { key: 'nombre', label: 'Apellidos y nombres', maxLength: 100 },
                  { key: 'dni', label: 'DNI / CE', maxLength: 12 },
                ]}
                interruptor={{ key: 'activo', label: 'Activo' }}
              />
              <section>
                <h2 className="mb-2 font-semibold text-mar-profundo">Infracciones y multas {anio}</h2>
                <TablaEditable
                  url={`/rentas/maestros/infracciones/${anio}`}
                  columnas={COL_INFRACCIONES}
                  ayuda="Código Tributario arts. 176 y 178. La multa es el % de la UIT del año o del tributo omitido; la sucesión usa el % de persona natural. Una infracción ya usada en una resolución de multa no se puede quitar."
                />
              </section>
            </div>
          )}
          {pestana === 'ubicacion' && (
            <div className="grid gap-8 lg:grid-cols-3">
              <Catalogo
                titulo="Zonas"
                url="/rentas/maestros/zonas"
                campos={[
                  { key: 'codigo', label: 'Código', maxLength: 5 },
                  { key: 'nombre', label: 'Nombre', maxLength: 100 },
                ]}
                alCambiar={refrescar}
              />
              <Catalogo
                titulo="Urbanizaciones"
                url="/rentas/maestros/urbanizaciones"
                campos={[
                  { key: 'codigo', label: 'Código', maxLength: 10 },
                  { key: 'nombre', label: 'Nombre', maxLength: 100 },
                ]}
                alCambiar={refrescar}
              />
              <Catalogo
                titulo="Vías"
                url="/rentas/maestros/vias"
                campos={[
                  { key: 'tipoVia', label: 'Tipo', maxLength: 10 },
                  { key: 'nombre', label: 'Nombre', maxLength: 100 },
                ]}
                alCambiar={refrescar}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function Dato({ titulo, valor, falta }: { titulo: string; valor: string | number; falta: boolean }) {
  return (
    <div className={`rounded-md px-3 py-2 ${falta ? 'bg-red-50 text-red-800' : 'bg-mar-profundo/5 text-mar-profundo'}`}>
      <dt className="text-xs uppercase tracking-wider opacity-70">{titulo}</dt>
      <dd className="font-semibold">{falta ? 'Falta' : valor}</dd>
    </div>
  )
}

function FormUit({
  anio,
  resumen,
  bloqueado,
  alGuardar,
}: {
  anio: number
  resumen: ResumenAnio | null
  bloqueado: boolean
  alGuardar: () => void
}) {
  const [valor, setValor] = useState(resumen?.uit?.valor ?? '')
  const [derechoEmision, setDerechoEmision] = useState(resumen?.uit?.derechoEmision ?? '0')
  const [ordenanza, setOrdenanza] = useState(resumen?.uit?.ordenanza ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(valor)
    if (Number(derechoEmision) < 0) {
      setMensaje({ ok: false, texto: 'El derecho de emisión no puede ser negativo' })
      return
    }
    if (!valor || !Number.isFinite(n) || n <= 0) {
      setMensaje({ ok: false, texto: 'Ingresa un valor de UIT mayor que 0' })
      return
    }
    setIsSaving(true)
    setMensaje(null)
    try {
      await api.put(`/rentas/maestros/uit/${anio}`, {
        valor: n,
        derechoEmision: Number(derechoEmision) || 0,
        ordenanza: ordenanza.trim() || undefined,
      })
      setMensaje({ ok: true, texto: 'UIT guardada.' })
      alGuardar()
    } catch (err) {
      setMensaje({ ok: false, texto: mensajeError(err) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void guardar(e)} className="grid max-w-xl gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="uit-valor" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          UIT {anio} (S/)
        </label>
        <input
          id="uit-valor"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={valor}
          disabled={bloqueado || isSaving}
          onChange={(e) => setValor(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="uit-emision" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Derecho de emisión (S/ por contribuyente)
        </label>
        <input
          id="uit-emision"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={derechoEmision}
          disabled={bloqueado || isSaving}
          onChange={(e) => setDerechoEmision(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100"
        />
      </div>
      <div>
        <label htmlFor="uit-ord" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Norma (D.S.)
        </label>
        <input
          id="uit-ord"
          value={ordenanza}
          maxLength={60}
          disabled={bloqueado || isSaving}
          onChange={(e) => setOrdenanza(e.target.value)}
          placeholder="Ej. D.S. N° 260-2025-EF"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa disabled:bg-slate-100"
        />
      </div>
      <div className="sm:col-span-2">
        {mensaje && (
          <p role={mensaje.ok ? 'status' : 'alert'} className={`mb-3 text-sm font-medium ${mensaje.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {mensaje.texto}
          </p>
        )}
        <button
          type="submit"
          disabled={bloqueado || isSaving}
          className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
        >
          {isSaving ? 'Guardando…' : 'Guardar UIT'}
        </button>
      </div>
    </form>
  )
}
