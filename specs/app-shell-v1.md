# Spec: App shell y cabecera de página (v1)
<!-- Formato fijo 5 secciones. Las `*-v1.md` cerradas no se editan. -->

## 1. Historia y criterios
- Como ADMIN/SUPERVISOR/CAJERO, quiero navegar entre módulos desde una barra lateral y volver siempre a la pantalla anterior, para trabajar sin regresar al inicio cada vez.
- [ ] Criterio 1: toda ruta autenticada se muestra dentro de `AppShell` (barra lateral + barra superior + contenido); `/login` queda fuera y sin cambios.
- [ ] Criterio 2: la barra lateral lista Inicio y solo los módulos con nivel asignado (mismo filtro que las tarjetas del Dashboard), marca el actual y en móvil se abre como cajón.
- [ ] Criterio 3: la barra superior muestra migas de pan y menú de usuario con "Cerrar sesión" (`logout()` existente).
- [ ] Criterio 4: toda pantalla interna usa `PageHeader`: cabecera azul con ola, botón "Volver a {anterior}" (`volverA`) y una sola acción primaria a la derecha.
- [ ] Criterio 5: el Dashboard muestra saludo y módulos permitidos en un solo panel; "Nuevo contribuyente" solo aparece dentro de Registro Tributario.
- [ ] Criterio 6: AA (foco visible, teclado, contraste); flujo de auth intacto (401 = credenciales, resto = conexión).

## 2. Archivos afectados
- Frontend: `frontend/src/index.css` (tokens nuevos en `@theme`, foco global), `frontend/index.html` (fuente Source Serif 4 con fallback), `frontend/src/components/layout/{AppShell,Sidebar,Topbar,PageHeader}.tsx` (nuevos), `frontend/src/App.tsx` (layout con `<Outlet/>` en la zona autenticada), `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/modulos/*`, `ModuloPlaceholder.tsx`; pantallas de Rentas, Accesibilidad y Tablero: solo reemplazar cabecera (solo render).
- Backend: ninguno.

## 3. Diseño (máx 10 líneas)
Flujo: `Ruta autenticada -> RequireNivel -> AppShell(Sidebar + Topbar) -> PageHeader + contenido`. La barra lateral sale de `user.accesos`, no de una lista fija.
- El inicio orienta; las acciones de trabajo viven en su módulo.
- Iconos `bootstrap-icons`; sin dependencias nuevas de UI. Fuentes: Montserrat (ya en el login) para UI; Source Serif 4 solo en títulos y cifras. Ola del login sin animar en la cabecera.
- Sin sombras; borde 1px `borde`; paneles `rounded-panel`; ancho único `max-w-content`.
- Cabecera: `bg-gradient-to-r from-mar-profundo via-mar-medio to-mar`. Deuda, errores y eliminar en `ladrillo` (`coral` queda solo para el login).
- No se hace: indicadores con datos (spec aparte `dashboard-kpis-v1`, requiere endpoint de resumen), buscador global, modo oscuro, cambios en `Login.tsx` ni backend.

Tokens nuevos (los del login no se tocan; ver `frontend/src/index.css`):
`mar-medio #0f4c6e` · `tinta #1b2733` · `tinta-suave #566272` · `borde #e6e0d2` · `arena-suave #f3eee0` · `ladrillo #a63a32` · `ok #23684b` / `ok-fondo #e3f2ea` · `aviso #8a5a12` / `aviso-fondo #fbefd5` · `font-serif` Source Serif 4 · `rounded-panel` 12px · `max-w-content` 1120px.

## 4. Tareas
- [ ] Rama `feat/app-shell` desde `main`.
- [ ] `index.css`: añadir los tokens nuevos al `@theme` y el foco global (sin cambiar los del login). Verificar cómo se carga Montserrat (`index.html` o paquete) y cargar Source Serif 4 igual, con fallback.
- [ ] Crear `AppShell`, `Sidebar`, `Topbar`, `PageHeader` y envolver las rutas autenticadas.
- [ ] Migrar Dashboard, hubs de módulo, `ModuloPlaceholder`, Registro Tributario, Accesibilidad y Auditoría a `PageHeader`.
- [ ] `lint` + `build`; probar móvil y teclado.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · login `admin/admin123` (`:5173` + `:3000`): ver la barra lateral con sus módulos, quitar `caja` a un rol y comprobar que no aparece ni abre, entrar a Registro Tributario > ficha y volver con el botón.