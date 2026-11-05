import { useState } from 'react'
import { verificarDocumento } from '../../../lib/validacion'

// U3a: verificador de DNI/RUC (specs/utilitarios-v1.md). Lógica pura, no consulta la base.

export function Documento() {
  const [texto, setTexto] = useState('')
  const r = verificarDocumento(texto)

  return (
    <div className="max-w-xl">
      <label htmlFor="doc-entrada" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        DNI o RUC
      </label>
      <input
        id="doc-entrada"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ej. 12345678 o 20131312955"
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
      />

      <div role="status" aria-live="polite" className="mt-4">
        {texto.trim() === '' ? (
          <p className="text-sm text-slate-500">Escribe un documento para verificarlo.</p>
        ) : (
          <div
            className={`rounded-md px-3 py-3 ${
              r.valido ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <i aria-hidden="true" className={`bi ${r.valido ? 'bi-check-circle' : 'bi-x-circle'}`} />
              {r.tipo === 'DESCONOCIDO' ? 'No reconocido' : r.tipo}
              {r.valido ? ' · válido' : ''}
            </p>
            <p className="mt-1 text-sm">{r.mensaje}</p>
          </div>
        )}
      </div>

      <ul className="mt-4 space-y-1 text-xs text-slate-500">
        <li>DNI: 8 dígitos. RENIEC asigna el número de forma correlativa, sin dígito verificador.</li>
        <li>RUC: 11 dígitos, prefijo 10, 15, 16, 17 o 20, con dígito verificador SUNAT (módulo 11).</li>
        <li>Misma regla que usa el formulario de Registro Tributario; el backend vuelve a validar.</li>
      </ul>
    </div>
  )
}
