import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { Dialogo } from './Dialogo'
import { mensajeError } from './cobranzaApi'

const campoClase =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-3 focus-visible:outline-turquesa'

interface Resultado {
  anio: number
  filas: number
  enlazados: number
}

// P2: el ADMIN sube el puntajes_AAAA.csv que genera 05_puntajes.py (repo del modelo de tesis).
export function ImportarPuntajes({ onClose, onImportado }: { onClose: () => void; onImportado: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [modelo, setModelo] = useState('Random Forest (entrenado 2015-2023)')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!archivo) {
      setError('Elige el archivo puntajes_AAAA.csv.')
      return
    }
    if (!archivo.name.toLowerCase().endsWith('.csv')) {
      setError('El archivo debe ser .csv (no el .dbf).')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const contenido = await archivo.text()
      const { data } = await api.post<Resultado>('/cobranza/lotes', contenido, {
        headers: { 'Content-Type': 'text/csv' },
        params: { archivo: archivo.name, modelo: modelo.trim() || undefined },
      })
      setResultado(data)
      onImportado()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo titulo="Importar puntajes del modelo" onClose={onClose} ancho="max-w-lg">
      {resultado ? (
        <div className="mt-4 space-y-4">
          <p role="status" className="rounded-lg bg-ok-fondo px-3 py-2 text-sm font-medium text-ok">
            Se importaron {resultado.filas.toLocaleString('es-PE')} contribuyentes del año {resultado.anio}.
          </p>
          <p className="text-sm text-tinta-suave">
            {resultado.enlazados.toLocaleString('es-PE')} tienen ficha en el sistema web. Los demás se muestran con su
            código SIMUN y se enlazan solos cuando se migre su ficha.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Ver la lista
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-sm text-tinta-suave">
            Sube el <span className="font-mono">puntajes_AAAA.csv</span> que genera{' '}
            <span className="font-mono">05_puntajes.py</span>. Si ya hay una lista de ese año, la nueva la reemplaza;
            la anterior queda en el historial y las gestiones registradas se conservan.
          </p>
          <div>
            <label htmlFor="imp-archivo" className="text-xs font-semibold text-slate-600">
              Archivo CSV
            </label>
            <input
              id="imp-archivo"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className={`${campoClase} file:mr-3 file:rounded file:border-0 file:bg-arena-suave file:px-3 file:py-1 file:text-sm`}
            />
          </div>
          <div>
            <label htmlFor="imp-modelo" className="text-xs font-semibold text-slate-600">
              Modelo
            </label>
            <input
              id="imp-modelo"
              type="text"
              maxLength={60}
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className={campoClase}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-ladrillo/30 bg-ladrillo/5 px-3 py-2 text-sm font-medium text-ladrillo">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 focus-visible:outline-3 focus-visible:outline-turquesa"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="rounded-md bg-mar-profundo px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-3 focus-visible:outline-turquesa disabled:opacity-50"
            >
              <i aria-hidden="true" className="bi bi-upload mr-1" />
              {enviando ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </form>
      )}
    </Dialogo>
  )
}
