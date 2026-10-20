# Spec: Pantalla de monitoreo de auditoría (v1)
<!-- Formato fijo 5 secciones. Las `*-v1.md` cerradas no se editan. -->

## 1. Historia y criterios
- Como ADMIN, quiero consultar en pantalla quién creó, cambió o desactivó qué registro y
  quién inició sesión (o lo intentó), con filtros y el detalle del cambio, para no depender
  de SQL ni de Postman. Consume `GET /auditoria` (specs/auditoria-v1.md, C7) sin cambiar su contrato.
- [ ] C1: nivel nuevo `accesibilidad.auditoria` ("Auditoría", orden 5) en `NIVELES_CATALOGO`;
  ADMIN lo recibe solo al sincronizar. Tarjeta en `/accesibilidad` y ruta
  `/accesibilidad/auditoria` con `RequireNivel` (sin nivel → redirige a `/`, como hoy).
- [ ] C2: tabla paginada (20 por página; selector 20/50/100), orden más reciente primero.
  Columnas: Fecha (hora Lima, `dd/mm/aaaa hh:mm:ss`), Usuario, Acción (insignia), Tabla,
  Registro, Módulo, IP. Muestra "N registros · página X de Y"; Anterior/Siguiente.
- [ ] C3: filtros Usuario (select con `GET /users`), Acción (6 valores del enum), Tabla
  (select fijo: `usuarios`, `roles`, `rol_nivel`, `oficinas`, `niveles`), Desde/Hasta
  (`<input type="date">` → `AAAA-MM-DD`, se envía tal cual), ID de registro (texto).
  "Buscar" vuelve a página 1; "Limpiar" quita todo. Desde > Hasta → error en cliente, sin GET.
  Filtros y página viven en la URL (`?accion=...&page=2`): F5 y "volver" los conservan.
- [ ] C4: Usuario: si `usuario` viene, `nombres apellidos (usuario)`. Si `usuarioId` null y
  acción `LOGIN_FALLIDO` → texto "Intento: «usuarioNombre»" en itálica + insignia roja
  (el nombre no es un usuario válido; puede ser basura o una contraseña tecleada mal).
  Si `usuarioId` null en CREATE/UPDATE/DELETE → insignia gris "SISTEMA" y, si existe,
  `detalle.dbUsuario` (rol de BD, `session_user`) como texto secundario.
- [ ] C5: clic/Enter en una fila abre detalle (panel modal accesible: foco atrapado, `Esc`
  cierra, `aria-labelledby`). Muestra metadatos (id, fecha, usuario, acción, tabla,
  registro, módulo, IP, userAgent, `detalle`) y el diff (sección 3). Sin acciones de edición.
- [ ] C6: estados: cargando (skeleton/texto), vacío ("Sin movimientos con esos filtros"),
  400 → mensaje del backend, 403 → "Solo administradores", resto → error de conexión con
  "Reintentar". 401 lo resuelve el interceptor global (`auth:expired`).
- [ ] C7 (D4 de auditoria-v1): "Cerrar sesión" del Dashboard llama `POST /auth/logout`
  y limpia la sesión aunque la llamada falle o tarde (no bloquea al usuario). El cierre por
  token expirado (`auth:expired`) **no** llama al endpoint. Queda fila `LOGOUT` visible en C2.

## 2. Archivos afectados
- Frontend: `frontend/src/App.tsx` (ruta), `frontend/src/pages/Accesibilidad.tsx` (tarjeta),
  `frontend/src/pages/accesibilidad/Auditoria.tsx` (lista + filtros),
  `frontend/src/pages/accesibilidad/AuditoriaDetalle.tsx` (modal + diff),
  `frontend/src/context/AuthContext.tsx` (logout), `frontend/src/lib/api.ts` (excluir
  `/auth/logout` del manejo de 401).
- Backend: `backend/src/niveles/niveles.catalogo.ts` (1 nodo);
  `backend/src/auditoria/auditoria.controller.ts` (+`@RequireNivel('accesibilidad.auditoria')`
  con `NivelGuard`, ver D1). Sin cambios en schema, servicio ni DTO.

