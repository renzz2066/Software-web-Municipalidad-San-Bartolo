# Skill: UI municipal (React + Tailwind v4)
<!-- Formato: <40 líneas, accionable, sin duplicar AGENTS.md. Si editas, mantén este formato. -->

1. Estilos solo con Tailwind; tokens en `frontend/src/index.css` vía `@theme` (si la spec define paleta, úsala, no inventes otra).
2. Iconos: sin CSS completo de Bootstrap (colisiona con Tailwind). Si la spec pide iconos, usa `bootstrap-icons` + clases `bi-*`.
3. Accesibilidad AA: `label` por campo, foco visible, contraste, navegación por teclado. Sin emojis como iconos.
4. Formularios: valida en cliente antes de `POST`; respeta el flujo `useAuth().login()` → `navigate('/')` (ver `frontend/README.md`).
5. Responsive: móvil primero; panel lateral pasa a banner superior. Reutiliza componentes en `frontend/src/components/`.
