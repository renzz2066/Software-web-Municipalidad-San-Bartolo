import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useAccesos } from '../../context/AccesosContext'
import {
  NIVEL_CHAT,
  enviarMensaje,
  listarConversaciones,
  mensajeErrorChat,
  obtenerConversacion,
  type MensajeChat,
} from '../../lib/chatApi'

// Chat San Bartolo (specs/ia-chat-v1.md): botón flotante + panel lateral sobre la pantalla actual.
const EJEMPLOS = ['¿Cómo emito una OP?', '¿Cómo extorno un recibo?', '¿Cómo cierro mi caja?']
const MAX_MENSAJE = 1000

export function ChatDrawer() {
  const { tiene } = useAccesos()
  if (!tiene(NIVEL_CHAT)) return null
  return <Chat />
}

function Chat() {
  const [abierto, setAbierto] = useState(false)
  const [convId, setConvId] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [historialCargado, setHistorialCargado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const entradaRef = useRef<HTMLTextAreaElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const idTemporal = useRef(0)

  // Al abrir por primera vez: retoma la última conversación del usuario.
  async function abrir() {
    setAbierto(true)
    if (historialCargado) return
    setHistorialCargado(true)
    setCargandoHistorial(true)
    try {
      const convs = await listarConversaciones()
      if (convs.length > 0) {
        const ultima = await obtenerConversacion(convs[0].id)
        setConvId(ultima.id)
        setMensajes(ultima.mensajes)
      }
    } catch (e) {
      setHistorialCargado(false) // reintenta al volver a abrir
      setError(mensajeErrorChat(e))
    } finally {
      setCargandoHistorial(false)
    }
  }

  const cerrar = useCallback(() => {
    setAbierto(false)
    botonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!abierto) return
    entradaRef.current?.focus()
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [abierto, cerrar])

  useEffect(() => {
    const lista = listaRef.current
    if (lista) lista.scrollTop = lista.scrollHeight
  }, [mensajes, enviando, abierto])

  async function enviar(pregunta: string) {
    const limpio = pregunta.trim()
    if (!limpio || enviando) return
    setError(null)
    setEnviando(true)
    const provisional: MensajeChat = {
      id: --idTemporal.current, // negativo: aún no guardado
      rol: 'USER',
      contenido: limpio,
      fuentes: [],
      createdAt: new Date().toISOString(),
    }
    setMensajes((m) => [...m, provisional])
    setTexto('')
    try {
      const r = await enviarMensaje(limpio, convId)
      setConvId(r.convId)
      setMensajes((m) => [...m, r.mensaje])
    } catch (e) {
      // No se guardó nada: se quita la pregunta y vuelve a la caja para reintentar.
      setMensajes((m) => m.filter((x) => x.id !== provisional.id))
      setTexto(limpio)
      setError(mensajeErrorChat(e))
    } finally {
      setEnviando(false)
      entradaRef.current?.focus()
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void enviar(texto)
  }

  function onKeyDownEntrada(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void enviar(texto)
    }
  }

  function nuevaConversacion() {
    setConvId(null)
    setMensajes([])
    setError(null)
    setTexto('')
    entradaRef.current?.focus()
  }

  return (
    <>
      {!abierto && (
        <button
          ref={botonRef}
          type="button"
          onClick={() => void abrir()}
          aria-label="Abrir MuniAI, asistente de trámites"
          title="MuniAI · Asistente"
          className="fixed bottom-4 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-mar-profundo bg-mar-profundo text-2xl text-white hover:bg-mar-medio print:hidden"
        >
          <i className="bi bi-chat-dots" aria-hidden="true" />
        </button>
      )}

      {abierto && (
        <section
          role="dialog"
          aria-labelledby="chat-titulo"
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-borde bg-white sm:w-[380px] print:hidden"
        >
          <header className="flex items-center gap-2 border-b border-borde bg-mar-profundo px-4 py-3 text-white">
            <i className="bi bi-chat-dots text-lg" aria-hidden="true" />
            <h2 id="chat-titulo" className="min-w-0 flex-1 truncate font-serif text-lg font-semibold">
              MuniAI · Asistente
            </h2>
            <button
              type="button"
              onClick={nuevaConversacion}
              disabled={enviando}
              title="Nueva conversación"
              className="shrink-0 rounded-panel border border-white/40 px-2 py-1 text-xs font-medium hover:bg-mar-medio disabled:opacity-50"
            >
              <i className="bi bi-plus-lg mr-1" aria-hidden="true" />
              Nueva<span className="sr-only"> conversación</span>
            </button>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar asistente"
              className="rounded-panel px-2 py-1 text-lg hover:bg-mar-medio"
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </header>

          <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto bg-arena-claro px-4 py-4" aria-live="polite">
            {cargandoHistorial && <p className="text-sm text-tinta-suave">Cargando conversación…</p>}

            {!cargandoHistorial && mensajes.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
                <i className="bi bi-chat-dots text-4xl text-mar-medio" aria-hidden="true" />
                <p className="text-sm text-tinta">Pregunta cómo hacer un trámite o gestión del sistema.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EJEMPLOS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => void enviar(e)}
                      className="rounded-panel border border-borde bg-white px-3 py-1.5 text-xs text-mar-profundo hover:bg-arena-suave"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m) => (
              <Mensaje key={m.id} mensaje={m} />
            ))}

            {enviando && (
              <p className="flex items-center gap-2 text-sm text-tinta-suave">
                <i className="bi bi-hourglass-split" aria-hidden="true" />
                MuniAI está buscando en las guías…
              </p>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-borde bg-white px-4 py-3">
            {error && (
              <p role="alert" className="mb-2 text-sm text-ladrillo">
                <i className="bi bi-exclamation-triangle mr-1" aria-hidden="true" />
                {error}
              </p>
            )}
            <label htmlFor="chat-entrada" className="sr-only">
              Escribe tu pregunta
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="chat-entrada"
                ref={entradaRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={onKeyDownEntrada}
                maxLength={MAX_MENSAJE}
                rows={2}
                placeholder="Escribe tu pregunta…"
                disabled={enviando}
                className="min-h-[2.75rem] flex-1 resize-none rounded-panel border border-borde px-3 py-2 text-sm text-tinta disabled:bg-arena-suave"
              />
              <button
                type="submit"
                disabled={enviando || !texto.trim()}
                aria-label="Enviar pregunta"
                className="flex h-11 w-11 items-center justify-center rounded-panel bg-mar-profundo text-white hover:bg-mar-medio disabled:opacity-50"
              >
                <i className="bi bi-send" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-tinta-suave">
              No escribas DNI, RUC ni datos de contribuyentes. Respuestas basadas en las guías del sistema.
            </p>
          </form>
        </section>
      )}
    </>
  )
}

function Mensaje({ mensaje }: { mensaje: MensajeChat }) {
  if (mensaje.rol === 'USER') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-panel bg-mar-profundo px-3 py-2 text-sm text-white">
          {mensaje.contenido}
        </p>
      </div>
    )
  }
  return (
    <div className="max-w-[92%] rounded-panel border border-borde bg-white px-3 py-2 text-sm text-tinta">
      <div className="space-y-1">{formatear(mensaje.contenido)}</div>
      {mensaje.fuentes.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-borde pt-2" aria-label="Fuentes">
          {mensaje.fuentes.map((f) => (
            <li key={`${f.archivo}#${f.seccion}`} className="flex gap-1.5 text-xs text-tinta-suave">
              <i className="bi bi-book mt-0.5" aria-hidden="true" />
              <span>
                {f.guia} › {f.seccion}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Markdown mínimo de Gemini: **negrita**, viñetas y saltos de línea (sin HTML crudo).
function formatear(texto: string): ReactNode[] {
  return texto.split('\n').map((linea, i) => {
    const vineta = /^\s*[*-]\s+/.test(linea)
    const limpia = linea.replace(/^\s*[*-]\s+/, '').replace(/^#{1,6}\s+/, '')
    const partes = limpia.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p,
    )
    if (!limpia.trim()) return <div key={i} className="h-1" />
    return (
      <p key={i} className={vineta ? 'pl-3 before:-ml-3 before:mr-1.5 before:content-["•"]' : undefined}>
        {partes}
      </p>
    )
  })
}
