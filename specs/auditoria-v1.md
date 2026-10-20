# Spec: Auditoría de movimientos y sesiones (v1)
<!-- Formato fijo 5 secciones. Las `*-v1.md` cerradas no se editan. -->

## 1. Historia y criterios
- Como ADMIN, quiero saber quién creó, modificó o desactivó qué registro, cuándo y desde
  dónde, y quién inició sesión (o lo intentó), para tener trazabilidad sin depender de cada
  formulario (falla de SIMUN: `S_*` + tablas espejo `a_<tabla>`).
- [x] C1: `POST /auth/login` OK → fila `LOGIN` (usuarioId, ip, userAgent). Fallido → fila
  `LOGIN_FALLIDO` con `usuarioNombre` = usuario intentado; la contraseña no aparece en ningún
  campo. La respuesta al cliente no cambia (401 mismo mensaje).
- [x] C2: `POST /auth/logout` (JWT) → fila `LOGOUT`, responde 204.
- [x] C3: crear/editar/desactivar usuarios, roles y accesos (`rol_nivel`) deja una fila por
  registro afectado. UPDATE guarda solo los campos que cambiaron (`datosAntes`/`datosDespues`);
  UPDATE sin cambios reales no genera fila. `password` nunca se guarda (si cambió: `"[CAMBIADO]"`).
- [x] C4: un `UPDATE`/`INSERT` hecho por SQL directo, script o proceso masivo también queda
  auditado (usuarioId `null` = SISTEMA, más `current_user` en `detalle`).
- [x] C5: `DELETE /users/:id` ya no borra: pone `activo=false` (204). No puedes desactivarte
  a ti mismo ni al último ADMIN activo.
- [x] C6: `creadoPorId`/`modificadoPorId` se llenan solos en servidor; lo que mande el cliente
  se ignora.
- [ ] (403 sin probar: no hay usuario no-ADMIN) C7: `GET /auditoria` solo ADMIN (otro rol → 403, sin token → 401). Filtros `usuarioId`,
  `tabla`, `accion`, `desde`, `hasta`, `registroId`; paginado `page`/`pageSize` (máx 100);
  orden `createdAt desc`. Respuesta `{items, total, page, pageSize}` (no es el wrapper prohibido).
- [x] C8: no existe endpoint para editar/borrar auditoría; un `UPDATE`/`DELETE`/`TRUNCATE`
  sobre `auditoria` falla en BD. La fecha la pone PostgreSQL (`now()`, `timestamptz`).

## 2. Archivos afectados
- Backend: `backend/prisma/schema.prisma`, migración nueva `prisma/migrations/<ts>_auditoria_v1`
  (incluye SQL de funciones/triggers), `backend/src/auditoria/*` (módulo nuevo: contexto ALS,
  middleware, interceptor, servicio, controller, DTO, specs), `src/prisma/prisma.service.ts`,
  `src/auth/auth.service.ts` + `auth.controller.ts`, `src/users/users.service.ts`,
  `src/roles/roles.service.ts`, `src/app.module.ts`. `BigInt` se serializa en `AuditoriaService.listar` (no en `main.ts`).
- Config agente: `skills/backend-db.md` (1 regla: escrituras multi-tabla con `$transaction`
  interactivo del `PrismaService`; tabla nueva → `auditoria_habilitar(...)` en su migración).
- Frontend: ninguno (ver duda D4 sobre logout).

## 3. Diseño (máx 10 líneas)
Flujo: `Request -> middleware (ip, userAgent) -> JwtAuthGuard -> interceptor (usuarioId,
modulo = @RequireNivel) -> AsyncLocalStorage -> Prisma $extends inyecta set_config(...,true)
en la MISMA transacción -> trigger PG calcula diff, quita sensibles, INSERT auditoria`.
Eventos sin tabla (LOGIN/LOGIN_FALLIDO/LOGOUT) → `AuditoriaService.registrarSesion()`.
Genérico: auditar una tabla nueva = `SELECT auditoria_habilitar('tabla', ARRAY['id'])` en su
migración; cero código en servicios. `setAccesos` pasa a delta (borra/crea solo lo que cambió)
para no auditar N filas falsas. Desactivar = UPDATE `activo` (no hay acción BAJA aparte).
No se hace: pantalla, auditoría de SELECT, lógica de rentas, retención/particionado.

