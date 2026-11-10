import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import {
  RUTA_BASE,
  TIPOS_DOC,
  TIPOS_PERSONA,
  UBIGEO_DEFECTO,
  errorDocumento,
  formatoConsultable,
  type Catalogos,
  type Contribuyente,
  type ContribuyenteResumen,
  type ConsultaIdentidad,
  type EstadoRegistro,
  type TipoPersona,
  type Ubigeo,
} from './tipos'

// Alta y edición de contribuyente (C1). Con :id edita; sin :id crea.
// Bloques alineados a SIMUN (frmcontribuyentes_rentas Form2): "Datos Generales" —con cónyuge y
// representante legal, ambos opcionales— y "Datos Domicilio Fiscal", donde el ubigeo es lo único
// obligatorio. Ver specs/contribuyente-domicilio-representante-v1.md.
// El botón "Buscar datos" consulta el padrón de identidad: specs/consulta-identidad-v1.md.

interface Form {
  tipoPersona: TipoPersona
  tipoDoc: string
  numDoc: string
  nombreCompleto: string
  telefono: string
  celular: string
  email: string
  conyugeNombre: string
  conyugeNumDoc: string
  representanteNombre: string
  representanteNumDoc: string
  representanteDireccion: string
  ubigeo: string
  departamento: string
  provincia: string
  distrito: string
  zonaId: string
  urbanizacionId: string
  viaId: string
  numero: string
  interior: string
  manzana: string
  lote: string
  referencia: string
  estado: EstadoRegistro
}

const VACIO: Form = {
  tipoPersona: 'NATURAL',
  tipoDoc: 'DNI',
  numDoc: '',
  nombreCompleto: '',
  telefono: '',
  celular: '',
  email: '',
  conyugeNombre: '',
  conyugeNumDoc: '',
  representanteNombre: '',
  representanteNumDoc: '',
  representanteDireccion: '',
  ubigeo: UBIGEO_DEFECTO,
  departamento: '',
  provincia: '',
  distrito: '',
  zonaId: '',
  urbanizacionId: '',
  viaId: '',
  numero: '',
  interior: '',
  manzana: '',
  lote: '',
  referencia: '',
  estado: 'ACTIVO',
}

type Errores = Partial<Record<keyof Form, string>>

// Estado del botón "Buscar datos" y lo que se cuenta debajo.
interface EstadoConsulta {
  estado: 'idle' | 'consultando' | 'ok' | 'propia' | 'noEncontrado' | 'error'
  mensaje: string | null
  datos: ConsultaIdentidad | null
  // Qué campos escribió el botón, ya en frase para el aviso ("el nombre", "el ubigeo").
  completado: string[]
  // Verdadero si pisó valores que ya estaban: el documento cambió desde la última consulta.
  sobrescribio: boolean
}

const CONSULTA_IDLE: EstadoConsulta = {
  estado: 'idle',
  mensaje: null,
  datos: null,
  completado: [],
  sobrescribio: false,
}

function validar(f: Form, ubigeoResuelto: Ubigeo | null): Errores {
  const e: Errores = {}
  const doc = errorDocumento(f.tipoDoc, f.numDoc, f.tipoPersona)
  if (doc) e.numDoc = doc
  if (!f.nombreCompleto.trim()) e.nombreCompleto = 'El nombre o razón social es obligatorio'
  // Obligatorio en SIMUN: "Obligatorio: Falta Ingresar el Codigo Postal".
  if (!f.ubigeo) e.ubigeo = 'El ubigeo es obligatorio'
  else if (!/^\d{6}$/.test(f.ubigeo)) e.ubigeo = 'El ubigeo tiene 6 dígitos'
  else if (!ubigeoResuelto) e.ubigeo = 'El ubigeo no corresponde a un distrito registrado'
  if (f.celular && !/^9\d{8}$/.test(f.celular)) e.celular = 'El celular debe tener 9 dígitos y empezar en 9'
  if (f.telefono && !/^[0-9+\-\s]{6,15}$/.test(f.telefono)) e.telefono = 'Teléfono no válido'
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Correo no válido'
  if (f.conyugeNumDoc && !/^\d{8}$/.test(f.conyugeNumDoc)) e.conyugeNumDoc = 'El DNI debe tener 8 dígitos'
  if (f.representanteNumDoc && !/^\d{8}$/.test(f.representanteNumDoc)) e.representanteNumDoc = 'El DNI debe tener 8 dígitos'
  return e
}

