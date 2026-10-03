# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

---

## Sistema de Rentas — Municipalidad de San Bartolo

SPA en React + Tailwind (Vite). Ver [README principal](../README.md) para el stack completo.

### Login institucional (`src/pages/Login.tsx`)

Pantalla de acceso del personal interno (roles ADMIN, SUPERVISOR, CAJERO) con
identidad visual de San Bartolo. Detalle de diseño y decisiones en
[`specs/login-visual-v1.md`](../specs/login-visual-v1.md).

- Layout split: panel institucional con foto de la bahía
  (`public/san-bartolo-bahia.jpg`) + escudo oficial (`public/escudo-mdsb.png`,
  fuente gob.pe) y panel de formulario. En móvil la bahía pasa a banner superior.
- Paleta (`src/index.css`, `@theme`): `mar-profundo #0B2C4A`, `mar #0A7EA4`,
  `turquesa #00B4D8`, `arena #F5E9D3`.
- Iconos: `bootstrap-icons` (`bi-person`, `bi-key`, `bi-water`, `bi-bank`,
  `bi-shield-lock`, `bi-geo-alt`). No se usa el CSS completo de Bootstrap para
  no colisionar con Tailwind.
- La lógica de auth no se modifica en el login: `handleSubmit` delega en
  `useAuth().login()` y navega a `/` (`AuthContext.tsx`, `lib/api.ts`).

### Cómo verlo en local

```bash
# Backend (API en http://localhost:3000)
cd backend && npm run start:dev   # tarda ~40s en compilar en modo watch

# Frontend (app en http://localhost:5173/login)
cd frontend && npm run dev
```

Credencial inicial: `admin / admin123` (seed del backend).
Si el puerto 3000 da `EADDRINUSE`, es otra instancia de Nest aún viva: detén el
proceso anterior en vez de levantar uno nuevo.
