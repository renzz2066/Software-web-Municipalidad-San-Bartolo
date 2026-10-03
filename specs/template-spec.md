# Spec: [Nombre corto] (vN)
<!-- Formato fijo 5 secciones. Para crear una spec, copia este archivo a `specs/<tema>-vN.md`. Las `*-v1.md` cerradas no se editan. -->

## 1. Historia y criterios
- Como [ADMIN/SUPERVISOR/CAJERO], quiero [qué] para [beneficio].
- [ ] Criterio 1 (observable en UI o API):
- [ ] Criterio 2 (errores: 401 = credenciales, resto = conexión):

## 2. Archivos afectados
- Frontend: `frontend/src/...` (solo render si es visual).
- Backend: `backend/src/...`, `backend/prisma/schema.prisma` (si cambia modelo).

## 3. Diseño (máx 10 líneas)
Flujo: `Usuario -> Form -> Endpoint -> Prisma -> DB`. Decisiones y lo que NO se hace.

## 4. Tareas
- [ ] Rama `tipo/tema` desde `main`. Implementar. `lint` + `build`/`test`.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` · login `admin/admin123` (`:5173` + `:3000`).
