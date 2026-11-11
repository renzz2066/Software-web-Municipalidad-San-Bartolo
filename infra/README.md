# Laboratorio local multi-muni (Windows)

Postgres 16 + pgvector en Docker, puerto **5433**, con dos bases: `muni_san_bartolo` y `muni_demo`.
No toca Supabase: `db:setup` solo acepta hosts locales y pisa `DATABASE_URL`/`DIRECT_URL`.

## Requisitos

- Docker Desktop (backend WSL 2) en ejecución: `docker version` debe responder.
- Node + `cd backend; npm install` hecho.

## 1. Levantar Postgres (PowerShell, desde la raíz del repo)

```powershell
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps      # esperar STATUS "healthy"
docker exec muni-lab-postgres psql -U postgres -c "\l"   # deben verse muni_san_bartolo y muni_demo
```

El script `postgres-init/01-crear-bases.sql` solo corre con el volumen vacío.

## 2. Migraciones + seed en cada base (una por una)

```powershell
cd backend
npm run db:setup -- postgresql://postgres:postgres@localhost:5433/muni_san_bartolo
npm run db:setup -- postgresql://postgres:postgres@localhost:5433/muni_demo
npm run db:setup:todas      # o todas las de MUNIS en .env.local-lab, una tras otra
```

Cada corrida: `prisma migrate deploy` + `prisma db seed` (admin / admin123). Es idempotente.
Si una base falla, `db:setup:todas` se detiene y dice cuál; las siguientes no se tocan.

## 3. Backend + frontend multi-muni (`specs/multi-muni-v1.md`)

```powershell
cd backend
Copy-Item .env.local-lab.example .env.local-lab   # primera vez; cambia JWT_SECRET
npm run start:lab                                  # un solo backend atiende ambas munis
```
```powershell
cd frontend
npm run dev
```

| Dirección | Base |
|---|---|
| `http://sanbartolo.localhost:5173` | `muni_san_bartolo` |
| `http://demo.localhost:5173` | `muni_demo` |
| `http://localhost:5173` | `MUNI_DEFAULT` (`sanbartolo`) |
| otro subdominio | "Municipalidad no encontrada" |

Cada dirección guarda su propia sesión; un token de una muni da 401 en la otra.
Muni nueva: agrégala a `backend/config/munis.json`, a `MUNIS` y su `DATABASE_URL__<SLUG>`, crea la base y corre `db:setup:todas`.
`EADDRINUSE :3000` = otro Nest vivo: detenlo, no cambies el puerto.

## 4. Probar login

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/auth/login -ContentType application/json -Headers @{ 'X-Muni' = 'demo.localhost' } -Body '{"usuario":"admin","password":"admin123"}'
```

Debe devolver `accessToken` y `user`.

## Reset / apagar

```powershell
docker compose -f infra/docker-compose.yml down       # apaga, conserva datos
docker compose -f infra/docker-compose.yml down -v    # borra ambas bases (re-ejecuta init al subir)
```