### Mecanismo genérico: comparativa y recomendación
| | Interceptor Nest | Prisma `$extends` (diff en TS) | Trigger PG + `set_config` |
|---|---|---|---|
| Captura scripts / SQL crudo / masivos | No | No (`$queryRaw`, psql) | **Sí** |
| Sabe el "antes" | No (solo body) | Sí, con SELECT previo por escritura | Sí (`OLD`), gratis |
| `updateMany` de 1.9M filas (`cuenta_corriente`) | — | Cargaría las filas en Node | Por fila en BD |
| Mismo commit que el cambio | No | Difícil: necesita el cliente `tx` del llamador | Sí, siempre |
| Conoce usuario/ip/módulo | Sí | Sí (ALS) | Solo vía `set_config` |
| Tests con DB mockeada | Fácil | Fácil | Diff vive en SQL → requiere Postgres real |
| Depende de cada endpoint | **Sí (falla SIMUN)** | No | No |

Recomiendo **híbrido: trigger PG como fuente de verdad + extensión Prisma delgada que solo
inyecta contexto + interceptor que solo arma el contexto**. Es la única opción que cumple
"scripts y procesos masivos también quedan registrados" y escala a cuenta corriente. El
interceptor solo, repite SIMUN; `$extends` con diff en TS no ve SQL crudo y leer el
"antes" o insertar la auditoría fuera de la tx del llamador rompe la atomicidad (ver spike).

### Contexto con pooler (Supabase `:6543`, modo transacción)
- `set_config(clave, valor, true)` (local a la transacción). **Nunca `false`**: con pooler la
  conexión física se reutiliza y el usuario de una petición quedaría en otra.
- Escritura suelta → la extensión (`query.$allModels`) abre `base.$transaction(async tx =>
  { set_config; return tx[model][op](args) })` sobre el cliente **sin** extender (no recursa).
- `$transaction` interactivo → se sobreescribe con `$extends({ client })`: abre la tx en el
  cliente base, ejecuta `set_config` primero y pasa ese `tx` (sin extensión, no re-envuelve).
  La forma batch `$transaction([...])` se rechaza (lanza error): no puede fijar contexto.
- Spike (2026-10-19, pooler `:6543`, `connection_limit=1`), resultados:
  - OK: `set_config(...,true)` visible en la misma tx; 10 tx en paralelo sin cruce de valores;
    trigger en tabla temporal lee el contexto; override de `$transaction` funciona.
  - **Descartado** batch `[set_config, query(args)]` (ejemplo RLS de Prisma): `query(args)` corre
    fuera del batch y el trigger vería contexto vacío.
  - Tras el commit `current_setting` devuelve `''` (no `null`): el trigger usa `NULLIF(..., '')`.
  - Una escritura envuelta dentro de una tx que no pasó por el override no se bloquea, pero corre
    en **otra** tx (perdería atomicidad). El override evita ese caso: todo `$transaction` del
    `PrismaService` pasa por él. Pendiente: tipar el override en TS (puede requerir un cast).

### Schema propuesto (`schema.prisma`)
```prisma
enum AccionAuditoria { CREATE UPDATE DELETE LOGIN LOGIN_FALLIDO LOGOUT }

model Auditoria {
  id            BigInt          @id @default(autoincrement())
  usuarioId     Int?            // actor; null = SISTEMA/anónimo
  usuario       Usuario?        @relation(fields: [usuarioId], references: [id], onDelete: Restrict)
  usuarioNombre String?         @db.VarChar(50)  // snapshot; en LOGIN_FALLIDO = intentado
  accion        AccionAuditoria
  tabla         String          @db.VarChar(60)
  registroId    String?         @db.VarChar(50)  // PK compuesta → "rolId:nivelId"
  modulo        String?         @db.VarChar(100) // código de nivel, 'auth' o null
  ip            String?         @db.VarChar(45)
  userAgent     String?         @db.VarChar(255)
  datosAntes    Json?
  datosDespues  Json?
  detalle       Json?           // motivo de fallo, current_user en scripts
  createdAt     DateTime        @default(now()) @db.Timestamptz(6)

  @@index([createdAt])
  @@index([usuarioId, createdAt])
  @@index([tabla, registroId])
  @@index([accion, createdAt])
  @@map("auditoria")
}
```
- `onDelete: Restrict` (no `SetNull`: haría UPDATE sobre auditoría y el trigger lo bloquea).
- `Usuario`: `creadoPorId Int?`, `modificadoPorId Int?` (FK a `usuarios`, nullable porque
  las filas existentes y el seed no tienen autor). Mismo par en: `roles`, `oficinas`,
  `contribuyentes`, `predios`, `vehiculos`, `cuenta_corriente`, `pagos` (solo
  `modificadoPorId`; ya tiene `cajeroId`), `convenios` (ya tiene `creadoPorId`),
  `valores_cab`, `coactivo_exp`, `licencias`. Los llena un trigger `BEFORE` desde
  `app.usuario_id`, no el DTO.
