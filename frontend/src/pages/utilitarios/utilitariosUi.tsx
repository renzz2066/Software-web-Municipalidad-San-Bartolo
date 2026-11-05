import { ANIO_MAX, ANIO_MIN, SIN_ACCESO } from './utilitariosApi'

// Componentes compartidos de las pantallas de Utilitarios (specs/utilitarios-v1.md).

/** Campo de año con el rango que el backend acepta. */
export function AnioCampo({
  id,
  valor,
  alCambiar,
  etiqueta = 'Año',
}: {
  id: string
  valor: number
  alCambiar: (anio: number) => void
  etiqueta?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        min={ANIO_MIN}
        max={ANIO_MAX}
        value={valor}
        onChange={(e) => alCambiar(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-turquesa sm:w-36"
      />
    </div>
  )
}

/** Aviso de una sección sin permisos o con error. El texto, no solo el color (AA). */
export function AvisoSeccion({ mensaje }: { mensaje: string }) {
  const sinAcceso = mensaje === SIN_ACCESO
  return (
    <p
      role={sinAcceso ? 'status' : 'alert'}
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        sinAcceso ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-700'
      }`}
    >
      {mensaje}
    </p>
  )
}
