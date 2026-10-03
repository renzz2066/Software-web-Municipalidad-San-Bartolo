# Skill: Backend NestJS + Prisma
<!-- Formato: <40 líneas, accionable, sin duplicar AGENTS.md. Si editas, mantén este formato. -->

1. Fuente de verdad: `backend/prisma/schema.prisma` + `backend/src/auth/*.ts`. No asumas tablas que no existan ahí.
2. Validación: DTO con `class-validator` (ya usado en `login.dto.ts`). Sanitiza entradas; nunca devuelvas `password`.
3. Respuesta JSON `{success, data, error}` + HTTP correcto (200/201/400/401/500).
4. Dinero/deuda: `estado` (CANCELADO/EXTORNADO/ANULADO), nunca `DELETE` físico. Multi-escritura en `prisma.$transaction`.
5. Secretos (`DATABASE_URL`, `JWT_SECRET`) solo vía `.env` + `@nestjs/config`. Baja lógica con `activo=false` (no loguea aunque el token exista).
