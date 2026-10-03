# Frontend — Rentas San Bartolo (React + Tailwind v4 + Vite)

SPA del personal interno (roles `ADMIN/SUPERVISOR/CAJERO`). Stack completo en `../README.md`.

- Login: `src/pages/Login.tsx` delega en `useAuth().login()` → `navigate('/')` (`src/context/AuthContext.tsx`, `src/lib/api.ts`). 401 = credenciales, resto = conexión.
- Estilos: Tailwind vía `src/index.css`. Spec visual vigente manda (ver `../specs/_index.md`).

### Login institucional

Identidad visual de San Bartolo. Detalle y decisiones en
[`specs/login-visual-v1.md`](../specs/login-visual-v1.md).

- Layout split: panel institucional con foto de la bahía
  (`public/san-bartolo-bahia.jpg`) + escudo oficial (`public/escudo-mdsb.png`,
  fuente gob.pe) y panel de formulario. En móvil la bahía pasa a banner superior.
- Paleta (`src/index.css`, `@theme`): `mar-profundo #0B2C4A`, `mar #0A7EA4`,
  `turquesa #00B4D8`, `arena #F5E9D3`.
- Iconos: `bootstrap-icons` (`bi-person`, `bi-key`, `bi-water`, `bi-bank`,
  `bi-shield-lock`, `bi-geo-alt`). No se usa el CSS completo de Bootstrap para
  no colisionar con Tailwind.

```bash
cd backend && npm run start:dev   # :3000, ~40s en modo watch
cd frontend && npm install && npm run dev   # http://localhost:5173/login
npm run lint && npm run build
```

Seed: `admin / admin123` (backend). `EADDRINUSE :3000` = Nest previo vivo: detén el proceso.
