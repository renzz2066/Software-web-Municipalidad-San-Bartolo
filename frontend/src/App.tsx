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
import { Auditoria } from './pages/tablero/Auditoria'
import { ModuloPlaceholder } from './pages/accesibilidad/ModuloPlaceholder'
import { ModuloHub } from './pages/modulos/ModuloHub'
import { MODULOS } from './pages/modulos/catalogo'
import { Maestros } from './pages/rentas/maestros/Maestros'
import { CalculoMasivo } from './pages/rentas/calculo/CalculoMasivo'
import { Contribuyentes } from './pages/rentas/contribuyentes/Contribuyentes'
import { ContribuyenteForm } from './pages/rentas/contribuyentes/ContribuyenteForm'
import { FichaContribuyente } from './pages/rentas/contribuyentes/FichaContribuyente'
import { Predio } from './pages/rentas/predios/Predio'
import { DeclaracionForm } from './pages/rentas/predios/DeclaracionForm'
import { EstadoCuentaImprimible } from './pages/rentas/estado-cuenta/EstadoCuentaImprimible'
import { ControlRecaudacion } from './pages/rentas/valores/ControlRecaudacion'
import { ValorImprimible } from './pages/rentas/valores/ValorImprimible'
import { ConvenioImprimible } from './pages/rentas/fraccionamiento/ConvenioImprimible'
import { MemorandumImprimible } from './pages/rentas/transferencias/MemorandumImprimible'
import { Cobro } from './pages/caja/Cobro'
import { Fiscalizacion } from './pages/rentas/fiscalizacion/Fiscalizacion'
import { Expediente } from './pages/rentas/fiscalizacion/Expediente'
import { FichaInspeccion } from './pages/rentas/fiscalizacion/FichaInspeccion'
import { RequerimientoImprimible } from './pages/rentas/fiscalizacion/RequerimientoImprimible'
import { ReciboImprimible } from './pages/caja/ReciboImprimible'
import { Extornos } from './pages/caja/Extornos'
import { Reportes } from './pages/caja/Reportes'
import { CierreCaja, CierreImprimible } from './pages/caja/CierreCaja'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RequireNivel } from './routes/RequireNivel'

