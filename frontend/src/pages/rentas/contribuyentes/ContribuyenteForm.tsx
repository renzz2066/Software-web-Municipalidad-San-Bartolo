import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import {
  RUTA_BASE,
  TIPOS_DOC,
  TIPOS_PERSONA,
  errorDocumento,
  type Contribuyente,
  type ContribuyenteResumen,
  type EstadoRegistro,
  type TipoPersona,
} from './tipos'

// Alta y edición de contribuyente (C1). Con :id edita; sin :id crea.

interface Form {
  tipoPersona: TipoPersona
  tipoDoc: string
  numDoc: string
  nombreCompleto: string
  direccionFiscal: string
  ubigeo: string
  telefono: string
  celular: string
  email: string
  estado: EstadoRegistro
}

const VACIO: Form = {
  tipoPersona: 'NATURAL',
  tipoDoc: 'DNI',
  numDoc: '',
  nombreCompleto: '',
  direccionFiscal: '',
  ubigeo: '',
  telefono: '',
  celular: '',
  email: '',
  estado: 'ACTIVO',
}

function validar(f: Form): Partial<Record<keyof Form, string>> {
  const e: Partial<Record<keyof Form, string>> = {}
  const doc = errorDocumento(f.tipoDoc, f.numDoc, f.tipoPersona)
  if (doc) e.numDoc = doc
  if (!f.nombreCompleto.trim()) e.nombreCompleto = 'El nombre o razón social es obligatorio'
  if (f.ubigeo && !/^\d{6}$/.test(f.ubigeo)) e.ubigeo = 'El ubigeo tiene 6 dígitos'
  if (f.celular && !/^9\d{8}$/.test(f.celular)) e.celular = 'El celular debe tener 9 dígitos y empezar en 9'
  if (f.telefono && !/^[0-9+\-\s]{6,15}$/.test(f.telefono)) e.telefono = 'Teléfono no válido'
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Correo no válido'
  return e
}

export function ContribuyenteForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(VACIO)
  const [errores, setErrores] = useState<Partial<Record<keyof Form, string>>>({})
  const [isLoading, setIsLoading] = useState(editando)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          direccionFiscal: data.direccionFiscal ?? '',
          ubigeo: data.ubigeo ?? '',
          telefono: data.telefono ?? '',
          celular: data.celular ?? '',
          email: data.email ?? '',
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

  function cambiar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => {
      const next = { ...f, [campo]: valor }
      // Jurídica implica RUC.
      if (campo === 'tipoPersona' && valor === 'JURIDICA') next.tipoDoc = 'RUC'
      return next
    })
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const v = validar(form)
    setErrores(v)
    if (Object.keys(v).length > 0) return
    setIsSaving(true)
    setError(null)
    try {
      // El estado solo se cambia al editar (alta siempre ACTIVO).
      const { estado: _estado, ...alta } = form
      const body = editando ? form : alta
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

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to={volver}
          className="inline-flex items-center gap-1 text-sm font-medium text-mar hover:text-mar-profundo focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-arrow-left" />
          {editando ? 'Ficha del contribuyente' : 'Registro Tributario'}
        </Link>

        <main className="mt-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          <h1 className="text-lg font-bold text-mar-profundo">{editando ? 'Editar contribuyente' : 'Nuevo contribuyente'}</h1>

          {isLoading ? (
            <p className="mt-6 text-sm text-slate-500" role="status">
              Cargando…
            </p>
          ) : (
            <form onSubmit={(e) => void guardar(e)} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
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
              </div>
              <div className="sm:col-span-2">
                <Campo label={form.tipoPersona === 'JURIDICA' ? 'Razón social' : 'Apellidos y nombres'} id="nombreCompleto" error={errores.nombreCompleto}>
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
              <div className="sm:col-span-2">
                <Campo label="Domicilio fiscal" id="direccionFiscal">
                  <input
                    id="direccionFiscal"
                    value={form.direccionFiscal}
                    maxLength={150}
                    onChange={(e) => cambiar('direccionFiscal', e.target.value)}
                    className={`${CLASE_INPUT} uppercase`}
                  />
                </Campo>
              </div>
              <Campo label="Ubigeo" id="ubigeo" error={errores.ubigeo}>
                <input
                  id="ubigeo"
                  value={form.ubigeo}
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="150125"
                  onChange={(e) => cambiar('ubigeo', e.target.value)}
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
                  className={CLASE_INPUT}
                />
              </Campo>
              <Campo label="Teléfono fijo" id="telefono" error={errores.telefono}>
                <input
                  id="telefono"
                  value={form.telefono}
                  maxLength={15}
                  inputMode="tel"
                  onChange={(e) => cambiar('telefono', e.target.value)}
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

              <div className="sm:col-span-2">
                {error && (
                  <p role="alert" className="mb-3 text-sm font-medium text-red-700">
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
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa aria-[invalid=true]:border-red-500'

function Campo({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
