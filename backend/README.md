# Backend - Sistema de Rentas (Municipalidad San Bartolo)

API construida con NestJS + TypeScript, Prisma (MySQL) y JWT propio (bcrypt + @nestjs/jwt).

## Requisitos

- Node.js 20+
- MySQL 8 corriendo localmente (o accesible por red)

## Configuración inicial

1. Copia el archivo de variables de entorno y ajusta tus credenciales de MySQL:

   ```bash
   cp .env.example .env
   ```

   Edita `DATABASE_URL` con tu usuario/contraseña/host reales, y cambia `JWT_SECRET` por un valor aleatorio propio.

2. Instala dependencias:

   ```bash
   npm install
   ```

3. Crea la base de datos y aplica las migraciones de Prisma:

   ```bash
   npx prisma migrate dev --name init
   ```

4. Crea el usuario administrador inicial (usuario: `admin`, password: `admin123`):

   ```bash
   npx prisma db seed
   ```

5. Levanta el servidor en modo desarrollo:

   ```bash
   npm run start:dev
   ```

   La API queda en `http://localhost:3000`.

## Endpoints de autenticación

- `POST /auth/login` — body `{ "usuario": "admin", "password": "admin123" }`, responde `{ accessToken, user }`.
- `GET /auth/me` — requiere header `Authorization: Bearer <token>`, devuelve el usuario autenticado.

## Notas de versiones

> **Nota operativa (sesión login-visual-v1):** la BD real del proyecto es
> Postgres en Supabase (`DATABASE_URL` con pooler `:6543` y `DIRECT_URL`
> directa `:5432`), no MySQL local como indicaba este README. Ajusta tus
> variables desde Supabase Dashboard → Project Settings → Database.
> El backend tarda ~40s en compilar con `npm run start:dev` (modo watch);
> espera al mensaje `Nest application successfully started` antes de probar el
> login. Si ves `EADDRINUSE :::3000`, hay otra instancia de Nest viva: detén
> ese proceso en vez de levantar uno nuevo.

Este proyecto fija `prisma`/`@prisma/client` en `6.19.3` (última versión estable) en vez de la `8.0.0-rc.x` que instala `npm install prisma@latest` actualmente, ya que esa es una release candidate con cambios incompatibles (elimina el `url` del datasource en `schema.prisma`). No actualices a Prisma 7/8 sin revisar la guía de migración oficial primero.
