# Software Web - Municipalidad de San Bartolo (Área de Rentas)

Migración a web del sistema de Rentas (originalmente en C#). Proyecto de convenio de prácticas / tesis.

## Stack

- **Backend:** Node.js + NestJS + TypeScript
- **Frontend:** React + Tailwind (Vite)
- **Base de datos:** MySQL + Prisma
- **Auth:** JWT propio (bcrypt + @nestjs/jwt)
- **IA (futuro, para tesis):** microservicio aparte o consumo de API, a definir más adelante

## Estructura

```
backend/    API NestJS (auth, usuarios, y módulos de rentas a futuro)
frontend/   SPA en React + Tailwind
```

## Cómo correr el proyecto en local

1. Backend: ver [backend/README.md](backend/README.md) (requiere MySQL).
2. Frontend:

   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

   La app queda en `http://localhost:5173` y espera al backend en `http://localhost:3000`.

## Estado actual

- [x] Login (JWT) con roles de personal interno (ADMIN, SUPERVISOR, CAJERO)
- [ ] Módulos del sistema de rentas (a definir)
- [ ] Microservicio/IA para tesis (a futuro)
