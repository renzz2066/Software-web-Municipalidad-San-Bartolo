# Skill: Testing (vitest)
<!-- Formato: <40 líneas, accionable, sin duplicar AGENTS.md. Si editas, mantén este formato. -->

1. Unitarios: `cd backend && npm run test` (`vitest run`). Solo lógica crítica: auth, tasas, cobros, validaciones.
2. E2E: `npm run test:e2e` solo para login/flujos con DB real (`admin/admin123`).
3. Edge cases: vacíos, maliciosos, fuera de rango. Mockea DB/APIs externas en unitarios.
4. No exijas 100% cobertura en cambios de UI/config. Un test que prueba lo crítico vale más que diez triviales.