async function buscarUbigeo(codigo: string): Promise<Ubigeo | null> {
  if (!/^\d{6}$/.test(codigo)) return null
  const { data } = await api.get<{ items: Ubigeo[] }>('/contribuyentes/ubigeos', {
    params: { q: codigo, limit: 50 },
  })
  return data.items.find((u) => u.codigo === codigo) ?? null
}

// Misma línea que arma el backend y que ven recibos, OP/RD y estado de cuenta.
function componerDireccionFiscal(f: Form, ubi: Ubigeo | null, catalogos: Catalogos | null): string {
  const via = catalogos?.vias.find((v) => String(v.id) === f.viaId)
  const urb = catalogos?.urbanizaciones.find((u) => String(u.id) === f.urbanizacionId)
  const partes: string[] = []
  if (via) partes.push(`${via.tipoVia} ${via.nombre}`.replace(/\s+/g, ' ').trim())
  if (f.numero) partes.push(`N° ${f.numero}`)
  if (f.interior) partes.push(`Dpto. ${f.interior}`)
  if (f.manzana) partes.push(`Mz. ${f.manzana}`)
  if (f.lote) partes.push(`Lt. ${f.lote}`)
  if (urb) partes.push(urb.nombre)
  if (partes.length === 0) return ''
  return `${partes.join(' ')}${ubi ? `, ${ubi.distrito}` : ''}`.slice(0, 150)
}

// Errores del endpoint de identidad: se muestra el mensaje del backend (400/401/403/429/502/503)
// y solo si no viene ninguno se usa uno genérico.
function estadoDeError(err: unknown): EstadoConsulta {
  const fallo = (estado: EstadoConsulta['estado'], mensaje: string): EstadoConsulta => ({
    estado,
    mensaje,
    datos: null,
    completado: [],
    sobrescribio: false,
  })
  if (isAxiosError(err)) {
    const message = err.response?.data?.message
    const texto = typeof message === 'string' && message ? message : null
    if (err.response?.status === 404) {
      return fallo('noEncontrado', texto ?? 'El documento no existe en el padrón de identidad')
    }
    if (texto) return fallo('error', texto)
  }
  return fallo('error', 'No se pudo consultar el padrón de identidad. Intenta nuevamente.')
}

