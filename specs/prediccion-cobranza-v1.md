# Spec: Priorización de cobranza con el modelo de 3 grupos (v1)
<!-- Integra la salida del modelo de tesis (repo modelo-3-grupos-muni, `05_puntajes.py`). -->

## 1. Historia y criterios
- Como ADMIN/SUPERVISOR, quiero ver a quién cobrar primero según el modelo (Puntual/Tardío/Incobrable) para gastar el esfuerzo de cobranza donde más deuda se recupera.
- [ ] P1 Nivel `tablero.priorizacion-cobranza` ("Priorización de Cobranza") bajo Tablero Gerencial; tarjeta en `/tablero` y ruta `/tablero/priorizacion-cobranza`.
- [ ] P2 ADMIN importa `puntajes_AAAA.csv` desde la pantalla. Se valida cabecera, probabilidades (0-1, suman ≈1), tramo A/B/C y grupo; un error indica la fila. Reimportar el mismo año crea un lote nuevo y deja el anterior como no vigente (sin `DELETE`).
- [ ] P3 Cada fila se enlaza al contribuyente por `codigoLegacy` (= CODCLI). Si no hay ficha, se muestra "Sin ficha en el sistema web" y el resumen dice cuántos faltan.
- [ ] P4 Resumen del lote vigente: contribuyentes por grupo, deuda esperada total, % que concentra el top 20 %, fecha del modelo y del import.
- [ ] P5 Lista paginada por prioridad con filtros (tramo, grupo, acción, estado de gestión, código o nombre). Muestra nombre con enlace a la ficha, las 3 probabilidades (barra), deuda del año, anterior y esperada, acción y estado. Exporta CSV de lo filtrado.
- [ ] P6 Registro de gestión por contribuyente-año (Pendiente → Contactado → Compromiso de pago → Pagó / No ubicado) con observación; historial solo de inserción, sobrevive a la reimportación.
- [ ] P7 La ficha del contribuyente muestra grupo, tramo, prioridad y acción vigentes (solo si el usuario tiene el nivel).
- [ ] P8 401 = sesión vencida; 403 = sin acceso; resto = conexión.

## 2. Archivos afectados
- Backend: `backend/prisma/schema.prisma` + migración, `backend/src/cobranza/*` (módulo nuevo), `backend/src/app.module.ts`, `backend/src/niveles/niveles.catalogo.ts`.
- Frontend: `frontend/src/pages/tablero/PriorizacionCobranza.tsx` (+ formato y test), `frontend/src/pages/modulos/catalogo.ts`, `frontend/src/App.tsx`, ficha del contribuyente (tarjeta).

## 3. Diseño
Flujo: `Python (05_puntajes.py) -> CSV -> POST /cobranza/lotes (ADMIN) -> Prisma -> puntajes_cobranza`.
Tablas: `cobranza_lotes` (año, modelo, archivo, filas, vigente; auditada), `puntajes_cobranza` (fila del CSV + `contribuyenteId` resuelto; no auditada: ~7 mil filas por import, el lote ya queda auditado), `gestiones_cobranza` (año + `codigoLegacy`, estado, observación; auditada, solo inserción).
El modelo no corre en Node: se reentrena y califica en Python una vez al año (las variables salen de las DBF de Simun). El CSV tiene datos personales: no se versiona, solo se importa a la BD.
NO se hace: recalcular puntajes en línea, explicaciones por contribuyente, envío de SMS/cartas.

## 4. Tareas
- [ ] Rama `feat/prediccion-cobranza`. Migración + módulo + pantalla + tarjeta en ficha. Tests del parser CSV y de las reglas de lote/gestión.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` · login `admin/admin123`, importar `puntajes_2025.csv`, filtrar tramo A, registrar una gestión y verla en la ficha.
