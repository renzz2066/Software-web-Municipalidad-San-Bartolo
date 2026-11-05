# Skill: UI municipal (React + Tailwind v4)
<!-- Formato: <40 líneas, accionable, sin duplicar AGENTS.md. Si editas, mantén este formato. -->

1. Estilos solo con Tailwind; tokens en `frontend/src/index.css` vía `@theme` (si la spec define paleta, úsala, no inventes otra). Sin hex sueltos: usa `bg-arena-claro`, `text-tinta`, `border-borde`, `bg-mar-profundo`, etc.
2. Iconos: sin CSS completo de Bootstrap (colisiona con Tailwind). Si la spec pide iconos, usa `bootstrap-icons` + clases `bi-*`.
3. Accesibilidad AA: `label` por campo, foco visible, contraste, navegación por teclado. Sin emojis como iconos.
4. Formularios: valida en cliente antes de `POST`; respeta el flujo `useAuth().login()` → `navigate('/')` (ver `frontend/README.md`).
5. Responsive: móvil primero; en login el panel lateral pasa a banner superior, en el shell la barra lateral pasa a cajón. Reutiliza componentes en `frontend/src/components/`.
6. Pantallas autenticadas van dentro de `AppShell`; un solo ancho (`max-w-content`). El Dashboard solo orienta (módulos permitidos); las acciones de trabajo viven en su módulo.
7. Toda pantalla interna usa `PageHeader` con `volverA` ("Volver a {anterior}", arriba a la izquierda) y una sola acción primaria.
8. Paneles: `bg-white border border-borde rounded-panel`, sin sombras. Títulos y cifras `font-serif`, resto `font-sans`. Montos con `tabular-nums` a la derecha; deuda, errores y eliminar en `text-ladrillo`.
9. Tablas: encabezado fijo, fila clicable con teclado (`tabIndex=0` + Enter), pie con conteo, scroll horizontal en angosto. Vacío = ícono, una línea y botón de acción. Estados: `ok` activo, `aviso` pendiente, neutro baja.
10. Movimiento solo por acción del usuario, máx 250 ms; respeta `prefers-reduced-motion`.
11. Texto en español, sentence case, verbos de acción ("Inscribir predio"); los errores dicen cómo corregir.