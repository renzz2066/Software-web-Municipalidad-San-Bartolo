import { useState } from 'react'
import { soles } from '../../rentas/contribuyentes/tipos'

// U3b: desglose de efectivo y cuadre del vuelto (specs/utilitarios-v1.md). Lógica pura en centavos
// para no arrastrar errores de coma flotante.

// Billetes y monedas en circulación, de mayor a menor.
const DENOMINACIONES = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1] // centavos

function desglose(totalCentavos: number): { centavos: number; cantidad: number }[] {
  let resto = totalCentavos
  const filas: { centavos: number; cantidad: number }[] = []
  for (const d of DENOMINACIONES) {
    const cantidad = Math.floor(resto / d)
    resto -= cantidad * d
    if (cantidad > 0) filas.push({ centavos: d, cantidad })
  }
  return filas
}

const aCentavos = (texto: string) => {
  const n = Number(texto.trim().replace(',', '.'))
  return texto.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100)
}

function TablaDesglose({ titulo, centavos, id }: { titulo: string; centavos: number; id: string }) {
  const filas = desglose(centavos)
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {titulo}
      </h2>
      <p className="mt-1 text-lg font-bold text-mar-profundo">{soles((centavos / 100).toFixed(2))}</p>
      {filas.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">Sin efectivo que desglosar.</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
          {filas.map((f) => (
            <li key={f.centavos} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="text-slate-600">
                {soles((f.centavos / 100).toFixed(2))} {f.centavos >= 500 ? '(billete)' : '(moneda)'}
              </span>
              <span className="font-medium text-mar-profundo">× {f.cantidad}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Efectivo() {
  const [aPagar, setAPagar] = useState('')
  const [recibido, setRecibido] = useState('')

  const pagar = aCentavos(aPagar)
  const cobrado = aCentavos(recibido)
  const montosOk = pagar !== null && cobrado !== null
  const alcanza = montosOk && cobrado >= pagar
  const vuelto = montosOk && alcanza ? cobrado - pagar : 0

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ef-pagar" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Monto a pagar (S/)
          </label>
          <input
            id="ef-pagar"
            type="text"
            inputMode="decimal"
            value={aPagar}
            onChange={(e) => setAPagar(e.target.value)}
            placeholder="Ej. 173.50"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
        </div>
        <div>
          <label htmlFor="ef-recibido" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Efectivo recibido (S/)
          </label>
          <input
            id="ef-recibido"
            type="text"
            inputMode="decimal"
            value={recibido}
            onChange={(e) => setRecibido(e.target.value)}
            placeholder="Ej. 200"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa"
          />
        </div>
      </div>

      {(aPagar !== '' && pagar === null) || (recibido !== '' && cobrado === null) ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          Escribe un importe mayor o igual a 0.
        </p>
      ) : null}

      {montosOk && !alcanza && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          El efectivo recibido es menor que el monto a pagar: faltan {soles(((pagar - cobrado) / 100).toFixed(2))}.
        </p>
      )}

      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <TablaDesglose id="ef-tit-recibido" titulo="Desglose de lo recibido" centavos={cobrado ?? 0} />
        <div>
          <TablaDesglose id="ef-tit-vuelto" titulo="Vuelto a devolver" centavos={alcanza ? vuelto : 0} />
          {montosOk && alcanza && (
            <p className="mt-2 text-xs text-slate-500">
              {soles((pagar / 100).toFixed(2))} cobrados con {soles((cobrado / 100).toFixed(2))}.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Cálculo en centavos (sin decimales flotantes). Sirve para el arqueo de caja y para el vuelto de ventanilla.
      </p>
    </div>
  )
}
