import { Navigate, Route, Routes } from 'react-router-dom'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Accesibilidad } from './pages/Accesibilidad'
import { Usuarios } from './pages/accesibilidad/Usuarios'
import { Roles } from './pages/accesibilidad/Roles'
import { Niveles } from './pages/accesibilidad/Niveles'
import { AccesosPorRol } from './pages/accesibilidad/AccesosPorRol'
import { ProtectedRoute } from './routes/ProtectedRoute'

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
            <Accesibilidad />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/usuarios"
        element={
          <ProtectedRoute>
            <Usuarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/roles"
        element={
          <ProtectedRoute>
            <Roles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/niveles"
        element={
          <ProtectedRoute>
            <Niveles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accesibilidad/accesos-por-rol"
        element={
          <ProtectedRoute>
            <AccesosPorRol />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
