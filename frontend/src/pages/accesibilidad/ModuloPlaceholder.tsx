import { PageHeader } from '../../components/layout/PageHeader'

interface ModuloPlaceholderProps {
  icono: string
  titulo: string
  descripcion: string
  volverA?: string
  volverTexto?: string
}

export function ModuloPlaceholder({
  icono,
  titulo,
  descripcion,
  volverA = '/accesibilidad',
  volverTexto = 'Accesibilidad',
}: ModuloPlaceholderProps) {
  return (
    <div className="mx-auto max-w-content p-4 sm:p-8">
      <PageHeader
        titulo={titulo}
        descripcion={descripcion}
        volverA={{ etiqueta: volverTexto, ruta: volverA }}
      />

      <main className="mt-6 rounded-panel border border-borde bg-white p-8 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-mar-profundo/5 text-2xl text-mar"
        >
          <i className={icono} />
        </span>
        <p className="mt-3 font-serif font-semibold text-tinta">Estructura visual</p>
        <p className="mt-1 text-sm text-tinta-suave">
          La funcionalidad de este módulo aún no está implementada.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-borde bg-white px-4 py-2 text-sm font-medium text-tinta-suave/70"
          >
            Nuevo
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-borde bg-white px-4 py-2 text-sm font-medium text-tinta-suave/70"
          >
            Buscar
          </button>
        </div>
      </main>
    </div>
  )
}
