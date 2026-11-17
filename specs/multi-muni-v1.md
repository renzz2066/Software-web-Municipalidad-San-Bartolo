# Spec: Multi-municipalidad por dirección (v1)

## 1. Historia y criterios
- Como ADMIN de una municipalidad, quiero entrar por la dirección de mi muni (`sanbartolo.…`, `demo.…`) y que el sistema use **su** base y **su** identidad, para atender a varias munis con un solo código sin cruzar datos.
- [x] Criterio 1 (resolución): `sanbartolo.localhost:5173` usa la base `muni_san_bartolo` y `demo.localhost:5173` usa `muni_demo`; `localhost:5173` (sin subdominio) usa `MUNI_DEFAULT`, así que el flujo actual sigue igual.
- [x] Criterio 2 (muni desconocida): un subdominio que no está en el registro muestra "Municipalidad no encontrada" y el API responde `404 {message, statusCode}`. **Nunca** cae en la muni por defecto.
- [x] Criterio 3 (aislamiento de sesión): el JWT lleva `muni`. Un token de San Bartolo usado en Demo → `401`. Si el usuario y la contraseña existen en las dos bases, cada login sigue siendo independiente.
- [x] Criterio 4 (identidad visual): `GET /muni/config` (público) → `{slug, nombre, nombreCorto, escudoUrl, fondoUrl, colores}`. El login, la barra lateral, el recibo de caja y el estado de cuenta imprimible muestran el nombre y el escudo de la muni activa; ya no tienen "San Bartolo" fijo.
- [x] Criterio 5 (auditoría): los triggers siguen registrando en la base de la muni activa. Ninguna escritura de Demo aparece en la auditoría de San Bartolo.
- [x] Criterio 6 (migraciones): `npm run db:setup:todas` aplica migraciones y seed a cada base del registro. Si una falla, se detiene y dice cuál.
- [x] Criterio 7 (errores): 401 = credenciales o muni equivocada; un fallo de conexión a la base de una muni → `503` con un mensaje legible, sin tumbar las demás munis.

## 2. Archivos afectados
- Backend: `backend/src/muni/` (nuevo: registro, middleware, `muni.controller.ts`, `*.spec.ts`), `prisma/prisma.service.ts`, `auth/auth.service.ts` y su guard JWT, `main.ts` (CORS), `app.module.ts`.
- Frontend: `frontend/src/lib/api.ts` (cabecera `X-Muni`), `frontend/src/muni/` (nuevo: contexto + hook `useMuni`), `pages/Login.tsx`, `components/layout/Sidebar.tsx`, `pages/caja/ReciboImprimible.tsx`, `pages/rentas/estado-cuenta/EstadoCuentaImprimible.tsx`, `index.css` (colores como variables).
- Config: `backend/config/munis.json` (nuevo, sin secretos), `backend/.env.example` y `.env.local-lab.example` (`MUNI_DEFAULT`, `DATABASE_URL__<SLUG>`), `backend/scripts/db-setup.mjs`, `frontend/public/munis/<slug>/` (escudo y fondo).

## 3. Diseño (máx 10 líneas)
Flujo: `Navegador (subdominio) → api.ts manda X-Muni → MuniMiddleware valida contra munis.json → AsyncLocalStorage {muni} → PrismaService delega al cliente de esa muni → BD de la muni`.
- **Una base por muni**, que es lo que ya prepara `infra/`. Se descarta tener una sola base con una columna `municipalidadId`: el riesgo de cruzar deudas y cobros entre munis es inaceptable.
- `munis.json` guarda `slug`, nombres, hosts, rutas de imágenes y colores. La URL de cada base va en el env `DATABASE_URL__<SLUG>`, nunca en el JSON. Si falta el env de una muni, el arranque falla diciendo cuál.
- `PrismaService` mantiene un `Map<slug, cliente>` perezoso y le aplica a cada cliente la misma extensión de auditoría. Usa el mismo patrón de `AsyncLocalStorage` que `contextoAuditoria`, así que **los servicios de dominio no cambian**.
- La muni sale del hostname del **frontend** (el API vive en otro origen) y viaja en `X-Muni`. El backend no confía en ella sola: el guard exige que `X-Muni` coincida con la `muni` del JWT.
- `MUNIS` (env) lista las munis activas; sin `MUNIS` solo corre `MUNI_DEFAULT`, que acepta `DATABASE_URL`: un `.env` de una sola muni sigue igual. Sin `X-Muni` (curl, scripts) → muni por defecto.
- CORS: los orígenes permitidos se arman desde los `hosts` de `munis.json` (más `FRONTEND_URL`). Solo `GET /muni/config` (público, sin credenciales) acepta cualquier origen, para que un subdominio desconocido lea su 404.
- NO se hace en v1: despliegue en producción (DNS, una base de Supabase por muni), panel para dar de alta munis, tributos o UIT distintos por muni (cada base ya tiene los suyos por seed), corpus IA por muni (`docs:ingest` se corre por base a mano) ni textos del chat IA.

## 4. Tareas
- [x] Rama `feat/multi-muni` desde `chore/entorno-multi-muni` (aún sin mergear a `main`).
- [x] Backend: registro + middleware + `PrismaService` por muni + `muni` en el JWT + `GET /muni/config` + CORS. Tests: resolución de muni (conocida, desconocida, por defecto), token con muni equivocada → 401, una muni sin env → error al arrancar.
- [x] Frontend: `useMuni`, cabecera `X-Muni`, pantalla "no encontrada" y reemplazo de "San Bartolo" fijo en las 4 pantallas del criterio 4 (también en los demás imprimibles: cierre de caja, valores, convenio, memorándum, requerimiento).
- [x] Script `db:setup:todas` y actualizar `infra/README.md`.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test && npm run build` · `npx prisma validate` · con `infra/` arriba: login `admin/admin123` en `sanbartolo.localhost:5173` y en `demo.localhost:5173`, crear un contribuyente en cada una y comprobar que no aparece en la otra; reusar el token de una en la otra → 401; `xyz.localhost:5173` → "no encontrada".
