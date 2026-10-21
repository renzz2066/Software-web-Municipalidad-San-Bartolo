import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Accesibilidad } from './pages/Accesibilidad'
import { Usuarios } from './pages/accesibilidad/Usuarios'
import { NuevoUsuario } from './pages/accesibilidad/NuevoUsuario'
import { EditarUsuario } from './pages/accesibilidad/EditarUsuario'
import { Roles } from './pages/accesibilidad/Roles'
import { NuevoRol } from './pages/accesibilidad/NuevoRol'
import { EditarRol } from './pages/accesibilidad/EditarRol'
import { Niveles } from './pages/accesibilidad/Niveles'
import { AccesosPorRol } from './pages/accesibilidad/AccesosPorRol'
import { Auditoria } from './pages/accesibilidad/Auditoria'
import { ModuloPlaceholder } from './pages/accesibilidad/ModuloPlaceholder'
import { ModuloHub } from './pages/modulos/ModuloHub'
import { MODULOS } from './pages/modulos/catalogo'
import { Maestros } from './pages/rentas/maestros/Maestros'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RequireNivel } from './routes/RequireNivel'

// Submódulos ya implementados; el resto muestra "En construcción".
const PAGINAS_SUBMODULO: Record<string, ReactNode> = {
  'rentas.maestros': <Maestros />,
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad">
              <Accesibilidad />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/usuarios"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.usuarios">
              <Usuarios />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/usuarios/nuevo"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.usuarios">
              <NuevoUsuario />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/usuarios/:id/editar"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.usuarios">
              <EditarUsuario />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/roles"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.roles">
              <Roles />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/roles/nuevo"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.roles">
              <NuevoRol />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/roles/:id/editar"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.roles">
              <EditarRol />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/niveles"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.niveles">
              <Niveles />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/accesos-por-rol"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.accesos-por-rol">
              <AccesosPorRol />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/auditoria"
        element={
          <ProtectedRoute>
            <RequireNivel codigo="accesibilidad.auditoria">
              <Auditoria />
            </RequireNivel>
          </ProtectedRoute>
        }
      />
      {MODULOS.map((modulo) => (
        <Route
          key={modulo.codigo}
          path={`/${modulo.codigo}`}
          element={
            <ProtectedRoute>
              <RequireNivel codigo={modulo.codigo}>
                <ModuloHub modulo={modulo} />
              </RequireNivel>
            </ProtectedRoute>
          }
        />
      ))}
      {MODULOS.flatMap((modulo) =>
        modulo.submodulos.map((sub) => (
          <Route
            key={`${modulo.codigo}.${sub.slug}`}
            path={`/${modulo.codigo}/${sub.slug}`}
            element={
              <ProtectedRoute>
                <RequireNivel codigo={`${modulo.codigo}.${sub.slug}`}>
                  {PAGINAS_SUBMODULO[`${modulo.codigo}.${sub.slug}`] ?? (
                    <ModuloPlaceholder
                      icono={sub.icono}
                      titulo={sub.titulo}
                      descripcion={modulo.titulo}
                      volverA={`/${modulo.codigo}`}
                      volverTexto={modulo.titulo}
                    />
                  )}
                </RequireNivel>
              </ProtectedRoute>
            }
          />
        )),
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
