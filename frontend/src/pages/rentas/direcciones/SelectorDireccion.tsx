import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { mensajeError } from '../maestros/maestrosApi'
import { EditorDireccion } from './EditorDireccion'
import type { DireccionDetalle, DireccionElegida, DireccionResumen } from './direccionesApi'

// Domicilio en el distrito (P11): se elige del catálogo de direcciones únicas (D01). Si no está,
// se registra aquí mismo; si ya existía, se usa la registrada en vez de duplicarla.
export function SelectorDireccion({
  id,
  valor,
  onChange,
  error,
}: {
  id: string
  valor: DireccionElegida | null
  onChange: (d: DireccionElegida | null) => void
  error?: string
}) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<DireccionResumen[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [registrando, setRegistrando] = useState(false)

  const consulta = texto.trim()
  const visibles = consulta.length >= 2 ? resultados : null

  useEffect(() => {
    const q = consulta
    if (q.length < 2) return
    let vivo = true
    const t = setTimeout(() => {
      setBuscando(true)
      api
        .get<{ items: DireccionResumen[] }>('/direcciones', { params: { q, pageSize: 10 } })
        .then(({ data }) => {
          if (vivo) {
            setResultados(data.items)
            setFallo(null)
          }
        })
        .catch((err) => vivo && setFallo(mensajeError(err)))
        .finally(() => vivo && setBuscando(false))
    }, 250)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [consulta])

  async function usarExistente(direccionId: number) {
    try {
      const { data } = await api.get<DireccionDetalle>(`/direcciones/${direccionId}`)
      if (!data.activo) {
        setFallo('La dirección registrada está dada de baja: pide a un supervisor que la reactive.')
        return
      }
      elegir({ id: data.id, direccion: data.direccion, referencia: data.referencia, activo: data.activo })
    } catch (err) {
      setFallo(mensajeError(err))
    }
  }

  function elegir(d: DireccionElegida) {
    onChange(d)
    setRegistrando(false)
    setTexto('')
    setResultados(null)
  }

  if (valor) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-mar-profundo" id={id}>
            {valor.direccion}
          </p>
          {valor.referencia && <p className="text-xs text-slate-500">Ref.: {valor.referencia}</p>}
          {valor.activo === false && <p className="text-xs text-amber-700">Dirección dada de baja: se conserva, pero conviene elegir otra.</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-md px-2 py-1 text-xs font-medium text-mar hover:bg-white focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          Cambiar dirección
        </button>
      </div>
    )
  }

  if (registrando) {
    return (
      <div className="rounded-md border border-borde p-4">
        <p className="mb-3 text-sm font-semibold text-mar-profundo">Nueva dirección del distrito</p>
        <EditorDireccion alGuardar={elegir} alCancelar={() => setRegistrando(false)} alUsarExistente={(i) => void usarExistente(i)} />
      </div>
    )
  }

  return (
    <div>
      <input
        id={id}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Busca por vía, número, manzana, habilitación…"
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-ayuda`}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa aria-[invalid=true]:border-ladrillo"
      />
      <p id={`${id}-ayuda`} className="mt-1 text-xs text-slate-400">
        Escribe al menos 2 letras. Si no aparece, regístrala.
      </p>
      {buscando && (
        <p className="mt-2 text-xs text-slate-500" role="status">
          Buscando…
        </p>
      )}
      {fallo && (
        <p className="mt-2 text-xs font-medium text-ladrillo" role="alert">
          {fallo}
        </p>
      )}
      {visibles && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-md ring-1 ring-slate-200" aria-label="Direcciones encontradas">
          {visibles.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Sin resultados para "{texto.trim()}".</li>}
          {visibles.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => elegir(d)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <span className="font-medium text-mar-profundo">{d.direccion}</span>
                {d.referencia && <span className="block text-xs text-slate-500">Ref.: {d.referencia}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setRegistrando(true)}
        className="mt-3 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
      >
        <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
        Registrar nueva dirección
      </button>
    </div>
  )
}
