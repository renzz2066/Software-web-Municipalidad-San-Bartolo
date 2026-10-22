# Spec: Rentas — núcleo tributario (v1)
<!-- Formato fijo 5 secciones. Aprobada 2026-10-21. Las `*-v1.md` cerradas no se editan. -->

Referencia SIMUN: `Programas/MENU01.MPR` (Registro Tributario, Maestros, Cálculos Masivos).
Alcance: lo mínimo para que exista **deuda tributaria correcta** (predial + arbitrios). Es la
base de Licencias (reusa contribuyente/predio) y de Coactiva (consume valores OP/RD).
Fuera de v1 (specs propias, en este orden): `rentas-valores-v1` (OP/RD, fraccionamiento,
transferencia a coactivo) · `caja-v1` (pagos/extornos) · `rentas-fiscalizacion-v1` · descargos.

## 1. Historia y criterios
- Como SUPERVISOR/ADMIN de Rentas, quiero registrar contribuyentes, predios y sus DDJJ,
  mantener los parámetros del año y calcular predial/arbitrios para generar la cuenta
  corriente; como CAJERO, quiero consultar el estado de cuenta de un contribuyente.
- [ ] C1 Contribuyentes: buscar por DNI/RUC, nombre, código legacy o dirección (paginado);
  crear/editar con validación (DNI 8 dígitos, RUC 11 con dígito verificador, `numDoc` único
  → 409 legible). Baja = `estado: BAJA`, nunca `DELETE`.
- [ ] C2 Ficha del contribuyente (vista 360): datos, predios (con % de condominio), deuda
  por año/tributo, historial de DDJJ. Una sola pantalla, no 5 formularios como SIMUN.
- [ ] C3 Predios + DJ: alta/edición de predio (ubicación por catálogo zona/urb/vía, terreno,
  pisos, otras instalaciones) dentro de una **declaración jurada** con motivo (inscripción,
  compra, venta, rectificación, baja). Toda DJ se graba en `$transaction` y queda versionada.
- [ ] C4 Maestros del año: UIT, escala predial, aranceles, valores unitarios, depreciación,
  tarifas de arbitrios, TIM/IPM y catálogos ubigeo. Asistente "Abrir año N+1" que copia
  los parámetros de N para editar (reemplaza "Crear Data Mecanizada").
- [ ] C5 Cálculo predial y arbitrios (individual y masivo): primero **simular** (preview con
  totales y lista de afectados), luego **ejecutar**. Idempotente: re-ejecutar no duplica
  cuotas; recalcula solo `PENDIENTE` y nunca toca `CANCELADO/FRACCIONADO/COACTIVO`.
- [ ] C6 Estado de cuenta a una fecha: importe, reajuste, mora (TIM) y total por cuota,
  calculados al vuelo; imprimible/PDF desde el navegador. Mismo endpoint lo usarán Caja y Coactiva.
- [ ] C7 Accesos: `rentas.registro-tributario` (C1–C3, C6), `rentas.maestros` (C4);
  C5 masivo exige el nivel `rentas.registro-tributario.calculo-masivo` (FUNCIONALIDAD).
  Sin nivel → 403. Errores: 401 = credenciales, resto = conexión/validación.

## 2. Archivos afectados
- Backend: `backend/src/contribuyentes/*`, `backend/src/predios/*` (incluye DJ, pisos),
  `backend/src/rentas/maestros/*`, `backend/src/rentas/calculo/*` (lógica pura + tests),
  `backend/src/rentas/estado-cuenta/*`, `backend/src/niveles/niveles.catalogo.ts` (nivel C7),
  `backend/prisma/schema.prisma` + migración (tablas de §3 si se aprueban).
- Frontend: `frontend/src/pages/rentas/*` (Contribuyentes, FichaContribuyente, PredioForm,
  Maestros, CalculoMasivo, EstadoCuenta), rutas en `App.tsx`, `pages/modulos/catalogo.ts`.

## 3. Diseño
Flujo: `Usuario -> Página rentas -> Endpoint Nest (JwtAuthGuard+NivelGuard) -> Service
-> calculo/*.ts (puro) -> Prisma $transaction -> Postgres (+ trigger auditoría)`.
- Cálculo predial (D.L. 776): autoavalúo = terreno (área × arancel) + Σ pisos (área ×
  valor unitario × (1 − depreciación)) + otras instalaciones; impuesto por tramos de
  `escala_predial` en UIT (0.2% / 0.6% / 1.0%) con mínimo = % de UIT del año; base del
  condómino = autoavalúo × % participación. 4 cuotas trimestrales; cuotas 2–4 con reajuste IPM.
