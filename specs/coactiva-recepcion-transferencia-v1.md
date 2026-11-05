# Spec: Cobranza Coactiva — recepción/transferencia y asignación de valores (v1)
<!-- Formato fijo 5 secciones. Port controlado de `feat/coactiva-recepcion-transferencia`. Las `*-v1.md` cerradas no se editan. -->

Base: `rentas-valores-v1` (OP/RD, estado `COACTIVO`) y `modulos-esqueleto-v1` (niveles `coactivo.*`
ya en catálogo). Origen: rama `feat/coactiva-recepcion-transferencia` (2 commits `3739af3`,`15f03da`
sobre `962c780`), portada a `main` por **opción A** (traer solo código nuevo + reescribir el esquema
a mano contra la BD viva, sin mezclar su `schema.prisma` divergente en snake_case).
Fuera de v1: calificar/desafectar valores, expedientes, consultas, estado de cuenta coactivo y
maestros de ejecutores/auxiliares por UI (se cargan por seed); los POST son de solo uso posterior.

## 1. Historia y criterios
- Como ADMIN/SUPERVISOR, quiero recibir un memorándum de transferencia de valores exigibles,
  transferir valores a cobranza coactiva con su ejecutor/auxiliar/tipo de gestión y asignar valores
  ya recibidos a un auxiliar, para que quede trazado el destino de cada valor.
- [x] K1 `GET /coactiva/recepcion-transferencia/{valores,valores/:id,memorandums,ejecutores,auxiliares,tipos-gestion}` → 200.
- [x] K2 `GET /coactiva/asignar-valores/{memorandums,auxiliares,valores/:memorandumId}` → 200.
- [x] K3 Recepción: solo valores `COACTIVO` con `transferenciaId` (transferidos por Rentas, V7), sin expediente y con
  cuotas `COACTIVO`; crea `coactivo_exp` (nº correlativo bajo advisory lock) con esas cuotas, sin tocar el valor
  (estado, `transferenciaId`, `fechaNotificacion`) y enlaza `ejecutorId/auxiliarId/tipoGestionId` activos.
- [x] K4 Asignación enlaza `valorCab.auxiliarAsignadoId` solo en valores recibidos y aún `COACTIVO`; los GET nunca escriben.
- [x] K5 Errores: 401 sin token, 404 valor/memorándum inexistente, 409 si no es recibible o ya tiene expediente.
- [x] K6 Escrituras multi-tabla en `$transaction` (regla 3) y auditoría por triggers (sin `creadoPorId`/`modificadoPorId`).

## 2. Archivos afectados
- Frontend: `frontend/src/pages/coactiva/**` (nuevo), `frontend/src/App.tsx` (2 imports + 2 entradas
  de `PAGINAS_SUBMODULO`); rutas salen del catálogo `pages/modulos/catalogo.ts` (ya los registraba).
  **No** se portan `tsconfig.app.json` (sigue `noUnusedLocals/noUnusedParameters: true`) ni el
  bloque muerto `declare module 'axios'` de `lib/api.ts`.
- Backend: `backend/src/coactiva/**` (nuevo), `src/app.module.ts` (registra `CoactivaModule`),
  `prisma/schema.prisma` (4 modelos nuevos + `CoactivoExp`/`ValorCab`), `prisma/seed.ts`
  (ejecutores/auxiliares), `prisma/migrations/20261102120000_coactiva_v1/`.

## 3. Diseño (máx 10 líneas)
Flujo: `Admin -> Pantalla coactivo -> GET/POST coactiva/** -> Prisma -> DB`.
Esquema portado a PascalCase + `@@map` para no romper el cliente de `main`: `ejecutores_coactivo`→
`EjecutorCoactivo`, `auxiliares_coactivo`→`AuxiliarCoactivo`, `memorandums_coactiva`→`MemorandumCoactiva`,
`tipos_gestion_coactiva`→`TipoGestionCoactiva`; `CoactivoExp.ejecutor/auxiliar: String` →
`ejecutorId/auxiliarId/tipoGestionId` (sin FK en `tipoGestionId`: la BD no la tiene); `ValorCab` gana
`memorandumId/auxiliarAsignadoId`. La BD real ya tenía estos objetos: la migración es idempotente
(`IF NOT EXISTS`/`IF EXISTS`) y añade `auditoria_habilitar` a las 4 tablas. No se porta el commit
huérfano `20261012120000_usuarios_oficina_texto` (`usuarios.oficinaNombre` no existe en BD ni en código).

## 4. Tareas
- [x] Rama `feat/coactiva-v1` desde `main` (nunca rama de producción).
- [x] Esquema sincronizado a mano + `prisma validate` + `migrate diff` → vacío.
- [x] Migración aplicada con `migrate deploy` (sin `migrate dev` ni prompt de reset) y `migrate status` OK.
- [x] Código portado: delegados PascalCase, `CoactivaModule`, `seed.ts`, `$transaction`.
- [x] `lint` + `build` + `test` backend y frontend.

## 5. Verificación
`cd backend && npm run lint && npm run build && npm run test` (192/192, incl. `coactiva/**/*.spec.ts`) · `npx prisma migrate status`
(15, up to date) · `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-url $DIRECT_URL --script`
→ vacío · `cd frontend && npm run lint && npm run build` · `npm run start:dev` y smoke:
login `admin/admin123`, regresión de 7 GET previos + los 9 GET nuevos de `/coactiva/**` → 200 ·
conteos sin cambio (`aux=3, ejec=3, memo=5, tg=4, exp=3, val=16`).
