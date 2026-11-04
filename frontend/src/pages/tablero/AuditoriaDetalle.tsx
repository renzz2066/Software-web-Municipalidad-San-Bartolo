import { useEffect, useRef, type ReactNode } from 'react'
import {
  ACCION_ESTILO,
  ACCION_TEXTO,
  MARCA_PASSWORD,
  calcularDiff,
  formatearFecha,
  etiquetaUsuario,
  formatearValor,
  type AuditoriaItem,
  type TipoCambio,
} from './auditoriaFormato'

const TIPO_TEXTO: Record<TipoCambio, string> = {
  agregado: 'agregado',
  quitado: 'quitado',
  cambiado: 'cambiado',
}

const ENFOCABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function Valor({ valor, estilo }: { valor: unknown; estilo: string }) {
  if (valor === MARCA_PASSWORD) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        <i aria-hidden="true" className="bi bi-key" />
        Contraseña cambiada
      </span>
    )
  }
  const texto = formatearValor(valor)
  const vacio = valor === null || valor === undefined
  return (
    <pre
      className={`whitespace-pre-wrap break-all rounded px-2 py-1 font-mono text-xs ${estilo} ${vacio ? 'italic' : ''}`}
    >
      {texto}
    </pre>
  )
}

export function AuditoriaDetalle({ item, onClose }: { item: AuditoriaItem; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)

  // Foco atrapado; Esc cierra; al cerrar vuelve a la fila que lo abrió
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    cerrarRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const nodos = [...dialogRef.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      if (nodos.length === 0) return
      const primero = nodos[0]
      const ultimo = nodos[nodos.length - 1]
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primero.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previo?.focus()
    }
  }, [onClose])

  const diff = calcularDiff(item.datosAntes, item.datosDespues)
  const esSesion = item.accion === 'LOGIN' || item.accion === 'LOGIN_FALLIDO' || item.accion === 'LOGOUT'
  const motivo = typeof item.detalle?.motivo === 'string' ? item.detalle.motivo : null

  const metadatos: [string, ReactNode][] = [
    ['ID', <span key="id" className="font-mono">{item.id}</span>],
    ['Fecha', formatearFecha(item.createdAt)],
    ['Usuario', <CeldaUsuario key="usuario" item={item} />],
    ['Tabla', <span key="tabla" className="font-mono">{item.tabla}</span>],
    ['Registro', <span key="registro" className="font-mono">{item.registroId ?? '—'}</span>],
    ['Módulo', item.modulo ?? '—'],
    ['IP', <span key="ip" className="font-mono">{item.ip ?? '—'}</span>],
    ['Navegador', <span key="ua" className="break-all text-xs">{item.userAgent ?? '—'}</span>],
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-mar-profundo/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auditoria-detalle-titulo"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl ring-1 ring-mar-profundo/10"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="auditoria-detalle-titulo" className="text-base font-bold text-mar-profundo">
              Detalle de auditoría
            </h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACCION_ESTILO[item.accion]}`}>
              {ACCION_TEXTO[item.accion] ?? item.accion}
            </span>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="rounded-md px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-turquesa"
          >
            <i aria-hidden="true" className="bi bi-x-lg" />
          </button>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {metadatos.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex gap-2">
              <dt className="w-24 shrink-0 font-semibold text-slate-500">{etiqueta}</dt>
              <dd className="min-w-0 text-slate-800">{valor}</dd>
            </div>
          ))}
        </dl>

        {motivo && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <strong className="text-slate-600">Motivo:</strong> {motivo}
          </p>
        )}

        {!esSesion && (
          <section className="mt-5" aria-labelledby="auditoria-cambios-titulo">
            <h3 id="auditoria-cambios-titulo" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
              Cambios
            </h3>
            {diff.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin datos de cambio registrados.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th scope="col" className="px-3 py-2">Campo</th>
                      <th scope="col" className="px-3 py-2">Antes</th>
                      <th scope="col" className="px-3 py-2">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.map((c) => (
                      <tr key={c.campo} className="border-b border-slate-100 align-top">
                        <th scope="row" className="px-3 py-2 font-medium text-slate-800">
                          <span className="font-mono text-xs">{c.campo}</span>
                          <span className="block text-xs font-normal text-slate-500">{TIPO_TEXTO[c.tipo]}</span>
                        </th>
                        <td className="px-3 py-2">
                          {c.tipo === 'agregado' ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <Valor valor={c.antes} estilo="bg-red-50 text-red-800 line-through decoration-red-400" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {c.tipo === 'quitado' ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <Valor valor={c.despues} estilo="bg-green-50 text-green-800" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {item.detalle && Object.keys(item.detalle).some((k) => k !== 'motivo') && (
          <section className="mt-5" aria-labelledby="auditoria-extra-titulo">
            <h3 id="auditoria-extra-titulo" className="text-sm font-bold uppercase tracking-wider text-mar-profundo">
              Detalle técnico
            </h3>
            <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-slate-50 p-3 font-mono text-xs text-slate-700">
              {JSON.stringify(item.detalle, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </div>
  )
}

export function CeldaUsuario({ item }: { item: AuditoriaItem }) {
  const etiqueta = etiquetaUsuario(item)
  if (etiqueta.tipo === 'usuario') {
    return <span className="text-slate-800">{etiqueta.texto}</span>
  }
  if (etiqueta.tipo === 'intento') {
    return (
      <span className="italic text-red-800">
        Intento: «{etiqueta.texto}»
      </span>
    )
  }
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        SISTEMA
      </span>
      {etiqueta.dbUsuario && (
        <span className="font-mono text-xs text-slate-500">BD: {etiqueta.dbUsuario}</span>
      )}
    </span>
  )
}
