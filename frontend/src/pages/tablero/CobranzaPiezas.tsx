import {
  ESTADO_ESTILO,
  ESTADO_TEXTO,
  GRUPOS,
  GRUPO_BARRA,
  GRUPO_ESTILO,
  GRUPO_TEXTO,
  anchosBarra,
  porcentaje,
  type EstadoGestion,
  type Grupo,
  type Puntaje,
} from './cobranzaFormato'

export function EtiquetaGrupo({ grupo }: { grupo: Grupo }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${GRUPO_ESTILO[grupo]}`}>
      {GRUPO_TEXTO[grupo]}
    </span>
  )
}

/** `corto` para columnas angostas: "Compromiso de pago" pasa a "Compromiso". */
export function EtiquetaEstado({ estado, corto = false }: { estado: EstadoGestion; corto?: boolean }) {
  return (
    <span
      title={ESTADO_TEXTO[estado]}
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_ESTILO[estado]}`}
    >
      {corto && estado === 'COMPROMISO' ? 'Compromiso' : ESTADO_TEXTO[estado]}
    </span>
  )
}

/** Las 3 probabilidades en una barra apilada + la de no pagar como cifra. */
export function BarraProbabilidades({ p }: { p: Pick<Puntaje, 'pPuntual' | 'pTardio' | 'pIncobrable'> }) {
  const anchos = anchosBarra(p)
  const valor: Record<Grupo, number> = { PUNTUAL: p.pPuntual, TARDIO: p.pTardio, INCOBRABLE: p.pIncobrable }
  const descripcion = GRUPOS.map((g) => `${GRUPO_TEXTO[g]} ${porcentaje(valor[g])}`).join(', ')
  return (
    <div className="min-w-28" title={descripcion}>
      <p className="text-right font-semibold tabular-nums text-tinta">{porcentaje(p.pIncobrable)}</p>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={descripcion}>
        {GRUPOS.map((g) => (
          <span key={g} className={GRUPO_BARRA[g]} style={{ width: `${anchos[g]}%` }} />
        ))}
      </div>
    </div>
  )
}

export function LeyendaGrupos() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tinta-suave">
      {GRUPOS.map((g) => (
        <span key={g} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-2 w-3 rounded-sm ${GRUPO_BARRA[g]}`} />
          {GRUPO_TEXTO[g]}
        </span>
      ))}
    </p>
  )
}
