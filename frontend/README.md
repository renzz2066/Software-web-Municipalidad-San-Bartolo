# Frontend — Rentas San Bartolo (React + Tailwind v4 + Vite)

SPA del personal interno (roles `ADMIN/SUPERVISOR/CAJERO`). Stack completo en `../README.md`.

- Login: `src/pages/Login.tsx` delega en `useAuth().login()` → `navigate('/')` (`src/context/AuthContext.tsx`, `src/lib/api.ts`). 401 = credenciales, resto = conexión.
- Estilos: Tailwind vía `src/index.css`. Spec visual vigente manda (ver `../specs/_index.md`).

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173/login, API en :3000
npm run lint && npm run build
```

Seed: `admin / admin123` (backend). `EADDRINUSE :3000` = Nest previo vivo: detén el proceso.
