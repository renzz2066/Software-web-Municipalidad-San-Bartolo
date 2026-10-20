# Skill: Backend NestJS + Prisma
<!-- Formato: <40 líneas, accionable, sin duplicar AGENTS.md. Si editas, mantén este formato. -->

1. Fuente de verdad: `backend/prisma/schema.prisma` + `backend/src/auth/*.ts`. No asumas tablas que no existan ahí.
2. Validación: DTO con `class-validator` (ya usado en `login.dto.ts`). Sanitiza entradas; nunca devuelvas `password`.
3. Contrato auth real: `POST /auth/login` → `{accessToken, user{id,nombre,usuario,rol,accesos}}`; `GET /auth/me` → usuario. JWT lleva `niveles` (el guard no toca BD; reingresar si cambian accesos). Errores Nest estándar (401 `{message, statusCode}`). No impongas wrapper `{success,data,error}`.
4. Dinero/deuda: `estado` (CANCELADO/EXTORNADO/ANULADO), nunca `DELETE` físico. Multi-escritura en `prisma.$transaction`.
5. Secretos (`DATABASE_URL`, `JWT_SECRET`) solo vía `.env` + `@nestjs/config`. Baja lógica con `activo=false` (no loguea aunque el token exista).
6. Auditoría (`specs/auditoria-v1.md`): la registran triggers PG; no escribas en `auditoria` desde servicios (salvo sesiones vía `AuditoriaService`). Multi-escritura solo con `this.prisma.$transaction(async (tx) => …)` y usando `tx` dentro (la forma batch lanza error). Tabla nueva → `SELECT auditoria_habilitar('tabla', ARRAY['id'])` en su migración. No envíes `creadoPorId`/`modificadoPorId`: los fija el trigger.