## 3. Diseño (máx 10 líneas)
Flujo: `Auditoria.tsx (filtros en URL) -> GET /auditoria?... -> AuditoriaService.listar -> Prisma`.
Diff: unión de claves de `datosAntes` y `datosDespues`, una fila por campo, 3 columnas
Campo | Antes | Después. CREATE: solo "Después" (fondo verde); DELETE: solo "Antes" (rojo);
UPDATE: ambos (antes tachado/rojo, después verde) — el trigger ya manda solo lo que cambió.
Valores: `null` → "vacío"; objetos/arrays → `JSON.stringify(v, null, 2)` en `<pre>`;
`"[CAMBIADO]"` → insignia "Contraseña cambiada". El color no es la única señal (AA): cada
fila lleva texto "agregado/quitado/cambiado". LOGIN/LOGIN_FALLIDO/LOGOUT: sin diff; se ve
`detalle.motivo`. Fechas con `Intl.DateTimeFormat('es-PE', {timeZone: 'America/Lima'})`.
No se hace: exportar CSV/Excel, filtro por módulo, búsqueda de texto libre, tiempo real,
gráficos, ver auditoría de un registro desde su propia pantalla (v2).

### Riesgos y dudas
- **D1 Nivel vs rol**: hoy `GET /auditoria` exige `@Roles('ADMIN')`. Si se asigna
  `accesibilidad.auditoria` a otro rol, vería la tarjeta y recibiría 403. Propongo
  **mantener `@Roles('ADMIN')` y sumar `@RequireNivel`** (ambos deben cumplirse): el nivel
  controla la UI y el módulo que registra el interceptor; ADMIN sigue como tope por la
  sensibilidad (IPs, intentos de login). ¿O prefieres solo nivel, como `users`/`roles`?
- **D2 Filtro de usuario**: el select usa `GET /users`, que exige `accesibilidad.usuarios`.
  ADMIN lo tiene; si D1 se abre a otros roles, sin ese nivel el select cae a un campo
  numérico "ID de usuario". `GET /users` ya devuelve inactivos (sin `WHERE`): se listan con
  sufijo "(inactivo)" para poder auditarlos.
- **D3 Filtro de usuario y LOGIN_FALLIDO**: filtrar por usuario busca por `usuarioId`; los
  intentos fallidos (usuarioId null) no aparecen. Para verlos: Acción = LOGIN_FALLIDO. Un
  filtro por `usuarioNombre` requiere cambiar el DTO (fuera de v1).
- **D4 Tabla fija**: la lista de tablas se codifica en el frontend. Si se habilitan triggers
  en tablas de rentas, hay que agregarlas aquí (o un `GET /auditoria/tablas` en v2).
- **D5 Logout**: el endpoint necesita JWT válido; si ya expiró responde 401. Por eso
  `api.ts` no debe disparar `auth:expired` para `/auth/logout` (evita bucle) y el botón
  limpia la sesión igual. Riesgo bajo: si la red falla no queda fila `LOGOUT` (aceptado,
  el JWT es stateless; no se reintenta). Recomiendo incluirlo en v1: es 1 llamada.
- **D6 Rendimiento**: `count` sobre `auditoria` crece con el tiempo; con filtros indexados
  (`createdAt`, `usuarioId`, `accion`, `tabla+registroId`) es aceptable. Sugerir rango de
  fechas por defecto (últimos 7 días) para no contar toda la tabla. ¿Lo aplicamos?
- **D7 Datos sensibles en pantalla**: `usuarioNombre` de LOGIN_FALLIDO y `userAgent` se
  muestran como texto (React escapa; nunca `dangerouslySetInnerHTML`). No se registra en
  auditoría la propia consulta (no hay auditoría de SELECT).
- **D8 Drift `usuarios.oficinaNombre`** (ver auditoria-v1): aparecerá en diffs de usuarios
  como un campo más; no se oculta en la UI.

## 4. Tareas
- [ ] Rama `feat/auditoria-pantalla` desde `main` (tras merge de `feat/auditoria`).
- [ ] Nodo `accesibilidad.auditoria` + `@RequireNivel` en controller (según D1).
- [ ] Ruta, tarjeta, `Auditoria.tsx` (filtros en URL, tabla, paginado, estados).
- [ ] `AuditoriaDetalle.tsx` (modal accesible + diff).
- [ ] Logout con `POST /auth/logout` + exclusión en `api.ts`.
- [ ] Test (vitest, si se acepta): función pura del diff (CREATE/UPDATE/DELETE/`[CAMBIADO]`).
- [ ] `lint` + `build` (front), `lint` + `test` (back).

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` ·
reiniciar Nest (sincroniza el nivel) y reingresar `admin/admin123` (el JWT trae niveles) ·
login fallido con "xyz" → aparece "Intento: «xyz»" · editar un usuario → detalle muestra
solo campos cambiados · cambiar contraseña → "Contraseña cambiada" · `UPDATE` por SQL →
fila SISTEMA · Cerrar sesión → fila LOGOUT · F5 con filtros conserva filtros y página ·
móvil (375px): tabla con scroll horizontal propio, sin scroll de página.
