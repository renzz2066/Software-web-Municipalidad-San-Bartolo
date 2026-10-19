# Spec: Recarga de ruta protegida por nivel (v1)
<!-- Formato fijo 5 secciones. Para crear una spec, copia este archivo a `specs/<tema>-vN.md`. Las `*-v1.md` cerradas no se editan. -->

## 1. Historia y criterios
- Como ADMIN/SUPERVISOR/CAJERO, quiero recargar (F5 o pegar URL) una ruta protegida por nivel y seguir en ella.
- [ ] `admin/admin123`: recargar `/accesibilidad/niveles` se queda en esa página.
- [ ] Sin sesión: cualquier ruta protegida va a `/login`.
- [ ] Rol sin el nivel: la ruta va a `/`.

## 2. Archivos afectados
- Frontend: `frontend/src/context/AuthContext.tsx`, `frontend/src/context/AccesosContext.tsx`.

## 3. Diseño (máx 10 líneas)
Causa: `AuthProvider` restauraba la sesión en `useEffect`; en el primer render `user=null`,
`accesos=[]` y `RequireNivel` hacía `<Navigate to="/">` antes de restaurar.
Fix: restaurar `localStorage` en el inicializador perezoso de `useState` (síncrono).
`AccesosProvider` expone `isLoading` mientras auth carga o, si la sesión guardada no trae
`accesos` (sesión antigua), hasta que responda `GET /niveles/mis-accesos` (éxito o error).
NO se cambia `RequireNivel` ni el backend.

## 4. Tareas
- [ ] Rama `fix/recarga-ruta-protegida` desde `main`. Implementar. `lint` + `build`.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · login `admin/admin123` (`:5173` + `:3000`), F5 en `/accesibilidad/niveles`.