- Arbitrios: tarifa del año por concepto (residuos, barrido, parques, serenazgo) según uso
  y zona del predio; cuota mensual o trimestral según ordenanza.
- Lógica de cálculo en funciones puras (sin Prisma) → testeable con vitest (`skills/testing.md`).
- Endpoints (prefijo REST simple, errores Nest estándar):
  `GET/POST/PATCH /contribuyentes`, `GET /contribuyentes/:id/resumen`,
  `GET /contribuyentes/:id/estado-cuenta?fecha=`, `GET/POST/PATCH /predios`,
  `POST /predios/:id/declaraciones`, `GET/PUT /rentas/maestros/:tabla?anio=`,
  `POST /rentas/maestros/abrir-anio`, `POST /rentas/calculo/{predial|arbitrios}/{simular|ejecutar}`.
- Modelo: se usan los existentes (`Contribuyente`, `Predio`, `PredioContribuyente`, `Piso`,
  `OtraInstalacion`, `Zona/Urbanizacion/Via`, `Tributo`, `Uit`, `EscalaPredial`,
  `TarifaArbitrio`, `CuentaCorriente`). **Faltan** (requieren aprobación, ver Decisiones):
  `declaraciones_juradas`, `aranceles`, `valores_unitarios`, `depreciaciones`, `tasas_mora`.
  Cada tabla nueva: `auditoria_habilitar(...)` en su migración.
- No se hace: emisión de valores, pagos, fraccionamiento, fiscalización, ETL desde SIMUN.

Mejoras frente a SIMUN (incluidas en v1):
1. Ficha 360 y búsqueda única (SIMUN reparte en `frmcontribuyentes_rentas*` + `frmpredioscontri`).
2. DJ versionada en una tabla, en vez de copias anuales `a_*`, `f_*`, `h_*` y `declaracion_j` (134 campos).
3. Simular antes de ejecutar el cálculo masivo, y ejecución idempotente (SIMUN recalcula a ciegas).
4. Mora calculada a la fecha de consulta, no guardada desactualizada.
5. Cada parámetro guarda su `ordenanza` (número/fecha) → trazabilidad legal en auditoría.
6. Validación de DNI/RUC y anti-duplicados en BD (`numDoc` único).
Propuestas para v2 (no en v1): consulta RENIEC/SUNAT por API, constancia de no adeudo con
QR de verificación, alertas (predios sin DJ del año, deuda alta sin valor), DJ online del vecino.

Decisiones (aprobadas 2026-10-21):
1. Se crean las 5 tablas nuevas (`declaraciones_juradas` versiona la DJ con motivo).
2. Arbitrios por **zona + uso**: `TarifaArbitrio` gana `zonaId?` y `uso?` (null = aplica a todas).
3. Predial en 4 cuotas trimestrales (feb/may/ago/nov, 2–4 con IPM) o pago anual hasta fin
   de febrero sin reajuste. Derecho de emisión: pendiente, se define en Fase D.
4. Redondeo a 2 decimales por cuota.

## 4. Tareas
- [x] Rama `feat/rentas-nucleo` desde `main`; primer commit = esta spec (`docs(specs)`).
- [x] Fase A: migración `20261021120000_rentas_maestros` + maestros (C4) + seed UIT/escala 2026.
- [x] Fase B: contribuyentes + ficha 360 (C1, C2); baja bloqueada si hay deuda pendiente.
- [ ] Fase C: predios + DJ versionada (C3).
- [ ] Fase D: `calculo/*` puro con tests → simular/ejecutar (C5).
- [ ] Fase E: estado de cuenta (C6) + niveles (C7). `lint` + `build` + `test` en cada fase.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` ·
login `admin/admin123`. Tests mínimos de cálculo: tramos 15/60 UIT en el borde, mínimo
predial, condómino 50%, reajuste IPM cuotas 2–4, mora a fecha, re-ejecución sin duplicar y
sin tocar cuotas `CANCELADO`. Manual: crear contribuyente → predio con 2 pisos → simular →
ejecutar → ver estado de cuenta y su registro en `/accesibilidad/auditoria`.
