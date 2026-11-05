import { Link, useSearchParams } from 'react-router-dom'
import { Documento } from './Documento'
import { Efectivo } from './Efectivo'
import { Mora } from './Mora'
import { UIT } from './UIT'

// Utilitarios → Calculadora (specs/utilitarios-v1.md, U1-U3, U6).

const PESTANAS = [
  { id: 'uit', titulo: 'UIT', ayuda: 'Convierte soles a UIT y viceversa con la UIT vigente del año.' },
  { id: 'mora', titulo: 'Mora y reajuste', ayuda: 'Deuda a una fecha con el IPM y la TIM vigentes.' },
  { id: 'documento', titulo: 'DNI / RUC', ayuda: 'Verifica el dígito verificador de un documento.' },
  { id: 'efectivo', titulo: 'Efectivo', ayuda: 'Desglose de billetes y monedas, y cuadre del vuelto.' },
] as const

type Pestana = (typeof PESTANAS)[number]['id']

export function Calculadora() {
  const [params, setParams] = useSearchParams()
  const id = params.get('tab')
  const pestana: Pestana = PESTANAS.some((p) => p.id === id) ? (id as Pestana) : 'uit'
  const actual = PESTANAS.find((p) => p.id === pestana)!

  return (
    <div className="min-h-screen bg-arena-claro p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
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
              <i className="bi bi-calculator" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-mar-profundo">Calculadora</h1>
              <p className="text-sm text-slate-500">{actual.ayuda}</p>
            </div>
          </div>
        </header>

        <nav aria-label="Herramientas de cálculo" role="tablist" className="mt-6 flex gap-1 overflow-x-auto">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setParams({ tab: p.id })}
              className={`whitespace-nowrap rounded-t-md px-4 py-2 text-sm font-medium focus-visible:outline-3 focus-visible:outline-turquesa ${
                pestana === p.id ? 'bg-white text-mar-profundo shadow-sm' : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              {p.titulo}
            </button>
          ))}
        </nav>

        <main role="tabpanel" className="rounded-b-xl rounded-tr-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10">
          {pestana === 'uit' && <UIT />}
          {pestana === 'mora' && <Mora />}
          {pestana === 'documento' && <Documento />}
          {pestana === 'efectivo' && <Efectivo />}
        </main>
      </div>
    </div>
  )
}
