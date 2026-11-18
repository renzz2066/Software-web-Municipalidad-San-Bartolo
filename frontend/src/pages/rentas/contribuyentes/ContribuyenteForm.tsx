import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { api } from '../../../lib/api'
import { useCatalogo, type ItemCatalogo } from '../catalogos/catalogosApi'
import { mensajeError } from '../maestros/maestrosApi'
import {
  RUTA_BASE,
  SIN_DOCUMENTO,
  TIPOS_PERSONA,
  UBIGEO_DEFECTO,
  componerNombre,
  errorDocumento,
  formatoConsultable,
  partirNombre,
  type Catalogos,
  type Contribuyente,
  type ContribuyenteResumen,
  type ConsultaIdentidad,
  type TipoPersona,
  type Ubigeo,
} from './tipos'

// Alta y edición de persona (specs/rentas-nucleo-v2.md, Fase 1; reglas P05–P18). Con :id edita.
// Nombres separados, varios documentos, contactos y relacionados, perfil y clasificación.
// El estado no se edita aquí: se habilita o inhabilita desde la ficha (P01, P02).
// Domicilio fiscal: specs/contribuyente-domicilio-representante-v1.md (la Fase 2 lo cambia).
// "Buscar datos": specs/consulta-identidad-v1.md, sobre el documento principal.

interface DocForm {
  tipoDoc: string
  numDoc: string
}

interface ContactoForm {
  tipo: string
  valor: string
}

interface RelacionadoForm {
  id?: number
  tipo: string
  tipoDoc: string
  numDoc: string
  nombreCompleto: string
  direccion: string
  vigente: boolean
  enlace: string | null // nombre de la persona registrada con ese documento
}

interface Form {
  tipoPersona: TipoPersona
  apellidoPaterno: string
  apellidoMaterno: string
  nombres: string
  razonSocial: string
  tipoSucesion: string
  fechaNacimiento: string
  dniCausante: string
  documentos: DocForm[]
  sinDocumentoMotivo: string
  contactos: ContactoForm[]
  relacionados: RelacionadoForm[]
  perfilCumplimiento: string
  perfilCobranza: string
  clasificacion: string
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
}

const VACIO: Form = {
  tipoPersona: 'NATURAL',
  apellidoPaterno: '',
  apellidoMaterno: '',
  nombres: '',
  razonSocial: '',
  tipoSucesion: 'INDIVISA',
  fechaNacimiento: '',
  dniCausante: '',
  documentos: [{ tipoDoc: 'DNI', numDoc: '' }],
  sinDocumentoMotivo: '',
  contactos: [],
  relacionados: [],
  perfilCumplimiento: '',
  perfilCobranza: '',
  clasificacion: '',
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
}

type Escalar = Exclude<keyof Form, 'documentos' | 'contactos' | 'relacionados'>
type Errores = Partial<Record<Escalar | 'documentos' | 'contactos' | 'relacionados', string>>

// Estado del botón "Buscar datos" y lo que se cuenta debajo.
interface EstadoConsulta {
  estado: 'idle' | 'consultando' | 'ok' | 'propia' | 'noEncontrado' | 'error'
  mensaje: string | null
  datos: ConsultaIdentidad | null
  completado: string[]
  sobrescribio: boolean
}

const CONSULTA_IDLE: EstadoConsulta = { estado: 'idle', mensaje: null, datos: null, completado: [], sobrescribio: false }

const limpio = (v: string) => v.replace(/\s+/g, '').toUpperCase()

