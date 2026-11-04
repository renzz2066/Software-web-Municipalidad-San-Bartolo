# Spec: Auditoría se muda al Tablero Gerencial (v1)
<!-- Formato fijo 5 secciones. Las `*-v1.md` cerradas no se editan. -->

## 1. Historia y criterios
- Como ADMIN, quiero que la pantalla de Auditoría viva dentro de **Tablero Gerencial** (donde
  consulta la gerencia los movimientos del sistema) y que deje de formar parte de
  Accesibilidad, para que el monitoreo quede agrupado con los indicadores de gerencia.
  La pantalla, sus filtros y su endpoint **no cambian**: solo cambia el módulo que la aloja.
- [x] A1: el nivel `accesibilidad.auditoria` pasa a `tablero.auditoria` ("Auditoría",
  orden 2 bajo `tablero`, tras Resumen) en `NIVELES_CATALOGO`; el nodo viejo se elimina
  del catálogo (conteo neto 0: el catálogo de `main` tiene 35 nodos y sigue en 35:
  −1 +1).
- [x] A2: migración idempotente `20261104120000_auditoria_gerencial` que **re-ubica la fila
  existente conservando su `id`** (UPDATE de `codigo`, `padreId` → módulo `tablero`,
  `orden=2`): como el `id` no cambia, `rol_nivel` sigue apuntando igual y **todos los roles
  conservan el acceso sin reasignar nada**. Rama de respaldo si la fila nueva ya existiera
  (sync corrido antes): re-apunta los accesos viejos y borra la fila vieja. Sin cambios de
  schema; sin `migrate dev` ni `reset`.
- [x] A3: ruta `/tablero/auditoria` generada por el catálogo con
  `RequireNivel codigo="tablero.auditoria"` (sin nivel → `/`, como hoy); se elimina la ruta
  explícita `/accesibilidad/auditoria` (el bookmark viejo cae en el catch-all `*` → `/`).
- [x] A4: tarjeta "Auditoría" en el hub de Tablero Gerencial (junto a Resumen) y **eliminada
  de `/accesibilidad`**; el guard del backend queda `@Roles('ADMIN') +
  @RequireNivel('tablero.auditoria')` (mismo contrato de `GET /auditoria`).
- [ ] A5: la pantalla funciona idéntica: filtros en la URL, paginación 20/50/100, detalle
  modal con diff, estados y permisos iguales; solo cambia el back-link ("Tablero Gerencial"
  → `/tablero` en lugar de "Accesibilidad" → `/accesibilidad`). **Pendiente de verificación
  visual en navegador** (ver §5).
- [x] A6: un rol personalizado que ya tuviera `accesibilidad.auditoria` sigue viendo la
  tarjeta y consultando `GET /auditoria` sin reasignar accesos (garantizado por conservar
  el `id`; en la BD solo existe el rol ADMIN, verificado apuntando a `tablero.auditoria`).

## 2. Archivos afectados
- Frontend (mover con `git mv` a `frontend/src/pages/tablero/`):
  `Auditoria.tsx` (back-link), `AuditoriaDetalle.tsx`, `auditoriaFormato.ts`,
  `auditoriaFormato.test.ts` (imports relativos internos no cambian).
  Edits: `frontend/src/App.tsx` (import, borra ruta explícita, entrada
  `PAGINAS_SUBMODULO['tablero.auditoria']` al principio del objeto),
  `frontend/src/pages/modulos/catalogo.ts` (`tablero.submodulos += auditoria`),
  `frontend/src/pages/Accesibilidad.tsx` (borra la tarjeta del array `OPCIONES`).
- Backend: `backend/src/niveles/niveles.catalogo.ts` (quita el nodo de accesibilidad, lo
  agrega en `modulo('tablero', ...)`), `backend/src/auditoria/auditoria.controller.ts`
  (`@RequireNivel('tablero.auditoria')`),
  `backend/prisma/migrations/20261104120000_auditoria_gerencial/migration.sql` (nueva).
