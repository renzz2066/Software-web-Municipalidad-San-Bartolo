import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../lib/api'
import { soles, type ContribuyenteResumen } from '../../rentas/contribuyentes/tipos'
import type { ReciboListado } from '../../caja/cajaApi'
import type { EstadoCuenta } from '../../rentas/estado-cuenta/estadoCuentaApi'
import {
  ESTILO_VALOR,
  NOMBRE_VALOR,
  type ValorResumen,
} from '../../rentas/valores/valoresApi'
import {
  ETIQUETA_ESTADO,
  ESTILO_ESTADO,
  etiquetaTipo,
  type ExpedienteListado,
} from '../../rentas/fiscalizacion/fiscalizacionApi'
import { ESTILO_CONVENIO, ETIQUETA_CONVENIO, type ConvenioResumen } from '../../rentas/fraccionamiento/fraccionamientoApi'
import { mensajeUtilidad } from '../utilitariosApi'
import { AvisoSeccion } from '../utilitariosUi'

// U5 + C2: buscador por contribuyente o nº de recibo y panel transversal
// (specs/utilitarios-v1.md). Cada sección pide lo suyo con su propio nivel y un 403 se pinta como
// «Sin acceso» sin romper la pantalla.

interface Consulta {
  id: number
  nombre: string
  doc: string
}

const CLAVE_HISTORIAL = 'utilitarios.consultas'

function leerHistorial(): Consulta[] {
  try {
    const crudo = localStorage.getItem(CLAVE_HISTORIAL)
    const valor = crudo ? JSON.parse(crudo) : []
    return Array.isArray(valor) ? valor.filter((c) => typeof c?.id === 'number' && typeof c?.nombre === 'string') : []
  } catch {
    return []
  }
}

function guardarHistorial(consulta: Consulta): Consulta[] {
  const siguiente = [consulta, ...leerHistorial().filter((c) => c.id !== consulta.id)].slice(0, 8)
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(siguiente))
  } catch {
    // sin almacenamiento disponible: el historial es opcional
  }
  return siguiente
}

/** Carga una URL; el 403 se convierte en «Sin acceso» y no rompe las demás secciones. */
function useSeccion<T>(url: string | null) {
  const [respuesta, setRespuesta] = useState<{ url: string | null; datos: T | null; mensaje: string | null } | null>(null)

  useEffect(() => {
    if (!url) return
    const destino = url
    let cancelled = false
    async function cargar() {
      try {
        const { data } = await api.get<T>(destino)
        if (!cancelled) setRespuesta({ url: destino, datos: data, mensaje: null })
      } catch (err) {
        if (!cancelled) setRespuesta({ url: destino, datos: null, mensaje: mensajeUtilidad(err) })
      }
    }
    void cargar()
    return () => {
      cancelled = true
    }
  }, [url])

  // La respuesta solo vale para la URL vigente: mientras cambie, la sección está cargando.
  const vigente = respuesta !== null && respuesta.url === url ? respuesta : null
  return {
    datos: vigente?.datos ?? null,
    mensaje: vigente?.mensaje ?? null,
    cargando: url !== null && vigente === null,
  }
}

function Bloque({
  titulo,
  icono,
  cargando,
  mensaje,
  hay,
  children,
}: {
  titulo: string
  icono: string
  cargando: boolean
  mensaje: string | null
  hay: boolean
  children: ReactNode
}) {
  return (
    <section className="rounded-md p-4 ring-1 ring-slate-200">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <i aria-hidden="true" className={`bi ${icono}`} />
        {titulo}
      </h3>
      <div className="mt-2">
        {cargando ? (
          <p role="status" className="text-sm text-slate-500">
            Cargando…
          </p>
        ) : mensaje ? (
          <AvisoSeccion mensaje={mensaje} />
        ) : hay ? (
          children
        ) : (
          <p className="text-sm text-slate-500">Sin registros.</p>
        )}
      </div>
    </section>
  )
}

