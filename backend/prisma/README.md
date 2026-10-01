# Backend Prisma — Rentas San Bartolo (Postgres + Supabase)

## 1. Qué hay aquí

- `schema.prisma` — 26 modelos en 8 dominios (ver `specs/db-estructura-rentas-v1.md`).
  SIMUN (`D:\Simun\Data\*.DBF`) se usó **solo como referencia**, no se migra ningún dato.
- `DER.mmd` — diagrama ER en Mermaid. Ábrelo en VSCode (extensión Mermaid) o GitHub.
- `seed.ts` — crea `admin / admin123` (bcrypt). Sin registros tributarios por decisión del sprint.

## 2. Variables de entorno

Copia y completa (ver `.env.example`):

```bash
cd backend
cp .env.example .env
```

| Variable | Dónde sale | Para qué |
|---|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection pooling (puerto **6543**, `?pgbouncer=true`) | Conexión que usa NestJS en runtime |
| `DIRECT_URL` | Misma pantalla → Connection string directa (puerto **5432**) | Solo para `prisma migrate` |
| `JWT_SECRET` | Inventa uno largo aleatorio | Firmar JWT propio |
| `JWT_EXPIRES_IN` | `8h` por defecto | Expiración del token |

> Sin `DIRECT_URL` las migraciones fallan con Supabase + pgbouncer. No lo omitas.

## 3. Cómo levantar (local + Supabase)

```bash
cd backend
npm install

# 1. Validar sintaxis sin tocar la nube
npx prisma validate
npx prisma format --check

# 2. Crear tablas en Supabase (requiere DATABASE_URL + DIRECT_URL reales)
npx prisma migrate dev --name rentas_v1_postgres

# 3. Usuario inicial
npx prisma db seed

# 4. API
npm run start:dev
# -> http://localhost:3000
```

Login de prueba:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"admin123"}'
```

## 4. Comandos útiles

| Comando | Uso |
|---|---|
| `npx prisma validate` | Chequea el schema sin DB |
| `npx prisma migrate dev --name <x>` | Nueva migración en rama de trabajo |
| `npx prisma migrate deploy` | Aplicar migraciones en prod (CI) |
| `npx prisma studio` | Ver tablas en navegador |
| `npm test` | Tests (vitest) |

## 5. Reglas de seguridad aplicadas (resumen)

Detalle completo en `specs/db-estructura-rentas-v1.md §5`.
- Passwords solo hash bcrypt (`Usuario.password` 255). Nunca texto plano.
- FKs con `Restrict` en deuda/pagos (no se puede borrar un contribuyente con deuda).
- `Pago.cuentaCorrienteId` + `ConvenioDet.cuentaCorrienteId` obligan trazabilidad deuda→pago.
- `UNIQUE` en `numDoc`, `placa`, `numeroLicencia`, `numRecibo`, `(tipo,anio,numero)` de valores, `(anioExpediente,numExpediente)`.
- Auditoría central `auditoria` reemplaza los `S_CODUSU/S_FECHA/...` de cada DBF.
- Respuestas JSON `{success,data,error}` y transacciones en servicios (ver `skills/backend-db.md`).

## 6. Migración futura a plan pago

Solo cambia las URLs en `.env` (misma estructura). Si pasas de Supabase Free a Pro/Aiven:
1. Crea el proyecto nuevo.
2. `npx prisma migrate deploy` contra la nueva `DIRECT_URL`.
3. Cambia `DATABASE_URL` en el deploy del backend. Sin tocar código.
