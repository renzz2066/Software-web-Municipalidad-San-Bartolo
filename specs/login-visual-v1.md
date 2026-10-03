# Especificación: Login visual institucional San Bartolo (v1)

Rama: `feat/login-visual-sanbartolo` (base `feat/rentas-db-v1-postgres`). No se
fusiona directo a `main`: todo cambio va por Pull Request.

## 1. Requerimientos
- **Historia de Usuario**: Como personal de Rentas, quiero un login con identidad
  de la Municipalidad de San Bartolo para acceder al sistema con una interfaz
  institucional y no genérica.
- **Criterios de Aceptación**:
- [x] Criterio 1: El login muestra escudo oficial MDSB, nombre de la
  municipalidad y foto de la bahía; en móvil se adapta a banner superior.
- [x] Criterio 2: El flujo de autenticación responde igual que antes (JWT,
  error 401 → "Usuario o contraseña incorrectos", resto → error de conexión).
- [x] Criterio 3: Sin nuevas dependencias de UI salvo `bootstrap-icons`;
  estilos solo con React + Tailwind/CSS ya presentes en el proyecto.
- [x] Criterio 4: Contraste AA, foco visible, etiquetas `label` y navegación
  por teclado preserved (skill `ui-components.md`: accesibilidad WCAG).

## 2. Diseño Técnico
- **Componentes Afectados**: Frontend `src/pages/Login.tsx` (solo render),
  `src/index.css` (tokens `@theme` + animación ola), `src/main.tsx` (import del
  font de iconos), `public/escudo-mdsb.png`, `public/san-bartolo-bahia.jpg`.
  Hardening seguro: `src/context/AuthContext.tsx`, `src/lib/api.ts`.
- **Flujo de Datos**: `Usuario` -> `Formulario Web` -> `POST /auth/login` ->
  `accessToken + user en localStorage` -> `navigate('/')`. Sin cambios.
- **Decisiones**:
  - No se importó el CSS completo de Bootstrap (colisiona con Tailwind); solo el
    paquete de iconos `bootstrap-icons`.
  - Foto optimizada a JPG en `public/`; escudo PNG oficial de
    `gob.pe/munisanbartolo` (25-06-2021).
  - Correcciones auth aplicadas por ser seguras y no romper lógica:
    1. `JSON.parse` de sesión con `try/catch` + validación de forma
       (`id/usuario/rol`); si falla, limpia storage y sigue a login.
    2. `login()` aplica `trim()` solo a `usuario` (el password se envía intacto).
    3. Interceptor 401 global en `api.ts` que excluye `/auth/login` y emite
       `auth:expired`; `AuthContext` lo escucha y hace `logout()`. El error se
       re-lanza para que el login mantenga su mensaje de credenciales.

## 3. Lista de Tareas Ejecutables
- [x] Tarea 1: Crear rama aislada `feat/login-visual-sanbartolo`.
- [x] Tarea 2: Descargar escudo oficial y foto de la bahía a `frontend/public/`.
- [x] Tarea 3: Re-skin visual del login (split, paleta mar/arena, ola SVG).
- [x] Tarea 4: Reemplazar emojis por `bootstrap-icons` minimalistas.
- [x] Tarea 5: Hardening auth sin cambiar flujo.
- [x] Tarea 6: Verificar `npm run lint` (solo warnings previos de `AuthContext`)
  y `npm run build` (84–85 módulos OK), y login punta a punta con
  `admin/admin123` (frontend `:5173` + backend `:3000`).
- [ ] Tarea 7: Abrir Pull Request hacia `feat/rentas-db-v1-postgres` y revisión.