// Submódulos ya implementados; el resto muestra "En construcción".
const PAGINAS_SUBMODULO: Record<string, ReactNode> = {
  'tablero.auditoria': <Auditoria />,
  'rentas.maestros': <Maestros />,
  'rentas.registro-tributario': <Contribuyentes />,
  'rentas.calculo-masivo': <CalculoMasivo />,
  'rentas.control-recaudacion': <ControlRecaudacion />,
  'rentas.fiscalizacion': <Fiscalizacion />,
  'caja.cancelaciones': <Cobro />,
  'caja.extornos': <Extornos />,
  'caja.reportes': <Reportes />,
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Zona autenticada: todo se muestra dentro de AppShell (barra lateral + barra superior).
          /login queda fuera y sin cambios; RequireNivel sigue por ruta. */}
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route
          path="/"
          element={<Dashboard />}
        />
        <Route
          path="/accesibilidad"
          element={
            <RequireNivel codigo="accesibilidad">
              <Accesibilidad />
            </RequireNivel>
          }
        />
        <Route
          path="/accesibilidad/usuarios"
          element={
            <RequireNivel codigo="accesibilidad.usuarios">
              <Usuarios />
            </RequireNivel>
          }
        />
        <Route
          path="/accesibilidad/usuarios/nuevo"
          element={
            <RequireNivel codigo="accesibilidad.usuarios">
              <NuevoUsuario />
            </RequireNivel>
          }
        />
        <Route
          path="/accesibilidad/usuarios/:id/editar"
          element={
            <RequireNivel codigo="accesibilidad.usuarios">
              <EditarUsuario />
            </RequireNivel>
          }
        />
        <Route
          path="/accesibilidad/roles"
          element={
            <RequireNivel codigo="accesibilidad.roles">
              <Roles />
            </RequireNivel>
          }
        />
        <Route
          path="/accesibilidad/roles/nuevo"
          element={
            <RequireNivel codigo="accesibilidad.roles">
              <NuevoRol />
            </RequireNivel>
          }
        />
        <Route
          path="/accesibilidad/roles/:id/editar"
          element={
            <RequireNivel codigo="accesibilidad.roles">
              <EditarRol />
            </RequireNivel>
          }
        />
        <Route
          path="/accesibilidad/niveles"
          element={
            <RequireNivel codigo="accesibilidad.niveles">
              <Niveles />
            </RequireNivel>
          }
        />
        <Route
          path="/accesibilidad/accesos-por-rol"
          element={
            <RequireNivel codigo="accesibilidad.accesos-por-rol">
              <AccesosPorRol />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/registro-tributario/contribuyentes/nuevo"
          element={
            <RequireNivel codigo="rentas.registro-tributario">
              <ContribuyenteForm />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/registro-tributario/contribuyentes/:id"
          element={
            <RequireNivel codigo="rentas.registro-tributario">
              <FichaContribuyente />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/registro-tributario/contribuyentes/:id/editar"
          element={
            <RequireNivel codigo="rentas.registro-tributario">
              <ContribuyenteForm key="editar" />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/registro-tributario/contribuyentes/:id/estado-cuenta"
          element={
            <RequireNivel codigo="rentas.registro-tributario">
              <EstadoCuentaImprimible />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/registro-tributario/predios/nuevo"
          element={
            <RequireNivel codigo="rentas.registro-tributario">
              <DeclaracionForm key="nuevo" />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/registro-tributario/predios/:id"
          element={
            <RequireNivel codigo="rentas.registro-tributario">
              <Predio />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/registro-tributario/predios/:id/declaracion"
          element={
            <RequireNivel codigo="rentas.registro-tributario">
              <DeclaracionForm key="declaracion" />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/control-recaudacion/valores/:id"
          element={
            <RequireNivel codigo="rentas.control-recaudacion">
              <ValorImprimible />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/control-recaudacion/convenios/:id"
          element={
            <RequireNivel codigo="rentas.control-recaudacion">
              <ConvenioImprimible />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/control-recaudacion/transferencias/:id"
          element={
            <RequireNivel codigo="rentas.control-recaudacion">
              <MemorandumImprimible />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/fiscalizacion/expedientes/:id"
          element={
            <RequireNivel codigo="rentas.fiscalizacion">
              <Expediente />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/fiscalizacion/expedientes/:id/fichas/:predioId"
          element={
            <RequireNivel codigo="rentas.fiscalizacion">
              <FichaInspeccion />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/registro-tributario/valores/:id"
          element={
            <RequireNivel codigo="rentas.registro-tributario">
              <ValorImprimible />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/fiscalizacion/valores/:id"
          element={
            <RequireNivel codigo="rentas.fiscalizacion">
              <ValorImprimible />
            </RequireNivel>
          }
        />
        <Route
          path="/rentas/fiscalizacion/expedientes/:id/requerimiento"
          element={
            <RequireNivel codigo="rentas.fiscalizacion">
              <RequerimientoImprimible />
            </RequireNivel>
          }
        />
        <Route
          path="/caja/cierre"
          element={
            <RequireNivel codigo="caja">
              <CierreCaja />
            </RequireNivel>
          }
        />
        <Route
          path="/caja/cierres/:id"
          element={
            <RequireNivel codigo="caja">
              <CierreImprimible />
            </RequireNivel>
          }
        />
        <Route
          path="/caja/recibos/:id"
          element={
            <RequireNivel codigo="caja">
              <ReciboImprimible />
            </RequireNivel>
          }
        />
        {MODULOS.map((modulo) => (
          <Route
            key={modulo.codigo}
            path={`/${modulo.codigo}`}
            element={
              <RequireNivel codigo={modulo.codigo}>
                <ModuloHub modulo={modulo} />
              </RequireNivel>
            }
          />
        ))}
        {MODULOS.flatMap((modulo) =>
          modulo.submodulos.map((sub) => (
            <Route
              key={`${modulo.codigo}.${sub.slug}`}
              path={`/${modulo.codigo}/${sub.slug}`}
              element={
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
              }
            />
          )),
        )}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