function validar(f: Form, ubigeoResuelto: Ubigeo | null): Errores {
  const e: Errores = {}
  if (f.tipoPersona === 'JURIDICA') {
    if (!f.razonSocial.trim()) e.razonSocial = 'La razón social es obligatoria'
  } else {
    if (!f.apellidoPaterno.trim()) e.apellidoPaterno = f.tipoPersona === 'SUCESION' ? 'Indica el apellido paterno del causante' : 'El apellido paterno es obligatorio'
    if (f.tipoPersona === 'NATURAL' && !f.nombres.trim()) e.nombres = 'Los nombres son obligatorios'
  }
  if (f.tipoPersona === 'SUCESION' && f.dniCausante && !/^\d{8}$/.test(f.dniCausante)) e.dniCausante = 'El DNI del causante tiene 8 dígitos'

  const tipos = new Set<string>()
  for (const d of f.documentos) {
    if (tipos.has(d.tipoDoc)) e.documentos = `Hay dos documentos del tipo ${d.tipoDoc}`
    tipos.add(d.tipoDoc)
    const err = errorDocumento(d.tipoDoc, d.numDoc)
    if (err && !e.documentos) e.documentos = `${d.tipoDoc}: ${err}`
  }
  if (!e.documentos) {
    if (f.tipoPersona === 'JURIDICA' && !f.documentos.some((d) => d.tipoDoc === 'RUC' && limpio(d.numDoc).startsWith('20'))) {
      e.documentos = 'Una persona jurídica se registra con RUC que empieza en 20'
    } else if (f.tipoPersona === 'SUCESION' && f.documentos.some((d) => d.tipoDoc !== 'RUC')) {
      e.documentos = 'Una sucesión solo lleva RUC; el DNI del causante va en su propio campo'
    }
  }
  if (f.documentos.length === 0 && f.sinDocumentoMotivo.trim().length < 10) {
    e.sinDocumentoMotivo = 'Explica por qué la persona no tiene documento (mínimo 10 caracteres)'
  }
  if (f.contactos.some((c) => !c.valor.trim())) e.contactos = 'Completa o quita los contactos vacíos'
  if (f.relacionados.some((r) => !r.nombreCompleto.trim())) e.relacionados = 'Cada relacionado necesita su nombre'
  else if (f.relacionados.some((r) => Boolean(r.tipoDoc) !== Boolean(r.numDoc.trim()))) {
    e.relacionados = 'Del relacionado indica tipo y número de documento, o ninguno'
  }

  // Obligatorio en SIMUN: "Obligatorio: Falta Ingresar el Codigo Postal".
  if (!f.ubigeo) e.ubigeo = 'El ubigeo es obligatorio'
  else if (!/^\d{6}$/.test(f.ubigeo)) e.ubigeo = 'El ubigeo tiene 6 dígitos'
  else if (!ubigeoResuelto) e.ubigeo = 'El ubigeo no corresponde a un distrito registrado'
  return e
}