- Migración SQL: `auditoria_diff`, `auditoria_registrar()` (AFTER ROW), `auditoria_autor()`
  (BEFORE ROW), `auditoria_habilitar(tabla, pk[])`, trigger que bloquea UPDATE/DELETE/TRUNCATE
  en `auditoria`, `ENABLE ROW LEVEL SECURITY` en `auditoria` sin políticas. Ignorados en el
  diff: `updatedAt`, `modificadoPorId`. Sensibles (se quitan): `password`.
- Triggers v1 en: `usuarios`, `roles`, `rol_nivel`, `oficinas`, `niveles`. Ver D3 para rentas.

### Riesgos y dudas
Aprobado 2026-10-19 con las propuestas: D1 e2e con Postgres real · D2 `Rol.activo` · D3 triggers
solo en tablas de seguridad (rentas: solo columnas) · D4 solo endpoint backend, sin cambio en
frontend · D5 login fail-open.
- **D1 Tests del diff**: con triggers, diff y exclusión de `password` viven en SQL; se prueban
  con `npm run test:e2e` contra un Postgres desechable (Docker local o branch de Supabase),
  no con mocks. Login y contexto sí van con vitest + mocks. ¿Aceptas? Si no, la alternativa
  es `$extends` con diff en TS, asumiendo que SQL crudo/masivo no se audita.
- **D2 Roles**: `Rol` no tiene `activo` y `DELETE /roles/:id` borra físico. Propongo agregar
  `Rol.activo` y que DELETE desactive (y que el login rechace usuarios con rol inactivo).
- **D3 Rentas**: ¿habilito ya los triggers en las tablas de rentas (sin tocar lógica) para
  que los módulos futuros nazcan auditados, o solo agrego columnas y se habilitan con cada módulo?
- **D4 Logout**: el JWT es stateless; `LOGOUT` solo se registra si el frontend llama
  `POST /auth/logout`. Requiere 1 línea en `frontend/src` (fuera del alcance dicho). ¿Va en v1?
- **D5 Fallo al auditar login**: propongo fail-open (si el INSERT falla, `Logger.error` y el
  login sigue). Los cambios de datos son fail-closed (mismo commit; si falla, se revierte todo).
- Usuario desactivado conserva su JWT hasta que expire (el guard no consulta BD). No se
  cambia en v1.
- `LOGIN_FALLIDO` puede guardar una contraseña si alguien la escribe en el campo usuario.
  Mitigación: solo ADMIN lee auditoría; se trunca a 50.
- IP: `req.ip`. Si hay proxy delante, configurar `trust proxy` exacto; si no, `X-Forwarded-For`
  es falsificable. El nombre de la PC (`S_ESTACION`) no es obtenible desde el servidor.
- Inmutabilidad real: el rol `postgres` de Supabase puede desactivar triggers. Para blindaje
  total haría falta un rol de BD propio para la app (fuera de v1). RLS evita que la Data API
  de Supabase (anon/authenticated) lea o escriba `auditoria`.
- Volumen: masivos sobre `cuenta_corriente` generan una fila por registro; si molesta, v2 con
  triggers de sentencia (transition tables) o resumen por proceso.
- `BigInt` (`auditoria.id`) rompe `JSON.stringify`: se serializa como string.
- Drift previo (no causado por esta spec): la BD tiene `usuarios.oficinaNombre`, ausente del
  schema. Aparece en `datosDespues` de usuarios. Decidir aparte si se borra o se modela.

## 4. Tareas
- [x] Rama `feat/auditoria` desde `main`.
- [x] Spike: extensión `set_config` + `$transaction` interactivo con pooler `:6543`.
- [x] Schema + migración `20261019120000_auditoria_v1` (columnas, enum, funciones, triggers,
  RLS). `prisma validate` OK. Probada en tx revertida y **aplicada** (`migrate deploy`, 2026-10-19):
  CREATE/UPDATE-diff/no-op/sin contexto/PK compuesta/DELETE bloqueado OK.
- [x] Módulo `auditoria`: ALS, middleware, interceptor, `registrarSesion`, `GET /auditoria`.
- [x] Auth: LOGIN/LOGIN_FALLIDO/LOGOUT. Users: desactivar. Roles: `setAccesos` delta (+D2).
- [x] Tests: login (OK/fallido/sin password), diff y sensibles (e2e, D1), filtros del GET.
- [x] `skills/backend-db.md`. `lint` + `test` + `build`.

## 5. Verificación
`cd backend && npx prisma validate && npm run lint && npm run test && npm run build` ·
login `admin/admin123` y uno fallido → `GET /auditoria?accion=LOGIN_FALLIDO` · editar un
usuario → solo campos cambiados · `UPDATE usuarios ...` por SQL → fila con usuarioId null ·
`DELETE FROM auditoria` por SQL → error.