export function ContribuyenteForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(VACIO)
  const [errores, setErrores] = useState<Errores>({})
  const [isLoading, setIsLoading] = useState(editando)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [ubigeoResuelto, setUbigeoResuelto] = useState<Ubigeo | null>(null)
  const [opcionesUbigeo, setOpcionesUbigeo] = useState<Ubigeo[]>([])
  const [consulta, setConsulta] = useState<EstadoConsulta>(CONSULTA_IDLE)
  const ultimoUbigeo = useRef<string>('')
  // Documento que se está consultando: si el funcionario sigue escribiendo, la respuesta se descarta.
  const docConsultado = useRef<string | null>(null)
  // Documento (tipo:número) con el que el botón rellenó por última vez. Es lo que permite
  // distinguir "vuelvo a consultar lo mismo" (no se pisa nada) de "cambió el documento"
  // (los datos de antes ya no corresponden y se sobreescriben).
  const docRelleno = useRef<string | null>(null)
  // Valor de ubigeo que puso el botón: solo se pisa si sigue exactamente igual.
  const ubigeoRelleno = useRef<string | null>(null)
  // Copia vigente del formulario. La consulta es asíncrona y el closure conserva el valor del
  // render en que se lanzó; sin esto se decidiría con datos viejos.
  const formRef = useRef(form)
  formRef.current = form

  // Catálogos de zona, urbanización y vía (los mismos que usa el formulario de predios).
  useEffect(() => {
    let cancelled = false
    api
      .get<Catalogos>('/predios/catalogos')
      .then(({ data }) => {
        if (!cancelled) setCatalogos(data)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los catálogos de ubicación.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<Contribuyente>(`/contribuyentes/${id}`)
        if (cancelled) return
        setForm({
          tipoPersona: data.tipoPersona,
          tipoDoc: data.tipoDoc,
          numDoc: data.numDoc,
          nombreCompleto: data.nombreCompleto,
          telefono: data.telefono ?? '',
          celular: data.celular ?? '',
          email: data.email ?? '',
          conyugeNombre: data.conyugeNombre ?? '',
          conyugeNumDoc: data.conyugeNumDoc ?? '',
          representanteNombre: data.representanteNombre ?? '',
          representanteNumDoc: data.representanteNumDoc ?? '',
          representanteDireccion: data.representanteDireccion ?? '',
          ubigeo: data.ubigeo ?? UBIGEO_DEFECTO,
          departamento: '',
          provincia: '',
          distrito: '',
          zonaId: data.zonaId ? String(data.zonaId) : '',
          urbanizacionId: data.urbanizacionId ? String(data.urbanizacionId) : '',
          viaId: data.viaId ? String(data.viaId) : '',
          numero: data.numero ?? '',
          interior: data.interior ?? '',
          manzana: data.manzana ?? '',
          lote: data.lote ?? '',
          referencia: data.referencia ?? '',
          estado: data.estado,
        })
      } catch (err) {
        if (!cancelled) setError(mensajeError(err))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [id])

  // Resuelve el ubigeo (cargado o escrito) a departamento/provincia/distrito.
  async function resolver(codigo: string): Promise<Ubigeo | null> {
    try {
      const ubi = await buscarUbigeo(codigo)
      setUbigeoResuelto(ubi)
      setForm((f) => ({
        ...f,
        departamento: ubi?.departamento ?? '',
        provincia: ubi?.provincia ?? '',
        distrito: ubi?.distrito ?? '',
      }))
      return ubi
    } catch {
      setUbigeoResuelto(null)
      return null
    }
  }

  // Al abrir el alta se resuelve el de San Bartolo; al editar, el que trae el registro.
  useEffect(() => {
    if (isLoading) return
    void resolver(form.ubigeo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  // Opciones del desplegable mientras se escribe el código.
  useEffect(() => {
    const codigo = form.ubigeo
    if (codigo === ultimoUbigeo.current) return
    ultimoUbigeo.current = codigo
    if (codigo.length < 1) {
      setOpcionesUbigeo([])
      return
    }
    const temporizador = setTimeout(() => {
      api
        .get<{ items: Ubigeo[] }>('/contribuyentes/ubigeos', { params: { q: codigo, limit: 50 } })
        .then(({ data }) => setOpcionesUbigeo(data.items))
        .catch(() => setOpcionesUbigeo([]))
    }, 250)
    return () => clearTimeout(temporizador)
  }, [form.ubigeo])

  function cambiar<K extends keyof Form>(campo: K, valor: Form[K]) {
    const cambiaDocumento = campo === 'tipoDoc' || campo === 'numDoc' || (campo === 'tipoPersona' && valor === 'JURIDICA')
    setForm((f) => {
      const next = { ...f, [campo]: valor }
      // Jurídica implica RUC.
      if (campo === 'tipoPersona' && valor === 'JURIDICA') next.tipoDoc = 'RUC'
      return next
    })
    setErrores((e) => ({ ...e, [campo]: undefined }))
    if (cambiaDocumento) {
      // El aviso anterior ya no corresponde. El estado 'consultando' se limpia solo, cuando la
      // respuesta descartada llega y ve que el documento cambió.
      docConsultado.current = null
      setConsulta((c) => (c.estado === 'consultando' ? c : CONSULTA_IDLE))
    }
  }

  // Consulta el padrón por el documento escrito. Botón explícito: cada consulta gasta cupo.
  async function consultarIdentidad() {
    const numDoc = form.numDoc.replace(/\s+/g, '').toUpperCase()
    if (!formatoConsultable(form.tipoDoc, numDoc)) return
    docConsultado.current = numDoc
    setConsulta({ estado: 'consultando', mensaje: null, datos: null, completado: [], sobrescribio: false })
    try {
      const { data } = await api.get<ConsultaIdentidad>('/contribuyentes/identidad', {
        params: { tipoDoc: form.tipoDoc, numDoc, ...(editando ? { excluirId: Number(id) } : {}) },
      })
      if (docConsultado.current !== numDoc) {
        setConsulta(CONSULTA_IDLE)
        return
      }
      if (data.origen === 'propia') {
        setConsulta({ estado: 'propia', mensaje: null, datos: data, completado: [], sobrescribio: false })
        return
      }
      const r = rellenar(data)
      setConsulta({
        estado: 'ok',
        mensaje: null,
        datos: data,
        completado: r.completado,
        sobrescribio: r.sobrescribio,
      })
    } catch (err) {
      // Si mientras respondía se siguió escribiendo, la respuesta ya no corresponde al documento.
      setConsulta(docConsultado.current === numDoc ? estadoDeError(err) : CONSULTA_IDLE)
    }
  }

  // Rellena los tres campos que el botón maneja: nombre, tipoPersona y ubigeo.
  //
  // Si el documento es el mismo con el que se rellenó la última vez, solo se llenan vacíos: lo
  // que el funcionario escribió a mano no se pisa jamás. Si el tipo o el número de documento
  // cambió, los datos anteriores pertenecen al documento viejo, así que se sobreescriben.
  function rellenar(datos: ConsultaIdentidad): { completado: string[]; sobrescribio: boolean } {
    const f = formRef.current
    const clave = `${f.tipoDoc}:${f.numDoc.replace(/\s+/g, '').toUpperCase()}`
    const cambioDeDocumento = docRelleno.current !== null && docRelleno.current !== clave

    const sinNombre = !f.nombreCompleto.trim()
    const escribeNombre = (sinNombre || cambioDeDocumento) && Boolean(datos.nombreCompleto.trim())

    // El ubigeo nace en UBIGEO_DEFECTO, así que "vacío" para él significa "sigue en el default".
    // Aunque el documento cambie, solo se pisa si el valor actual es exactamente el que puso el
    // botón: una elección del funcionario (u otro distrito ya cargado) se respeta.
    const ubigeoDisponible =
      f.ubigeo === UBIGEO_DEFECTO ||
      (cambioDeDocumento && ubigeoRelleno.current !== null && f.ubigeo === ubigeoRelleno.current)
    const escribeUbi =
      ubigeoDisponible && typeof datos.ubigeo === 'string' && datos.ubigeo !== f.ubigeo ? datos.ubigeo : null

    const completado: string[] = []
    let sobrescribio = false

    if (escribeNombre) {
      sobrescribio = !sinNombre
      completado.push('el nombre')
      setForm((prev) => ({
        ...prev,
        nombreCompleto: datos.nombreCompleto,
        // El tipo de persona lo deduce el documento. Si el documento cambió, el valor anterior
        // correspondía al viejo y también queda obsoleto.
        tipoPersona: sinNombre || cambioDeDocumento ? datos.tipoPersona : prev.tipoPersona,
      }))
      setErrores((e) => ({ ...e, nombreCompleto: undefined }))
    }
    if (escribeUbi) {
      sobrescribio = sobrescribio || f.ubigeo !== UBIGEO_DEFECTO
      completado.push('el ubigeo')
      ubigeoRelleno.current = escribeUbi
      setForm((prev) => ({ ...prev, ubigeo: escribeUbi }))
      // Recalcula departamento/provincia/distrito y el preview de la dirección fiscal.
      void resolver(escribeUbi)
    }

    // Se recuerda el documento aunque no se haya escrito nada: es lo que permite detectar en la
    // próxima consulta que el documento cambió.
    docRelleno.current = clave
    return { completado, sobrescribio }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    // Si el usuario escribió el código y no se resolvió aún, se resuelve antes de validar.
    const ubi = ubigeoResuelto?.codigo === form.ubigeo ? ubigeoResuelto : await resolver(form.ubigeo)
    const v = validar(form, ubi)
    setErrores(v)
    if (Object.keys(v).length > 0) return
    setIsSaving(true)
    setError(null)
    try {
      const body = {
        tipoPersona: form.tipoPersona,
        tipoDoc: form.tipoDoc,
        numDoc: form.numDoc,
        nombreCompleto: form.nombreCompleto,
        ubigeo: form.ubigeo,
        telefono: form.telefono,
        celular: form.celular,
        email: form.email,
        conyugeNombre: form.conyugeNombre,
        conyugeNumDoc: form.conyugeNumDoc,
        representanteNombre: form.representanteNombre,
        representanteNumDoc: form.representanteNumDoc,
        representanteDireccion: form.representanteDireccion,
        zonaId: form.zonaId ? Number(form.zonaId) : null,
        urbanizacionId: form.urbanizacionId ? Number(form.urbanizacionId) : null,
        viaId: form.viaId ? Number(form.viaId) : null,
        numero: form.numero,
        interior: form.interior,
        manzana: form.manzana,
        lote: form.lote,
        referencia: form.referencia,
        // El estado solo se cambia al editar (alta siempre ACTIVO).
        ...(editando ? { estado: form.estado } : {}),
      }
      const { data } = editando
        ? await api.patch<ContribuyenteResumen>(`/contribuyentes/${id}`, body)
        : await api.post<ContribuyenteResumen>('/contribuyentes', body)
      navigate(`${RUTA_BASE}/contribuyentes/${data.id}`)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setIsSaving(false)
    }
  }

  const volver = editando ? `${RUTA_BASE}/contribuyentes/${id}` : RUTA_BASE
  const preview = componerDireccionFiscal(form, ubigeoResuelto, catalogos)

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo={editando ? 'Editar contribuyente' : 'Nuevo contribuyente'}
          volverA={{ etiqueta: editando ? 'Ficha del contribuyente' : 'Registro Tributario', ruta: volver }}
        />

        <main className="mt-4 rounded-panel border border-borde bg-white p-6">
          {isLoading ? (
            <p className="mt-6 text-sm text-slate-500" role="status">
              Cargando…
            </p>
          ) : (
            <form onSubmit={(e) => void guardar(e)} noValidate className="mt-6 space-y-8">
              <fieldset>
                <legend className="mb-4 font-semibold text-mar-profundo">Datos generales</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="Tipo de persona" id="tipoPersona" error={errores.tipoPersona}>
                    <select
                      id="tipoPersona"
                      value={form.tipoPersona}
                      onChange={(e) => cambiar('tipoPersona', e.target.value as TipoPersona)}
                      className={CLASE_INPUT}
                    >
                      {TIPOS_PERSONA.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <div className="grid grid-cols-[7rem_1fr] gap-2">
                    <Campo label="Documento" id="tipoDoc">
                      <select id="tipoDoc" value={form.tipoDoc} onChange={(e) => cambiar('tipoDoc', e.target.value)} className={CLASE_INPUT}>
                        {TIPOS_DOC.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Campo>
                    <Campo label="Número" id="numDoc" error={errores.numDoc}>
                      <input
                        id="numDoc"
                        value={form.numDoc}
                        maxLength={20}
                        inputMode={form.tipoDoc === 'DNI' || form.tipoDoc === 'RUC' ? 'numeric' : undefined}
                        onChange={(e) => cambiar('numDoc', e.target.value)}
                        aria-invalid={Boolean(errores.numDoc)}
                        className={CLASE_INPUT}
                      />
                    </Campo>
                    {(form.tipoDoc === 'DNI' || form.tipoDoc === 'RUC') && (
                      <div className="col-span-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void consultarIdentidad()}
                            disabled={consulta.estado === 'consultando' || !formatoConsultable(form.tipoDoc, form.numDoc)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                          >
                            {consulta.estado === 'consultando' ? 'Consultando…' : 'Buscar datos'}
                          </button>
                          <span className="text-xs text-slate-400">Rellena lo que el padrón tenga.</span>
                        </div>
                        <AvisoConsulta consulta={consulta} />
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <Campo
                      label={form.tipoPersona === 'JURIDICA' ? 'Razón social' : 'Apellidos y nombres'}
                      id="nombreCompleto"
                      error={errores.nombreCompleto}
                    >
                      <input
                        id="nombreCompleto"
                        value={form.nombreCompleto}
                        maxLength={120}
                        onChange={(e) => cambiar('nombreCompleto', e.target.value)}
                        aria-invalid={Boolean(errores.nombreCompleto)}
                        className={`${CLASE_INPUT} uppercase`}
                      />
                    </Campo>
                  </div>
                  <Campo label="Teléfono casa" id="telefono" error={errores.telefono}>
                    <input
                      id="telefono"
                      value={form.telefono}
                      maxLength={15}
                      inputMode="tel"
                      onChange={(e) => cambiar('telefono', e.target.value)}
                      className={CLASE_INPUT}
                    />
                  </Campo>
                  <Campo label="Celular" id="celular" error={errores.celular}>
                    <input
                      id="celular"
                      value={form.celular}
                      maxLength={9}
                      inputMode="tel"
                      onChange={(e) => cambiar('celular', e.target.value)}
                      aria-invalid={Boolean(errores.celular)}
                      className={CLASE_INPUT}
                    />
                  </Campo>
                  <Campo label="Correo" id="email" error={errores.email}>
                    <input
                      id="email"
                      type="email"
                      value={form.email}
                      maxLength={100}
                      onChange={(e) => cambiar('email', e.target.value)}
                      aria-invalid={Boolean(errores.email)}
                      className={CLASE_INPUT}
                    />
                  </Campo>
                  {editando && (
                    <Campo label="Estado" id="estado">
                      <select
                        id="estado"
                        value={form.estado}
                        onChange={(e) => cambiar('estado', e.target.value as EstadoRegistro)}
                        className={CLASE_INPUT}
                      >
                        <option value="ACTIVO">Activo</option>
                        <option value="INACTIVO">Inactivo</option>
                        <option value="BAJA">Baja (solo sin deuda pendiente)</option>
                      </select>
                    </Campo>
                  )}
                </div>

                <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Cónyuge y representante legal
                  <span className="ml-2 font-normal normal-case text-slate-400">Campos opcionales</span>
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Campo label="Nombre del cónyuge" id="conyugeNombre">
                      <input
                        id="conyugeNombre"
                        value={form.conyugeNombre}
                        maxLength={60}
                        onChange={(e) => cambiar('conyugeNombre', e.target.value)}
                        className={`${CLASE_INPUT} uppercase`}
                      />
                    </Campo>
                  </div>
                  <Campo label="DNI del cónyuge" id="conyugeNumDoc" error={errores.conyugeNumDoc}>
                    <input
                      id="conyugeNumDoc"
                      value={form.conyugeNumDoc}
                      maxLength={8}
                      inputMode="numeric"
                      onChange={(e) => cambiar('conyugeNumDoc', e.target.value)}
                      aria-invalid={Boolean(errores.conyugeNumDoc)}
                      className={CLASE_INPUT}
                    />
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo label="Nombre del representante legal" id="representanteNombre">
                      <input
                        id="representanteNombre"
                        value={form.representanteNombre}
                        maxLength={60}
                        onChange={(e) => cambiar('representanteNombre', e.target.value)}
                        className={`${CLASE_INPUT} uppercase`}
                      />
                    </Campo>
                  </div>
                  <Campo label="DNI del representante" id="representanteNumDoc" error={errores.representanteNumDoc}>
                    <input
                      id="representanteNumDoc"
                      value={form.representanteNumDoc}
                      maxLength={8}
                      inputMode="numeric"
                      onChange={(e) => cambiar('representanteNumDoc', e.target.value)}
                      aria-invalid={Boolean(errores.representanteNumDoc)}
                      className={CLASE_INPUT}
                    />
                  </Campo>
                  <div className="sm:col-span-3">
                    <Campo label="Dirección del representante legal" id="representanteDireccion">
                      <input
                        id="representanteDireccion"
                        value={form.representanteDireccion}
                        maxLength={70}
                        onChange={(e) => cambiar('representanteDireccion', e.target.value)}
                        className={`${CLASE_INPUT} uppercase`}
                      />
                    </Campo>
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-4 font-semibold text-mar-profundo">Datos domicilio fiscal</legend>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Campo label="Ubigeo / Código postal *" id="ubigeo" error={errores.ubigeo}>
                    <input
                      id="ubigeo"
                      list="lista-ubigeos"
                      value={form.ubigeo}
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="150129"
                      onChange={(e) => cambiar('ubigeo', e.target.value.replace(/\D/g, ''))}
                      onBlur={() => void resolver(form.ubigeo)}
                      aria-invalid={Boolean(errores.ubigeo)}
                      aria-describedby="ayuda-ubigeo"
                      className={CLASE_INPUT}
                    />
                    <datalist id="lista-ubigeos">
                      {opcionesUbigeo.map((u) => (
                        <option key={u.codigo} value={u.codigo}>
                          {u.distrito} - {u.provincia} - {u.departamento}
                        </option>
                      ))}
                    </datalist>
                    <p id="ayuda-ubigeo" className="mt-1 text-xs text-slate-400">
                      Escribe el código o el nombre del distrito.
                    </p>
                  </Campo>
                  <Campo label="Departamento" id="departamento">
                    <input id="departamento" value={form.departamento} readOnly className={`${CLASE_INPUT} bg-slate-50`} />
                  </Campo>
                  <Campo label="Provincia" id="provincia">
                    <input id="provincia" value={form.provincia} readOnly className={`${CLASE_INPUT} bg-slate-50`} />
                  </Campo>
                  <Campo label="Distrito" id="distrito">
                    <input id="distrito" value={form.distrito} readOnly className={`${CLASE_INPUT} bg-slate-50`} />
                  </Campo>

                  <Campo label="Sector (zona)" id="zonaId">
                    <select id="zonaId" value={form.zonaId} onChange={(e) => cambiar('zonaId', e.target.value)} className={CLASE_INPUT}>
                      <option value="">—</option>
                      {catalogos?.zonas.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.codigo} · {z.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="Urbanización" id="urbanizacionId">
                    <select
                      id="urbanizacionId"
                      value={form.urbanizacionId}
                      onChange={(e) => cambiar('urbanizacionId', e.target.value)}
                      className={CLASE_INPUT}
                    >
                      <option value="">—</option>
                      {catalogos?.urbanizaciones.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo label="Vía" id="viaId">
                      <select id="viaId" value={form.viaId} onChange={(e) => cambiar('viaId', e.target.value)} className={CLASE_INPUT}>
                        <option value="">—</option>
                        {catalogos?.vias.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.tipoVia} {v.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>

                  <Campo label="Número" id="numero">
                    <input id="numero" value={form.numero} maxLength={10} onChange={(e) => cambiar('numero', e.target.value)} className={CLASE_INPUT} />
                  </Campo>
                  <Campo label="Dpto. / Interior" id="interior">
                    <input id="interior" value={form.interior} maxLength={10} onChange={(e) => cambiar('interior', e.target.value)} className={CLASE_INPUT} />
                  </Campo>
                  <Campo label="Manzana" id="manzana">
                    <input id="manzana" value={form.manzana} maxLength={10} onChange={(e) => cambiar('manzana', e.target.value)} className={CLASE_INPUT} />
                  </Campo>
                  <Campo label="Lote" id="lote">
                    <input id="lote" value={form.lote} maxLength={10} onChange={(e) => cambiar('lote', e.target.value)} className={CLASE_INPUT} />
                  </Campo>

                  <div className="sm:col-span-2">
                    <Campo label="Referencia de la dirección" id="referencia">
                      <input
                        id="referencia"
                        value={form.referencia}
                        maxLength={150}
                        onChange={(e) => cambiar('referencia', e.target.value)}
                        className={CLASE_INPUT}
                      />
                    </Campo>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Dirección fiscal</p>
                    <p className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
                      {preview || 'Se compondrá con la vía, el número y el distrito que elijas.'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Se guarda sola; no se escribe a mano.</p>
                  </div>
                </div>

                {catalogos && catalogos.vias.length === 0 && (
                  <p className="mt-3 text-xs text-amber-700">
                    No hay vías registradas: créalas en Rentas → Maestros → Ubicación.
                  </p>
                )}
              </fieldset>

              <div>
                {error && (
                  <p role="alert" className="mb-3 text-sm font-medium text-ladrillo">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                  >
                    {isSaving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar'}
                  </button>
                  <Link
                    to={volver}
                    className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa"
                  >
                    Cancelar
                  </Link>
                </div>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  )
}

const CLASE_INPUT =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa aria-[invalid=true]:border-ladrillo'

function Campo({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs font-medium text-ladrillo" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Lo que se cuenta debajo del botón "Buscar datos": encontró, ya estaba, no existe o falló.
function AvisoConsulta({ consulta }: { consulta: EstadoConsulta }) {
  const { estado, mensaje, datos, completado, sobrescribio } = consulta
  if (estado === 'idle') return null
  if (estado === 'consultando') {
    return (
      <p className="mt-1 text-xs text-slate-500" role="status">
        Consultando el padrón de identidad…
      </p>
    )
  }
  if (estado === 'propia' && datos) {
    return (
      <p className="mt-1 text-xs text-amber-700" role="status">
        Ya está inscrito como {datos.nombreCompleto}.{' '}
        <Link to={`${RUTA_BASE}/contribuyentes/${datos.contribuyenteId}`} className="font-medium underline">
          Ver ficha
        </Link>
      </p>
    )
  }
  if (estado === 'ok' && datos) {
    const fecha = datos.consultadoEn ? new Date(datos.consultadoEn).toLocaleDateString('es-PE') : null
    const fuente = datos.origen === 'cache' ? 'la caché de consultas' : 'el padrón de identidad'
    const que = completado.join(' y ')
    let cuenta: string
    if (completado.length === 0) {
      cuenta = 'El formulario ya tenía datos escritos: no se modificó nada.'
    } else if (sobrescribio) {
      cuenta = `Se actualizó ${que} desde ${fuente}: el documento cambió, así que se sobrescribió lo anterior.`
    } else {
      cuenta = `Se completó ${que} desde ${fuente}.`
    }
    return (
      <div className="mt-1 text-xs text-emerald-700" role="status">
        <p>
          {cuenta} {fecha && <span className="text-slate-400">Consulta del {fecha}.</span>}
        </p>
        {datos.direccionExterna && (
          <p className="text-slate-500">Domicilio registrado: {datos.direccionExterna}. Complétalo a mano abajo.</p>
        )}
        {datos.estado && (
          <p className="text-slate-500">
            SUNAT: {datos.estado}
            {datos.condicion ? ` · ${datos.condicion}` : ''}
          </p>
        )}
      </div>
    )
  }
  return (
    <p className={`mt-1 text-xs ${estado === 'error' ? 'text-ladrillo' : 'text-slate-500'}`} role={estado === 'error' ? 'alert' : 'status'}>
      {mensaje}
    </p>
  )
}
