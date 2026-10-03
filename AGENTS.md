# Agentes — Muni San Bartolo (Rentas)

Senior web municipal. Código modular, seguro, mantenible. Comprende antes de cambiar.

## Stack (ver `README.md`, `backend/prisma/schema.prisma`)
NestJS + React/Vite + Tailwind v4 + Prisma + MySQL. JWT propio, roles `ADMIN/SUPERVISOR/CAJERO`.
API `:3000` · App `:5173/login` · Seed `admin / admin123`.

## Comandos (sin `package.json` en raíz; ejecuta por carpeta)
```bash
cd frontend && npm install && npm run dev      # :5173
cd frontend && npm run lint && npm run build
cd backend && npm install && npm run start:dev  # :3000, ~40s watch
cd backend && npm run lint; npm run test        # vitest run
cd backend && npx prisma validate; npx prisma db seed
```
`EADDRINUSE :3000` = otra instancia Nest viva: detén el proceso, no cambies el puerto.

## Git-flow (obligatorio)
JAMÁS `main`/`prod` directo. Toda tarea en rama `tipo/tema-corto` + PR. No abras PR
salvo que el usuario lo pida explícito. Sin secretos en código (solo `.env` gitignorado).

## Reglas
1. Sin spec/plan aprobado, no toques `frontend/src` ni `backend/src`.
2. Auth delega en `useAuth().login()` → `navigate('/')`; 401 = credenciales, resto = conexión.
3. Deuda/dinero: estados (`CANCELADO/EXTORNADO`), nunca `DELETE`. Cambios multi-tabla en `$transaction`.
4. Tests solo para lógica crítica (tasas, auth, cobros) + edge cases; mockea DB/APIs externas.
5. Respuesta API JSON `{success, data, error}` + HTTP correcto (200/201/400/401/500).

## Skills (lazy-load: lee SOLO la necesaria, cuando la tarea la exija)
| Tarea | Lee |
|---|---|
| UI/formularios | `skills/ui-components.md` |
| Nest/Prisma/API | `skills/backend-db.md` |
| Tests | `skills/testing.md` |
| Términos rentas/SIMUN | `skills/rentas-domain.md` |
No cargues skills "por si acaso". No dupliques su contenido en tu respuesta.

## Dónde mirar
Flujo local: `README.md`. Detalle login: `frontend/README.md`. Specs: `specs/_index.md`.

## Cómo modificar esta config (meta-regla)
Si editas `AGENTS.md`, `skills/*` o `specs/*`: respeta este formato — breve (<60
AGENTS, <40 skills), imperativo y ejecutable, cero boilerplate, cero duplicados
entre archivos, rutas relativas. `specs/*-v1.md` cerradas no se editan.