async function buscarUbigeo(codigo: string): Promise<Ubigeo | null> {
  if (!/^\d{6}$/.test(codigo)) return null
  const { data } = await api.get<{ items: Ubigeo[] }>('/contribuyentes/ubigeos', { params: { q: codigo, limit: 50 } })
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

function estadoDeError(err: unknown): EstadoConsulta {
  const fallo = (estado: EstadoConsulta['estado'], mensaje: string): EstadoConsulta => ({ estado, mensaje, datos: null, completado: [], sobrescribio: false })
  if (isAxiosError(err)) {
    const message = err.response?.data?.message
    const texto = typeof message === 'string' && message ? message : null
    if (err.response?.status === 404) return fallo('noEncontrado', texto ?? 'El documento no existe en el padrón de identidad')
    if (texto) return fallo('error', texto)
  }
  return fallo('error', 'No se pudo consultar el padrón de identidad. Intenta nuevamente.')
}

function desdeContribuyente(data: Contribuyente): Form {
  return {
    tipoPersona: data.tipoPersona,
    apellidoPaterno: data.apellidoPaterno ?? '',
    apellidoMaterno: data.apellidoMaterno ?? '',
    nombres: data.nombres ?? '',
    razonSocial: data.razonSocial ?? '',
    tipoSucesion: data.tipoSucesion ?? 'INDIVISA',
    fechaNacimiento: data.fechaNacimiento?.slice(0, 10) ?? '',
    dniCausante: data.dniCausante ?? '',
    documentos: data.documentos.map((d) => ({ tipoDoc: d.tipoDoc, numDoc: d.numDoc })),
    sinDocumentoMotivo: data.sinDocumentoMotivo ?? '',
    contactos: data.contactos.map((c) => ({ tipo: c.tipo, valor: c.valor })),
    relacionados: data.relacionados.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      tipoDoc: r.tipoDoc ?? '',
      numDoc: r.numDoc ?? '',
      nombreCompleto: r.nombreCompleto,
      direccion: r.direccion ?? '',
      vigente: r.vigente,
      enlace: r.persona?.nombreCompleto ?? null,
    })),
    perfilCumplimiento: data.perfilCumplimiento ?? '',
    perfilCobranza: data.perfilCobranza ?? '',
    clasificacion: data.clasificacion ?? '',
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
  }
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
  const [nombreRevisado, setNombreRevisado] = useState(true)
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null)
  const [ubigeoResuelto, setUbigeoResuelto] = useState<Ubigeo | null>(null)
  const [opcionesUbigeo, setOpcionesUbigeo] = useState<Ubigeo[]>([])
  const [consulta, setConsulta] = useState<EstadoConsulta>(CONSULTA_IDLE)
  const ultimoUbigeo = useRef<string>('')
  const docConsultado = useRef<string | null>(null)
  const docRelleno = useRef<string | null>(null)
  const ubigeoRelleno = useRef<string | null>(null)
  const formRef = useRef(form)
  formRef.current = form

  const tiposDoc = useCatalogo('TIPO_DOCUMENTO').filter((t) => t.codigo !== SIN_DOCUMENTO)
  const tiposContacto = useCatalogo('TIPO_CONTACTO')
  const tiposRelacionado = useCatalogo('TIPO_RELACIONADO')
  const tiposSucesion = useCatalogo('TIPO_SUCESION')
  const perfilesCumplimiento = useCatalogo('PERFIL_CUMPLIMIENTO')
  const perfilesCobranza = useCatalogo('PERFIL_COBRANZA')
  const clasificaciones = useCatalogo('CLASIFICACION_CONTRIBUYENTE')

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
    api
      .get<Contribuyente>(`/contribuyentes/${id}`)
      .then(({ data }) => {
        if (cancelled) return
        setForm(desdeContribuyente(data))
        setNombreRevisado(data.nombreRevisado)
      })
      .catch((err) => !cancelled && setError(mensajeError(err)))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  async function resolver(codigo: string): Promise<Ubigeo | null> {
    try {
      const ubi = await buscarUbigeo(codigo)
      setUbigeoResuelto(ubi)
      setForm((f) => ({ ...f, departamento: ubi?.departamento ?? '', provincia: ubi?.provincia ?? '', distrito: ubi?.distrito ?? '' }))
      return ubi
    } catch {
      setUbigeoResuelto(null)
      return null
    }
  }

  useEffect(() => {
    if (isLoading) return
    void resolver(form.ubigeo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

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

  function cambiar<K extends Escalar>(campo: K, valor: Form[K]) {
    setForm((f) => {
      const next = { ...f, [campo]: valor }
      // Jurídica implica RUC (P07): el documento principal pasa a RUC.
      if (campo === 'tipoPersona' && valor === 'JURIDICA') next.documentos = [{ tipoDoc: 'RUC', numDoc: f.documentos.find((d) => d.tipoDoc === 'RUC')?.numDoc ?? '' }]
      if (campo === 'tipoPersona' && valor === 'SUCESION') next.documentos = f.documentos.filter((d) => d.tipoDoc === 'RUC')
      return next
    })
    setErrores((e) => ({ ...e, [campo]: undefined }))
    if (campo === 'tipoPersona') reiniciarConsulta()
  }

  function reiniciarConsulta() {
    docConsultado.current = null
    setConsulta((c) => (c.estado === 'consultando' ? c : CONSULTA_IDLE))
  }

  // ---- listas ----
  function cambiarDoc(i: number, campo: keyof DocForm, valor: string) {
    setForm((f) => ({ ...f, documentos: f.documentos.map((d, j) => (j === i ? { ...d, [campo]: valor } : d)) }))
    setErrores((e) => ({ ...e, documentos: undefined }))
    if (i === 0) reiniciarConsulta()
  }
  function agregarDoc() {
    const libre = tiposDoc.find((t) => !form.documentos.some((d) => d.tipoDoc === t.codigo))
    setForm((f) => ({ ...f, documentos: [...f.documentos, { tipoDoc: libre?.codigo ?? 'DNI', numDoc: '' }] }))
  }
  function quitarDoc(i: number) {
    setForm((f) => ({ ...f, documentos: f.documentos.filter((_, j) => j !== i) }))
    if (i === 0) reiniciarConsulta()
  }
  function cambiarContacto(i: number, campo: keyof ContactoForm, valor: string) {
    setForm((f) => ({ ...f, contactos: f.contactos.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)) }))
    setErrores((e) => ({ ...e, contactos: undefined }))
  }
  function cambiarRelacionado<K extends keyof RelacionadoForm>(i: number, campo: K, valor: RelacionadoForm[K]) {
    setForm((f) => ({
      ...f,
      relacionados: f.relacionados.map((r, j) =>
        j === i ? { ...r, [campo]: valor, ...(campo === 'tipoDoc' || campo === 'numDoc' ? { enlace: null } : {}) } : r,
      ),
    }))
    setErrores((e) => ({ ...e, relacionados: undefined }))
  }

  // P10: si el documento del relacionado es de una persona registrada, se enlaza y se precarga.
  async function buscarRelacionado(i: number) {
    const r = form.relacionados[i]
    const numDoc = limpio(r.numDoc)
    if (!r.tipoDoc || !numDoc) return
    try {
      const { data } = await api.get<{ contribuyente: { id: number; nombreCompleto: string; direccionFiscal: string | null } | null }>(
        '/contribuyentes/por-documento',
        { params: { tipoDoc: r.tipoDoc, numDoc } },
      )
      const p = data.contribuyente
      if (!p) {
        setErrores((e) => ({ ...e, relacionados: `${r.tipoDoc} ${numDoc} no está registrado: completa sus datos a mano.` }))
        return
      }
      setForm((f) => ({
        ...f,
        relacionados: f.relacionados.map((x, j) =>
          j === i
            ? { ...x, numDoc, nombreCompleto: x.nombreCompleto || p.nombreCompleto, direccion: x.direccion || (p.direccionFiscal ?? ''), enlace: p.nombreCompleto }
            : x,
        ),
      }))
    } catch (err) {
      setErrores((e) => ({ ...e, relacionados: mensajeError(err) }))
    }
  }

  // ---- consulta de identidad (documento principal) ----
  const principal = form.documentos[0]

  async function consultarIdentidad() {
    if (!principal) return
    const numDoc = limpio(principal.numDoc)
    if (!formatoConsultable(principal.tipoDoc, numDoc)) return
    docConsultado.current = numDoc
    setConsulta({ estado: 'consultando', mensaje: null, datos: null, completado: [], sobrescribio: false })
    try {
      const { data } = await api.get<ConsultaIdentidad>('/contribuyentes/identidad', {
        params: { tipoDoc: principal.tipoDoc, numDoc, ...(editando ? { excluirId: Number(id) } : {}) },
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
      setConsulta({ estado: 'ok', mensaje: null, datos: data, completado: r.completado, sobrescribio: r.sobrescribio })
    } catch (err) {
      setConsulta(docConsultado.current === numDoc ? estadoDeError(err) : CONSULTA_IDLE)
    }
  }

  // Solo llena vacíos, salvo que el documento haya cambiado desde la última consulta: entonces los
  // datos anteriores eran del documento viejo y se reemplazan. El ubigeo solo si sigue en el default.
  function rellenar(datos: ConsultaIdentidad): { completado: string[]; sobrescribio: boolean } {
    const f = formRef.current
    const doc = f.documentos[0]
    const clave = `${doc.tipoDoc}:${limpio(doc.numDoc)}`
    const cambioDeDocumento = docRelleno.current !== null && docRelleno.current !== clave
    const juridica = datos.tipoPersona === 'JURIDICA'
    const sinNombre = juridica ? !f.razonSocial.trim() : !f.apellidoPaterno.trim() && !f.apellidoMaterno.trim() && !f.nombres.trim()
    const escribeNombre = (sinNombre || cambioDeDocumento) && Boolean(datos.nombreCompleto.trim())
    const ubigeoDisponible = f.ubigeo === UBIGEO_DEFECTO || (cambioDeDocumento && ubigeoRelleno.current !== null && f.ubigeo === ubigeoRelleno.current)
    const escribeUbi = ubigeoDisponible && typeof datos.ubigeo === 'string' && datos.ubigeo !== f.ubigeo ? datos.ubigeo : null

    const completado: string[] = []
    let sobrescribio = false
    if (escribeNombre) {
      sobrescribio = !sinNombre
      completado.push(juridica ? 'la razón social' : 'los apellidos y nombres (revísalos)')
      setForm((prev) => ({
        ...prev,
        tipoPersona: datos.tipoPersona,
        ...(juridica ? { razonSocial: datos.nombreCompleto } : partirNombre(datos.nombreCompleto)),
      }))
      setErrores((e) => ({ ...e, apellidoPaterno: undefined, nombres: undefined, razonSocial: undefined }))
    }
    if (escribeUbi) {
      sobrescribio = sobrescribio || f.ubigeo !== UBIGEO_DEFECTO
      completado.push('el ubigeo')
      ubigeoRelleno.current = escribeUbi
      setForm((prev) => ({ ...prev, ubigeo: escribeUbi }))
      void resolver(escribeUbi)
    }
    docRelleno.current = clave
    return { completado, sobrescribio }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const ubi = ubigeoResuelto?.codigo === form.ubigeo ? ubigeoResuelto : await resolver(form.ubigeo)
    const v = validar(form, ubi)
    setErrores(v)
    if (Object.keys(v).length > 0) {
      setError('Revisa los campos marcados.')
      return
    }
    setIsSaving(true)
    setError(null)
    const juridica = form.tipoPersona === 'JURIDICA'
    try {
      const body = {
        tipoPersona: form.tipoPersona,
        apellidoPaterno: juridica ? null : form.apellidoPaterno,
        apellidoMaterno: juridica ? null : form.apellidoMaterno,
        nombres: juridica ? null : form.nombres,
        razonSocial: juridica ? form.razonSocial : null,
        tipoSucesion: form.tipoPersona === 'SUCESION' ? form.tipoSucesion : null,
        fechaNacimiento: form.tipoPersona === 'NATURAL' ? form.fechaNacimiento || null : null,
        dniCausante: form.tipoPersona === 'SUCESION' ? form.dniCausante || null : null,
        documentos: form.documentos.map((d) => ({ tipoDoc: d.tipoDoc, numDoc: limpio(d.numDoc) })),
        sinDocumentoMotivo: form.documentos.length === 0 ? form.sinDocumentoMotivo : null,
        contactos: form.contactos.map((c) => ({ tipo: c.tipo, valor: c.valor.trim() })),
        relacionados: form.relacionados.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          tipo: r.tipo,
          tipoDoc: r.tipoDoc || null,
          numDoc: r.numDoc ? limpio(r.numDoc) : null,
          nombreCompleto: r.nombreCompleto,
          direccion: r.direccion || null,
          vigente: r.vigente,
        })),
        perfilCumplimiento: form.perfilCumplimiento || null,
        perfilCobranza: form.perfilCobranza || null,
        clasificacion: form.clasificacion || null,
        ubigeo: form.ubigeo,
        zonaId: form.zonaId ? Number(form.zonaId) : null,
        urbanizacionId: form.urbanizacionId ? Number(form.urbanizacionId) : null,
        viaId: form.viaId ? Number(form.viaId) : null,
        numero: form.numero,
        interior: form.interior,
        manzana: form.manzana,
        lote: form.lote,
        referencia: form.referencia,
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
  const nombrePreview = componerNombre({ ...form, abreviaturaSucesion: tiposSucesion.find((t) => t.codigo === form.tipoSucesion)?.abreviatura })
  const consultable = principal && (principal.tipoDoc === 'DNI' || principal.tipoDoc === 'RUC')

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
            <form onSubmit={(e) => void guardar(e)} noValidate className="mt-2 space-y-8">
              {!nombreRevisado && (
                <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  El nombre se separó solo al pasar del sistema anterior ("paterno materno nombres"). Revísalo: al guardar queda como revisado.
                </p>
              )}

              <fieldset>
                <legend className="mb-4 font-semibold text-mar-profundo">Datos generales</legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo label="Tipo de persona" id="tipoPersona">
                    <select id="tipoPersona" value={form.tipoPersona} onChange={(e) => cambiar('tipoPersona', e.target.value as TipoPersona)} className={CLASE_INPUT}>
                      {TIPOS_PERSONA.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  {form.tipoPersona === 'SUCESION' && (
                    <>
                      <Campo label="Tipo de sucesión" id="tipoSucesion">
                        <SelectCatalogo id="tipoSucesion" items={tiposSucesion} value={form.tipoSucesion} onChange={(v) => cambiar('tipoSucesion', v)} />
                      </Campo>
                      <Campo label="DNI del causante (referencia)" id="dniCausante" error={errores.dniCausante}>
                        <input
                          id="dniCausante"
                          value={form.dniCausante}
                          maxLength={8}
                          inputMode="numeric"
                          onChange={(e) => cambiar('dniCausante', e.target.value.replace(/\D/g, ''))}
                          aria-invalid={Boolean(errores.dniCausante)}
                          className={CLASE_INPUT}
                        />
                      </Campo>
                    </>
                  )}
                  {form.tipoPersona === 'NATURAL' && (
                    <Campo label="Fecha de nacimiento (opcional)" id="fechaNacimiento">
                      <input id="fechaNacimiento" type="date" value={form.fechaNacimiento} onChange={(e) => cambiar('fechaNacimiento', e.target.value)} className={CLASE_INPUT} />
                    </Campo>
                  )}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {form.tipoPersona === 'JURIDICA' ? (
                    <div className="sm:col-span-3">
                      <Campo label="Razón social" id="razonSocial" error={errores.razonSocial}>
                        <input
                          id="razonSocial"
                          value={form.razonSocial}
                          maxLength={120}
                          onChange={(e) => cambiar('razonSocial', e.target.value)}
                          aria-invalid={Boolean(errores.razonSocial)}
                          className={`${CLASE_INPUT} uppercase`}
                        />
                      </Campo>
                    </div>
                  ) : (
                    <>
                      <Campo label={form.tipoPersona === 'SUCESION' ? 'Apellido paterno del causante' : 'Apellido paterno'} id="apellidoPaterno" error={errores.apellidoPaterno}>
                        <input
                          id="apellidoPaterno"
                          value={form.apellidoPaterno}
                          maxLength={60}
                          onChange={(e) => cambiar('apellidoPaterno', e.target.value)}
                          aria-invalid={Boolean(errores.apellidoPaterno)}
                          className={`${CLASE_INPUT} uppercase`}
                        />
                      </Campo>
                      <Campo label="Apellido materno" id="apellidoMaterno">
                        <input id="apellidoMaterno" value={form.apellidoMaterno} maxLength={60} onChange={(e) => cambiar('apellidoMaterno', e.target.value)} className={`${CLASE_INPUT} uppercase`} />
                      </Campo>
                      <Campo label={form.tipoPersona === 'SUCESION' ? 'Nombres del causante (opcional)' : 'Nombres'} id="nombres" error={errores.nombres}>
                        <input
                          id="nombres"
                          value={form.nombres}
                          maxLength={80}
                          onChange={(e) => cambiar('nombres', e.target.value)}
                          aria-invalid={Boolean(errores.nombres)}
                          className={`${CLASE_INPUT} uppercase`}
                        />
                      </Campo>
                    </>
                  )}
                  <div className="sm:col-span-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nombre completo</p>
                    <p className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
                      {nombrePreview || 'Se arma solo con los datos de arriba.'}
                    </p>
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1 font-semibold text-mar-profundo">Documentos</legend>
                <p className="mb-3 text-xs text-slate-500">El primero es el principal: es el que sale en recibos y valores.</p>
                <ul className="space-y-2">
                  {form.documentos.map((d, i) => (
                    <li key={i} className="grid grid-cols-[minmax(8rem,12rem)_1fr_auto] items-end gap-2">
                      <Campo label={i === 0 ? 'Tipo (principal)' : 'Tipo'} id={`doc-tipo-${i}`}>
                        <SelectCatalogo
                          id={`doc-tipo-${i}`}
                          items={tiposDoc}
                          value={d.tipoDoc}
                          onChange={(v) => cambiarDoc(i, 'tipoDoc', v)}
                          conVacio={false}
                          disabled={form.tipoPersona !== 'NATURAL'}
                        />
                      </Campo>
                      <Campo label="Número" id={`doc-num-${i}`}>
                        <input
                          id={`doc-num-${i}`}
                          value={d.numDoc}
                          maxLength={20}
                          inputMode={d.tipoDoc === 'DNI' || d.tipoDoc === 'RUC' ? 'numeric' : undefined}
                          onChange={(e) => cambiarDoc(i, 'numDoc', e.target.value)}
                          className={`${CLASE_INPUT} uppercase`}
                        />
                      </Campo>
                      <BotonQuitar etiqueta={`Quitar documento ${d.tipoDoc}`} onClick={() => quitarDoc(i)} disabled={form.tipoPersona === 'JURIDICA'} />
                    </li>
                  ))}
                </ul>
                {consultable && (
                  <div className="mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void consultarIdentidad()}
                        disabled={consulta.estado === 'consultando' || !formatoConsultable(principal.tipoDoc, principal.numDoc)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
                      >
                        {consulta.estado === 'consultando' ? 'Consultando…' : 'Buscar datos'}
                      </button>
                      <span className="text-xs text-slate-400">Rellena con el padrón lo que esté vacío.</span>
                    </div>
                    <AvisoConsulta consulta={consulta} />
                  </div>
                )}
                {errores.documentos && (
                  <p role="alert" className="mt-2 text-xs font-medium text-ladrillo">
                    {errores.documentos}
                  </p>
                )}
                {form.tipoPersona === 'NATURAL' && (
                  <BotonAgregar onClick={agregarDoc} disabled={form.documentos.length >= tiposDoc.length}>
                    Agregar documento
                  </BotonAgregar>
                )}
                {form.tipoPersona === 'SUCESION' && form.documentos.length === 0 && (
                  <BotonAgregar onClick={() => setForm((f) => ({ ...f, documentos: [{ tipoDoc: 'RUC', numDoc: '' }] }))}>Agregar RUC</BotonAgregar>
                )}
                {form.documentos.length === 0 && (
                  <div className="mt-3 rounded-md bg-amber-50 p-3">
                    <Campo label="Justificación: ¿por qué no tiene documento?" id="sinDocumentoMotivo" error={errores.sinDocumentoMotivo}>
                      <textarea
                        id="sinDocumentoMotivo"
                        value={form.sinDocumentoMotivo}
                        maxLength={250}
                        rows={2}
                        onChange={(e) => cambiar('sinDocumentoMotivo', e.target.value)}
                        aria-invalid={Boolean(errores.sinDocumentoMotivo)}
                        className={CLASE_INPUT}
                      />
                    </Campo>
                    <p className="mt-1 text-xs text-amber-800">Quedará pendiente hasta que se registre un documento o un supervisor apruebe la excepción. No inventes números.</p>
                  </div>
                )}
              </fieldset>

              <fieldset>
                <legend className="mb-3 font-semibold text-mar-profundo">Contactos</legend>
                <ul className="space-y-2">
                  {form.contactos.map((c, i) => (
                    <li key={i} className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-end gap-2">
                      <Campo label="Tipo" id={`contacto-tipo-${i}`}>
                        <SelectCatalogo id={`contacto-tipo-${i}`} items={tiposContacto} value={c.tipo} onChange={(v) => cambiarContacto(i, 'tipo', v)} conVacio={false} />
                      </Campo>
                      <Campo label="Dato" id={`contacto-valor-${i}`}>
                        <input id={`contacto-valor-${i}`} value={c.valor} maxLength={100} onChange={(e) => cambiarContacto(i, 'valor', e.target.value)} className={CLASE_INPUT} />
                      </Campo>
                      <BotonQuitar etiqueta="Quitar contacto" onClick={() => setForm((f) => ({ ...f, contactos: f.contactos.filter((_, j) => j !== i) }))} />
                    </li>
                  ))}
                </ul>
                {errores.contactos && (
                  <p role="alert" className="mt-2 text-xs font-medium text-ladrillo">
                    {errores.contactos}
                  </p>
                )}
                <BotonAgregar onClick={() => setForm((f) => ({ ...f, contactos: [...f.contactos, { tipo: tiposContacto[0]?.codigo ?? 'EMAIL', valor: '' }] }))}>
                  Agregar contacto
                </BotonAgregar>
              </fieldset>

              <fieldset>
                <legend className="mb-1 font-semibold text-mar-profundo">Relacionados</legend>
                <p className="mb-3 text-xs text-slate-500">Cónyuge, representante legal o responsable. No hace falta registrarlos como contribuyentes; si ya lo están, se enlazan.</p>
                <ul className="space-y-4">
                  {form.relacionados.map((r, i) => (
                    <li key={r.id ?? `n${i}`} className="rounded-md border border-slate-200 p-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(8rem,12rem)_minmax(7rem,9rem)_1fr_auto]">
                        <Campo label="Relación" id={`rel-tipo-${i}`}>
                          <SelectCatalogo id={`rel-tipo-${i}`} items={tiposRelacionado} value={r.tipo} onChange={(v) => cambiarRelacionado(i, 'tipo', v)} conVacio={false} />
                        </Campo>
                        <Campo label="Documento" id={`rel-tdoc-${i}`}>
                          <SelectCatalogo id={`rel-tdoc-${i}`} items={tiposDoc} value={r.tipoDoc} onChange={(v) => cambiarRelacionado(i, 'tipoDoc', v)} etiquetaVacio="Ninguno" />
                        </Campo>
                        <Campo label="Número" id={`rel-num-${i}`}>
                          <div className="flex gap-1">
                            <input
                              id={`rel-num-${i}`}
                              value={r.numDoc}
                              maxLength={20}
                              disabled={!r.tipoDoc}
                              onChange={(e) => cambiarRelacionado(i, 'numDoc', e.target.value)}
                              onBlur={() => void buscarRelacionado(i)}
                              className={`${CLASE_INPUT} uppercase disabled:bg-slate-50`}
                            />
                          </div>
                        </Campo>
                        <BotonQuitar etiqueta="Quitar relacionado" onClick={() => setForm((f) => ({ ...f, relacionados: f.relacionados.filter((_, j) => j !== i) }))} />
                        <div className="sm:col-span-2">
                          <Campo label="Apellidos y nombres" id={`rel-nombre-${i}`}>
                            <input id={`rel-nombre-${i}`} value={r.nombreCompleto} maxLength={120} onChange={(e) => cambiarRelacionado(i, 'nombreCompleto', e.target.value)} className={`${CLASE_INPUT} uppercase`} />
                          </Campo>
                        </div>
                        <div className="sm:col-span-2">
                          <Campo label="Dirección (opcional)" id={`rel-dir-${i}`}>
                            <input id={`rel-dir-${i}`} value={r.direccion} maxLength={150} onChange={(e) => cambiarRelacionado(i, 'direccion', e.target.value)} className={`${CLASE_INPUT} uppercase`} />
                          </Campo>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={r.vigente} onChange={(e) => cambiarRelacionado(i, 'vigente', e.target.checked)} className="h-4 w-4 accent-mar-profundo" />
                          Vigente
                        </label>
                        {r.enlace && (
                          <span className="text-xs text-emerald-700">
                            <i aria-hidden="true" className="bi bi-link-45deg mr-1" />
                            Registrado como {r.enlace}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {errores.relacionados && (
                  <p role="alert" className="mt-2 text-xs font-medium text-ladrillo">
                    {errores.relacionados}
                  </p>
                )}
                <BotonAgregar
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      relacionados: [...f.relacionados, { tipo: tiposRelacionado[0]?.codigo ?? 'CONYUGE', tipoDoc: 'DNI', numDoc: '', nombreCompleto: '', direccion: '', vigente: true, enlace: null }],
                    }))
                  }
                >
                  Agregar relacionado
                </BotonAgregar>
              </fieldset>

              <fieldset>
                <legend className="mb-3 font-semibold text-mar-profundo">Perfil y clasificación</legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo label="Perfil de cumplimiento" id="perfilCumplimiento">
                    <SelectCatalogo id="perfilCumplimiento" items={perfilesCumplimiento} value={form.perfilCumplimiento} onChange={(v) => cambiar('perfilCumplimiento', v)} />
                  </Campo>
                  <Campo label="Perfil de cobranza" id="perfilCobranza">
                    <SelectCatalogo id="perfilCobranza" items={perfilesCobranza} value={form.perfilCobranza} onChange={(v) => cambiar('perfilCobranza', v)} />
                  </Campo>
                  <Campo label="Clasificación" id="clasificacion">
                    <SelectCatalogo id="clasificacion" items={clasificaciones} value={form.clasificacion} onChange={(v) => cambiar('clasificacion', v)} />
                  </Campo>
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
                    <select id="urbanizacionId" value={form.urbanizacionId} onChange={(e) => cambiar('urbanizacionId', e.target.value)} className={CLASE_INPUT}>
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
                      <input id="referencia" value={form.referencia} maxLength={150} onChange={(e) => cambiar('referencia', e.target.value)} className={CLASE_INPUT} />
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
                  <p className="mt-3 text-xs text-amber-700">No hay vías registradas: créalas en Rentas → Maestros → Ubicación.</p>
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
                  <Link to={volver} className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-turquesa">
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

function SelectCatalogo({
  id,
  items,
  value,
  onChange,
  conVacio = true,
  etiquetaVacio = '—',
  disabled,
}: {
  id: string
  items: ItemCatalogo[]
  value: string
  onChange: (v: string) => void
  conVacio?: boolean
  etiquetaVacio?: string
  disabled?: boolean
}) {
  // Un código guardado que la muni desactivó sigue visible para no perderlo al editar.
  const falta = value && !items.some((i) => i.codigo === value)
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${CLASE_INPUT} disabled:bg-slate-50`}>
      {conVacio && <option value="">{etiquetaVacio}</option>}
      {falta && <option value={value}>{value}</option>}
      {items.map((i) => (
        <option key={i.codigo} value={i.codigo}>
          {i.nombre}
        </option>
      ))}
    </select>
  )
}

function BotonAgregar({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-3 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
    >
      <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
      {children}
    </button>
  )
}

function BotonQuitar({ etiqueta, onClick, disabled }: { etiqueta: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className="mb-0.5 self-end rounded-md p-2 text-slate-500 hover:bg-ladrillo/10 hover:text-ladrillo focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-30"
    >
      <i aria-hidden="true" className="bi bi-x-lg" />
    </button>
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
    if (completado.length === 0) cuenta = 'El formulario ya tenía datos escritos: no se modificó nada.'
    else if (sobrescribio) cuenta = `Se actualizó ${que} desde ${fuente}: el documento cambió, así que se sobrescribió lo anterior.`
    else cuenta = `Se completó ${que} desde ${fuente}.`
    return (
      <div className="mt-1 text-xs text-emerald-700" role="status">
        <p>
          {cuenta} {fecha && <span className="text-slate-400">Consulta del {fecha}.</span>}
        </p>
        {datos.direccionExterna && <p className="text-slate-500">Domicilio registrado: {datos.direccionExterna}. Complétalo a mano abajo.</p>}
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