interface ResumenFicha {
  contribuyente: {
    id: number
    tipoDoc: string
    numDoc: string
    nombreCompleto: string
    direccionFiscal: string | null
    estado: string
  }
  predios: unknown[]
  deuda: { anio: number; tributo: { nombre: string }; total: string }[]
  totalDeuda: string
  declaraciones: unknown[]
}

function Panel({ id }: { id: number }) {
  const ficha = useSeccion<ResumenFicha>(`/contribuyentes/${id}/resumen`)
  const cuenta = useSeccion<EstadoCuenta>(`/contribuyentes/${id}/estado-cuenta`)
  const valores = useSeccion<ValorResumen[]>(`/rentas/valores?contribuyenteId=${id}`)
  const recibos = useSeccion<ReciboListado[]>(`/caja/recibos?contribuyenteId=${id}`)
  const expedientes = useSeccion<ExpedienteListado[]>(`/rentas/fiscalizacion/expedientes?contribuyenteId=${id}`)
  const convenios = useSeccion<ConvenioResumen[]>(`/rentas/convenios?contribuyenteId=${id}`)

  const c = ficha.datos?.contribuyente

  return (
    <div className="space-y-4">
      <Bloque
        titulo="Ficha"
        icono="bi-person"
        cargando={ficha.cargando}
        mensaje={ficha.mensaje}
        hay={ficha.datos !== null}
      >
        {c && (
          <div>
            <p className="font-semibold text-mar-profundo">{c.nombreCompleto}</p>
            <p className="font-mono text-xs text-slate-500">
              {c.tipoDoc} {c.numDoc}
            </p>
            <p className="mt-1 text-sm text-slate-600">{c.direccionFiscal ?? 'Sin dirección fiscal'}</p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Predios</dt>
                <dd className="font-medium">{ficha.datos!.predios.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Deuda total</dt>
                <dd className="font-medium text-red-700">{soles(ficha.datos!.totalDeuda)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Estado</dt>
                <dd className="font-medium">{c.estado}</dd>
              </div>
            </dl>
          </div>
        )}
      </Bloque>

      <Bloque
        titulo="Estado de cuenta"
        icono="bi-journal-text"
        cargando={cuenta.cargando}
        mensaje={cuenta.mensaje}
        hay={(cuenta.datos?.lineas.length ?? 0) > 0}
      >
        {cuenta.datos && (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Insoluto <strong>{soles(cuenta.datos.totales.insoluto)}</strong>
              </span>
              <span>
                Reajuste <strong>{soles(cuenta.datos.totales.reajuste)}</strong>
              </span>
              <span>
                Mora <strong>{soles(cuenta.datos.totales.mora)}</strong>
              </span>
              <span className="font-semibold text-mar-profundo">
                Total <strong>{soles(cuenta.datos.totales.total)}</strong>
              </span>
            </div>
            <ul className="mt-2 divide-y divide-slate-100">
              {cuenta.datos.lineas.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-600">
                    {l.anio} · {l.tributo.nombre} · cuota {l.cuota} ·{' '}
                    <span className="text-xs text-slate-500">{l.estado}</span>
                  </span>
                  <span className="font-medium">{soles(l.total)}</span>
                </li>
              ))}
            </ul>
            {cuenta.datos.lineas.length > 8 && (
              <p className="mt-1 text-xs text-slate-500">
                +{cuenta.datos.lineas.length - 8} línea(s) más en el Estado de Cuenta.
              </p>
            )}
          </>
        )}
      </Bloque>

      <Bloque
        titulo={`Valores (${valores.datos?.length ?? 0})`}
        icono="bi-cash-stack"
        cargando={valores.cargando}
        mensaje={valores.mensaje}
        hay={(valores.datos?.length ?? 0) > 0}
      >
        <ul className="divide-y divide-slate-100">
          {valores.datos!.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span>
                <span className="font-mono text-xs text-slate-500">{v.numero}</span>{' '}
                <span className="text-slate-600">{NOMBRE_VALOR[v.tipo]}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs ${ESTILO_VALOR[v.estado]}`}>{v.estado}</span>
                <span className="font-medium">{soles(v.totalDeuda)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Bloque>

      <Bloque
        titulo={`Recibos (${recibos.datos?.length ?? 0})`}
        icono="bi-receipt"
        cargando={recibos.cargando}
        mensaje={recibos.mensaje}
        hay={(recibos.datos?.length ?? 0) > 0}
      >
        <ul className="divide-y divide-slate-100">
          {recibos.datos!.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span>
                <span className="font-mono text-xs text-slate-500">{r.numero}</span>{' '}
                <span className="text-xs text-slate-500">{r.fechaCaja}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{r.medioPago}</span>
                <span className="font-medium">{soles(r.total)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Bloque>

      <Bloque
        titulo={`Expedientes (${expedientes.datos?.length ?? 0})`}
        icono="bi-folder2-open"
        cargando={expedientes.cargando}
        mensaje={expedientes.mensaje}
        hay={(expedientes.datos?.length ?? 0) > 0}
      >
        <ul className="divide-y divide-slate-100">
          {expedientes.datos!.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span>
                <span className="font-mono text-xs text-slate-500">{e.numero}</span>{' '}
                <span className="text-slate-600">{etiquetaTipo(e.tipo)}</span>
              </span>
              <span className={`rounded px-1.5 py-0.5 text-xs ${ESTILO_ESTADO[e.estado]}`}>
                {ETIQUETA_ESTADO[e.estado]}
              </span>
            </li>
          ))}
        </ul>
      </Bloque>

      <Bloque
        titulo={`Convenios de fraccionamiento (${convenios.datos?.length ?? 0})`}
        icono="bi-calendar2-check"
        cargando={convenios.cargando}
        mensaje={convenios.mensaje}
        hay={(convenios.datos?.length ?? 0) > 0}
      >
        <ul className="divide-y divide-slate-100">
          {convenios.datos!.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="font-mono text-xs text-slate-500">{v.numero}</span>
              <span className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs ${ESTILO_CONVENIO[v.estado] ?? ''}`}>
                  {ETIQUETA_CONVENIO[v.estado] ?? v.estado}
                </span>
                <span className="font-medium">{soles(v.montoTotal)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Bloque>
    </div>
  )
}

const claseCampo =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'

export function BuscadorUniversal() {
  const [modo, setModo] = useState<'contribuyente' | 'recibo'>('contribuyente')
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coincidencias, setCoincidencias] = useState<ContribuyenteResumen[] | null>(null)
  const [recibos, setRecibos] = useState<ReciboListado[] | null>(null)
  const [elegido, setElegido] = useState<Consulta | null>(null)
  const [historial, setHistorial] = useState<Consulta[]>(() => leerHistorial())

  async function buscar() {
    const q = texto.trim()
    if (modo === 'contribuyente' && q.length < 3) {
      setError('Escribe al menos 3 caracteres (DNI, RUC o nombre).')
      return
    }
    if (modo === 'recibo') {
      if (!q) {
        setError('Escribe el número del recibo.')
        return
      }
      // Mismo formato que exige `cobros.service.ts`: AAAA-NNNNNN o NNNNNN.
      const [anioParte, numParte] = q.includes('-') ? q.split('-') : [null, q]
      if (!/^\d{1,7}$/.test(numParte) || (anioParte !== null && !/^\d{4}$/.test(anioParte))) {
        setError('El número de recibo debe tener la forma 2026-000123 o 123.')
        return
      }
    }
    setCargando(true)
    setError(null)
    setCoincidencias(null)
    setRecibos(null)
    try {
      if (modo === 'contribuyente') {
        const { data } = await api.get<{ items: ContribuyenteResumen[] }>('/contribuyentes', {
          params: { q, pageSize: 8 },
        })
        setCoincidencias(data.items)
      } else {
        const { data } = await api.get<ReciboListado[]>('/caja/recibos', { params: { numero: q.slice(0, 12) } })
        setRecibos(data)
      }
    } catch (err) {
      setError(mensajeUtilidad(err))
    } finally {
      setCargando(false)
    }
  }

  function elegir(id: number, nombre: string, doc: string) {
    const consulta = { id, nombre, doc }
    setElegido(consulta)
    setHistorial(guardarHistorial(consulta))
    setCoincidencias(null)
    setRecibos(null)
    setTexto('')
  }

  const sinResultados =
    !cargando &&
    !error &&
    ((modo === 'contribuyente' && coincidencias?.length === 0) || (modo === 'recibo' && recibos?.length === 0))

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
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
              <i className="bi bi-binoculars" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Buscador Universal</h1>
              <p className="text-sm text-slate-500">
                Un solo lugar para ver valores, recibos, expedientes y convenios de un contribuyente.
              </p>
            </div>
          </div>
        </header>

        <main className="mt-6 space-y-6">
          <section className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
            <div className="flex gap-4" role="radiogroup" aria-label="Tipo de búsqueda">
              {(['contribuyente', 'recibo'] as const).map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="buscador-modo"
                    checked={modo === m}
                    onChange={() => {
                      setModo(m)
                      setError(null)
                      setCoincidencias(null)
                      setRecibos(null)
                    }}
                    className="accent-mar"
                  />
                  {m === 'contribuyente' ? 'DNI, RUC o nombre' : 'N° de recibo'}
                </label>
              ))}
            </div>

            <label htmlFor="buscador-texto" className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              {modo === 'contribuyente' ? 'Buscar contribuyente' : 'Buscar recibo'}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="buscador-texto"
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void buscar()
                  }
                }}
                placeholder={modo === 'contribuyente' ? 'DNI, RUC o nombre (mínimo 3 caracteres)' : 'Ej. 2026-000001'}
                className={claseCampo}
              />
              <button
                type="button"
                onClick={() => void buscar()}
                disabled={cargando}
                className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:bg-mar focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-40"
              >
                {cargando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            {sinResultados && (
              <p role="status" className="mt-2 text-sm text-slate-500">
                Sin resultados.
              </p>
            )}

            {(coincidencias?.length ?? 0) > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-md ring-1 ring-slate-200" aria-label="Contribuyentes encontrados">
                {coincidencias!.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => elegir(c.id, c.nombreCompleto, `${c.tipoDoc} ${c.numDoc}`)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
                    >
                      <span className="font-mono text-xs text-slate-500">
                        {c.tipoDoc} {c.numDoc}
                      </span>{' '}
                      <span className="font-medium text-mar-profundo">{c.nombreCompleto}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {(recibos?.length ?? 0) > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-md ring-1 ring-slate-200" aria-label="Recibos encontrados">
                {recibos!.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() =>
                        elegir(r.contribuyente.id, r.contribuyente.nombreCompleto, `${r.contribuyente.tipoDoc} ${r.contribuyente.numDoc}`)
                      }
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
                    >
                      <span>
                        <span className="font-mono text-xs text-slate-500">{r.numero}</span>{' '}
                        <span className="font-medium text-mar-profundo">{r.contribuyente.nombreCompleto}</span>
                      </span>
                      <span className="whitespace-nowrap font-medium">{soles(r.total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {historial.length > 0 && !elegido && (
            <section className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Últimas consultas</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {historial.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => elegir(h.id, h.nombre, h.doc)}
                      className="rounded-full bg-mar/10 px-3 py-1 text-xs font-medium text-mar-profundo hover:bg-mar/20 focus-visible:outline-3 focus-visible:outline-turquesa"
                    >
                      {h.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {elegido && (
            <section className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-mar-profundo">{elegido.nombre}</h2>
                  <p className="font-mono text-xs text-slate-500">{elegido.doc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setElegido(null)}
                  className="rounded-md border border-mar-profundo/30 px-3 py-1.5 text-sm font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  Cerrar
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Cada sección usa su propio permiso; si tu rol no lo tiene verás «Sin acceso».
              </p>
              <div className="mt-4">
                <Panel id={elegido.id} />
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
