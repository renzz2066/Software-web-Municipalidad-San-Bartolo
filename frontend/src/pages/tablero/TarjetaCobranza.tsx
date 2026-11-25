import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { BarraProbabilidades, EtiquetaEstado, EtiquetaGrupo } from './CobranzaPiezas'
import { soles, type Puntaje } from './cobranzaFormato'

type PuntajeFicha = Puntaje & { totalLista: number; modelo: string }

// P7: lo que dice el modelo de este contribuyente, en su ficha. Si no está en la lista, no se muestra.
export function TarjetaCobranza({ contribuyenteId }: { contribuyenteId: number }) {
  const [p, setP] = useState<PuntajeFicha | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<PuntajeFicha | null>(`/cobranza/contribuyentes/${contribuyenteId}`)
      .then(({ data }) => !cancelled && setP(data || null))
      .catch(() => !cancelled && setP(null)) // informativa: si falla no bloquea la ficha
    return () => {
      cancelled = true
    }
  }, [contribuyenteId])

  if (!p) return null

  return (
    <section
      aria-labelledby="cobranza-titulo"
      className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-panel border border-borde bg-white p-5"
    >
      <div className="min-w-0 flex-1">
        <h2 id="cobranza-titulo" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Priorización de cobranza {p.anio}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-tinta">
          <EtiquetaGrupo grupo={p.grupo} />
          <span>
            Prioridad <strong className="tabular-nums">{p.prioridad.toLocaleString('es-PE')}</strong> de{' '}
            {p.totalLista.toLocaleString('es-PE')} · tramo <strong>{p.tramo}</strong>
          </span>
          <EtiquetaEstado estado={p.estadoGestion} />
        </p>
        <p className="mt-1 text-sm text-tinta-suave">{p.accion}</p>
      </div>
      <div className="w-36">
        <p className="text-xs text-slate-500">Prob. de no pagar</p>
        <BarraProbabilidades p={p} />
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-500">Deuda esperada</p>
        <p className="font-serif text-lg font-bold tabular-nums text-ladrillo">{soles(p.deudaEsperada)}</p>
        <Link
          to={`/tablero/priorizacion-cobranza?q=${p.codigoLegacy}`}
          className="text-xs font-medium text-mar hover:underline focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          Ver en la lista
        </Link>
      </div>
    </section>
  )
}