- Specs: este archivo + 1 línea en `specs/_index.md` (insertada después de
  `auditoria-pantalla-v1.md`, no al final, para no conflicear con los PR #16 y #17).
- Sin cambios: schema, DTO, servicio, `seed.ts`, `POST /niveles/sincronizar`, Dashboard,
  `ModuloHub`, `RequireNivel`, `AccesosContext`. Specs cerradas que mencionan
  `/accesibilidad/auditoria` (`auditoria-pantalla-v1`, `caja-v1`, `rentas-*`) no se editan.

## 3. Diseño (máx 10 líneas)
Flujo sin cambios: hub `ModuloHub` (catálogo) → ruta genérica `/tablero/auditoria` →
`RequireNivel 'tablero.auditoria'` → `PAGINAS_SUBMODULO` → `Auditoria.tsx` → `GET /auditoria`
(sin cambios de contrato; sigue exigiendo ADMIN + nivel). La visibilidad en ambos hubs y el
gating salen del mismo sitio de siempre: los códigos de `rol_nivel` en BD. La migración solo
hace `UPDATE niveles SET codigo='tablero.auditoria', "padreId"=(id de tablero), orden=2
WHERE codigo='accesibilidad.auditoria'` (+ rama de respaldo si ya existiera la fila nueva:
re-apuntar `rol_nivel` con `ON CONFLICT DO NOTHING`, borrar la fila vieja). Idempotente y
corre en cualquier orden respecto al seed: si el seed corrió primero, la rama de respaldo
limpia; si no, el update deja la fila lista y el seed la refresca por código.
No se hace: renombrar pantallas, cambiar filtros/columnas del detalle, crear índice nuevo,
editar specs cerradas.

### Riesgos y dudas
- **D1 Migración vs solo sync** (decidido): elegido **UPDATE con mismo `id`** porque es la
  única opción que conserva los accesos de roles personalizados; el sync solo crea la fila
  nueva y dejaría la vieja huérfana bajo Accesibilidad (39 niveles y roles sin acceso).
- **D2 Orden de aplicación**: numerada `20261104...` para quedar después de la migración de
  coactiva (`20261102120000_coactiva_v1`, PR #16) cuando se fusione; la BD actual ya tiene
  14 migraciones de `main` aplicadas (la de coactiva está aplicada por `deploy` desde su
  rama), `migrate deploy` desde esta rama solo aplicará la nueva → 15 en disco.
- **D3 URL vieja**: no se agrega redirect explícito; `/accesibilidad/auditoria` cae en el
  catch-all `*` → `/` (comportamiento estándar del sistema para rutas desconocidas).
- **D4 Descripción del nivel**: el helper `modulo()` no da descripción por hijo (igual que
  el resto de los módulos); se pierde el texto "Movimientos y sesiones registrados (solo
  ADMIN)" de la pantalla de Niveles. Nombre "Auditoría" y comportamiento no cambian.
- **D5 Specs históricas**: `auditoria-pantalla-v1.md` (cerrada) documenta el nivel y la ruta
  viejos; queda como registro histórico, no se edita.
- **D6 Huérfanos de otra rama**: la BD acumula 3 filas del PR #17 (`utilitarios.calendario`,
  `utilitarios.buscador`, `utilitarios.exportar`) porque el sync nunca borra; al fusionar
  #17 pasan a catálogo oficial y dejan de ser huérfanas. No afectan a esta rama.

## 4. Tareas
- [x] Rama `auditoria-gerencial` desde `main` (nunca rama de producción).
- [x] Spec + registro en `specs/_index.md`.
- [x] Backend: catálogo de niveles (nodo a `tablero`), `@RequireNivel` en el controller.
- [x] Migración idempotente + `migrate deploy` + `migrate status` + `db seed`.
- [x] Frontend: `git mv` de los 4 archivos, back-link, `App.tsx` (import/ruta/entrada),
  catálogo de módulos, quitar tarjeta de Accesibilidad.
- [x] `lint` + `test` + `build` (front) y `lint` + `test` (back) + `prisma validate`.

## 5. Verificación
`cd backend && npm run lint && npm run test && npx prisma validate && npx prisma migrate
deploy && npx prisma migrate status && npx prisma db seed`.

Hecho: backend `lint` 0 · **163/163** tests · `prisma validate` ok · `migrate deploy` aplicó
`20261104120000_auditoria_gerencial` · `migrate status` **15/15** up to date · seed
"Niveles sincronizados: **35**" (catálogo neto −1 +1). Verificación directa de BD (script
solo lectura): fila **#6 = `tablero.auditoria`** con `id` conservado, `padre=#34` (tablero),
`orden=2`; **sin rastro** de `accesibilidad.auditoria`; accesos: rol ADMIN (`rolId 1`) →
`tablero.auditoria`. BD con 38 filas = 35 del catálogo + 3 huérfanas del PR #17 (D6).
Frontend `lint` 0 (solo los 3 avisos preexistentes) · **9/9** tests · `tsc -b && vite build`
0 errores.

Compatibilidad con los PR abiertos (`git merge-tree --write-tree`, exit 0 = 0 conflictos):
- vs `feat/coactiva-v1` (PR #16) → árbol `7b75107` que contiene `tablero.auditoria` +
  `coactivo.recepcion/asignar-valores` + ambas líneas de spec.
- vs `utilitarios` (PR #17) → árbol `0f7fb57` que contiene `tablero.auditoria` +
  `utilitarios.*` + ambas líneas de spec.
Es decir: los tres PR se pueden fusionar a `main` **en cualquier orden** sin resolución manual.

Pendiente: **A5 en vivo** con backend corriendo en `:3000` y front en `:5173`
(`admin/admin123`): tarjeta "Auditoría" visible en Tablero Gerencial (junto a Resumen) y
**ausente** en Accesibilidad; la pantalla abre idéntica (filtros, detalle, paginación) con
back-link "Tablero Gerencial"; `/accesibilidad/auditoria` redirige a `/`; con un rol sin el
nivel, `/tablero/auditoria` redirige a `/`.
