import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAccesos } from '../context/AccesosContext'
import { PageHeader } from '../components/layout/PageHeader'
import { ACCESIBILIDAD, MODULOS } from './modulos/catalogo'

// Orden de botones de SIMUN; Accesibilidad ocupa el lugar de "Seguridad".
const TARJETAS = [...MODULOS, ACCESIBILIDAD]

export function Dashboard() {
  const { user } = useAuth()
  const { tiene, isLoading: isLoadingAccesos } = useAccesos()
  const visibles = TARJETAS.filter((t) => isLoadingAccesos || tiene(t.codigo))

  return (
    <div className="mx-auto max-w-content p-4 sm:p-8">
      <PageHeader titulo={`Bienvenido, ${user?.nombre ?? ''}`} descripcion={`Rol: ${user?.rol}`} />

      <main className="mt-6">
        <h2 className="mb-3 font-serif text-lg font-bold text-mar-profundo">Módulos</h2>
        {visibles.length === 0 && !isLoadingAccesos ? (
          <p className="rounded-panel border border-borde bg-white p-6 text-center text-sm text-tinta-suave">
            Tu rol no tiene módulos asignados.
          </p>
        ) : (
          <div className="overflow-hidden rounded-panel border border-borde bg-white">
            <div className="grid gap-px bg-borde sm:grid-cols-2">
              {visibles.map((tarjeta) => (
                <Link
                  key={tarjeta.codigo}
                  to={`/${tarjeta.codigo}`}
                  className="group flex items-start gap-4 bg-white p-5 transition-colors duration-150 hover:bg-arena-suave focus-visible:outline-3 focus-visible:outline-turquesa"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-mar-profundo to-mar text-xl text-white"
                  >
                    <i className={tarjeta.icono} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif font-semibold text-mar-profundo group-hover:text-mar">
                      {tarjeta.titulo}
                    </span>
                    <span className="mt-1 block text-sm text-tinta-suave">{tarjeta.descripcion}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-mar">
                      Abrir módulo
                      <i aria-hidden="true" className="bi bi-arrow-right" />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
