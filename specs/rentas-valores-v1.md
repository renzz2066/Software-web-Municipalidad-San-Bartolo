# Spec: Rentas — valores, fraccionamiento y transferencia a coactivo (v1)
<!-- Formato fijo 5 secciones. Aprobada 2026-10-23. Las `*-v1.md` cerradas no se editan. -->

Referencia SIMUN: `Programas/MENU01.MPR` → Control y Recaudación (Fraccionamiento, Emisión de
Valores, Transferencias a Coactivo); tablas `valores_cobranza_cab/det`, `preconvenios_*`,
`convenios_*`, `memo_coactivo`. Base: `rentas-nucleo-v1` (deuda en `cuenta_corriente` y
`liquidar()` de estado de cuenta). Fuera de v1: pagos/extornos (`caja-v1`), pérdida automática
del fraccionamiento (necesita pagos), recepción y expedientes coactivos (spec de Cobranza Coactiva).

## 1. Historia y criterios
- Como SUPERVISOR/ADMIN de Rentas, quiero emitir OP/RD sobre la deuda vencida, registrar su
  notificación, fraccionar deuda y transferir a coactivo los valores exigibles; como CAJERO,
  quiero ver en el estado de cuenta qué cuotas están en valor, fraccionadas o en coactivo.
- [ ] V1 Emisión: OP para predial (Código Tributario art. 78), RD para arbitrios (art. 76).
  Individual (desde la ficha) y masiva por filtro (año, tributo, solo vencidas, monto mínimo,
  zona). Primero **simular** (contribuyentes, valores, montos), luego **ejecutar**. Una cuota no
  puede estar en dos valores vigentes (`EMITIDO/NOTIFICADO`); re-ejecutar no duplica.
- [ ] V2 Agrupación: OP = contribuyente + año (predial va por contribuyente); RD = contribuyente
  + predio + año (arbitrios van por predio). Numeración correlativa por tipo y año (`OP 2026-000123`).
- [ ] V3 Contenido legal imprimible (PDF desde el navegador, como el estado de cuenta): deudor,
  domicilio fiscal, tributo, periodo/cuotas, base imponible, tasa, insoluto, reajuste, interés a
  la fecha de emisión, total y base legal. Montos guardados al emitir; la pantalla muestra
  además la deuda actualizada a hoy con `liquidar()`.
- [ ] V4 Notificación: fecha, modalidad (`PERSONAL`, `NEGATIVA`, `CEDULON`, `PUBLICACION`, art. 104),
  DNI y nombre de quien recibe. Calcula la fecha de exigibilidad: OP = día siguiente a la
  notificación; RD = vencido el plazo de reclamo de 20 días hábiles (art. 137).
- [ ] V5 Anulación de valor con motivo obligatorio: `estado: ANULADO`, nunca `DELETE`; las cuotas
  vuelven a quedar libres para otro valor. No se anula un valor en `COACTIVO`.
- [ ] V6 Fraccionamiento: simular convenio (deudas elegidas, cuota inicial, n.° de cuotas,
  cronograma con interés) → grabar. Deudas originales → `FRACCIONADO`; las cuotas del convenio
  nacen como deuda nueva en `cuenta_corriente` (tributo `FRACCION`) para que Caja las cobre
  igual que cualquier deuda. Valida los límites del año (decisión 2). Anular convenio (solo sin
  pagos) restaura las deudas a `PENDIENTE` y anula sus cuotas.
- [ ] V7 Transferencia a coactivo: lista de valores exigibles no pagados → simular → generar
  memorándum de transferencia (correlativo por año, cantidad y monto). Valor → `COACTIVO` y sus
  cuotas → `COACTIVO`. La recepción la registra Cobranza Coactiva (otra spec).
- [ ] V8 Protección: el cálculo predial/arbitrios trata como protegidas las cuotas que estén en
  un valor vigente (hoy solo protege `CANCELADO/FRACCIONADO/COACTIVO`). Para corregirlas hay que
  anular el valor. La emisión se bloquea si la simulación del cálculo de ese contribuyente
  cambiaría sus cuotas ("recalcula primero").
- [ ] V9 Accesos: nivel existente `rentas.control-recaudacion` (V1–V7; masivos incluidos).
  Estado de cuenta muestra columna "Situación" (valor N.°, convenio N.°, coactivo). Sin nivel → 403.

## 2. Archivos afectados
- Backend: `backend/src/rentas/valores/*` (emisión, notificación, anulación, imprimible),
  `backend/src/rentas/fraccionamiento/*`, `backend/src/rentas/transferencias/*`,
  `backend/src/rentas/correlativos.ts`, reglas puras + tests (`valores.reglas.ts`,
  `fraccionamiento.reglas.ts`, `plazos.ts`), `backend/src/rentas/calculo/motor.ts` (V8),
  `backend/src/rentas/estado-cuenta/*` (situación), `backend/prisma/schema.prisma` + migración + seed (tributo `FRACCION`).
- Frontend: `frontend/src/pages/rentas/valores/*` (EmisionValores, Valor imprimible,
  Notificacion), `.../fraccionamiento/*` (Convenio, cronograma imprimible),
  `.../transferencias/*`, pestañas "Valores" y "Convenios" en `FichaContribuyente.tsx`, rutas en `App.tsx`.

## 3. Diseño
Flujo: `Página -> Endpoint (JwtAuthGuard+NivelGuard) -> Service -> reglas puras -> Prisma
$transaction -> Postgres (+ triggers de auditoría)`. Simular y ejecutar comparten el mismo plan.
- Emisión: toma cuotas `PENDIENTE` vencidas sin valor vigente, las liquida a la fecha de emisión
  (`liquidar()`), agrupa (V2) y graba `valores_cab` + `valores_det` (snapshot insoluto, reajuste,
  mora, subtotal) en una sola transacción.
- Exigibilidad: función pura `fechaExigible(tipo, fechaNotificacion, feriados)`; días hábiles =
  lunes a viernes menos `feriados` (decisión 3).
- Fraccionamiento: `cronograma(monto, cuotaInicial, n, interesMensual, fechaInicio)` puro, cuota
  fija (sistema francés), redondeo a 2 decimales con ajuste en la última cuota.
- Correlativos: tabla `correlativos (serie, anio, ultimo)` con `UPDATE ... RETURNING` dentro de la
  transacción → sin huecos ni duplicados en concurrencia. Series: `OP`, `RD`, `CONV`, `MEMO` (Caja la reusará).
- Endpoints: `POST /rentas/valores/{simular|ejecutar}`, `GET /rentas/valores?contribuyenteId=`,
  `GET /rentas/valores/:id`, `PATCH /rentas/valores/:id/notificacion`, `POST /rentas/valores/:id/anular`,
  `POST /rentas/convenios/{simular|ejecutar}`, `GET /rentas/convenios/:id`, `POST /rentas/convenios/:id/anular`,
  `POST /rentas/transferencias/{simular|ejecutar}`, `GET /rentas/transferencias`, `GET/PUT /rentas/maestros/feriados`,
  `GET/PUT /rentas/maestros/fraccionamiento/:anio`.
- Modelo: se usan `ValorCab/ValorDet`, `ConvenioCab/ConvenioDet`, `CuentaCorriente`. Faltan
  (ver Decisiones): campos de notificación/anulación/transferencia en `valores_cab`,
  `convenio_deudas`, `parametros_fraccionamiento`, `feriados`, `correlativos`,
  `transferencias_coactivo`. Cada tabla nueva: `auditoria_habilitar(...)` en su migración.
- No se hace: pagos, descuentos/amnistías, cartas u oficios informativos, pérdida automática del
  convenio, recepción/devolución en coactivo, expedientes, notificación electrónica.

Mejoras frente a SIMUN (incluidas en v1):
1. Simular antes de emitir o transferir (SIMUN filtra y emite a ciegas, por lotes).
2. Una cuota no puede quedar en dos valores vigentes; el recálculo ya no altera deuda ya valorizada.
3. Fecha de exigibilidad calculada por ley, no a criterio de quien transfiere.
4. Preconvenio = la simulación (SIMUN duplica tablas `preconvenios_*` / `convenios_*`).
5. Correlativos sin huecos, en vez de `MAX()+1` sobre DBF compartidos.
Propuestas para v2: pérdida automática del convenio (2 cuotas vencidas, tras `caja-v1`),
notificación con foto/geo desde el celular, constancia de notificación por QR.

Decisiones (aprobadas 2026-10-23):
1. `valores_cab` gana: `modalidadNotificacion?`, `notificadoDni?`, `notificadoNombre?`,
   `fechaExigible?`, `motivoAnulacion?`, `transferenciaId?`, `baseImponible?`. Numeración con
   `correlativos` (no se cambia el `@@unique([tipo, anio, numero])` actual).
2. Fraccionamiento: `ConvenioDet` pasa a ser **el cronograma** (cada cuota apunta a su fila
   nueva en `cuenta_corriente`); tabla nueva `convenio_deudas` (convenio + cuota original +
   snapshot insoluto/reajuste/mora). Límites por año en `parametros_fraccionamiento`
   (cuota inicial mínima %, cuotas máximas, monto mínimo, interés mensual %, ordenanza).
3. `feriados (fecha, descripcion)` editable en Maestros; sin feriados cargados, solo se
   descuentan sábados y domingos.
4. `transferencias_coactivo (anio, numero, fecha, cantidad, monto, estado ENVIADA|RECIBIDA|DEVUELTA)`;
   en v1 solo se crea `ENVIADA`.
5. Arbitrios con valor: RD por predio (no una RD por contribuyente con todos sus predios).

## 4. Tareas
- [x] Rama `feat/rentas-valores` desde `main`; primer commit = esta spec (`docs(specs)`).
- [ ] Fase A: migración (decisiones 1–4) + correlativos + feriados/parámetros en Maestros + tributo `FRACCION`.
- [ ] Fase B: emisión OP/RD simular/ejecutar + imprimible + protección en cálculo (V1–V3, V8).
- [ ] Fase C: notificación, exigibilidad y anulación (V4, V5).
- [ ] Fase D: fraccionamiento con cronograma imprimible (V6).
- [ ] Fase E: transferencia a coactivo + situación en estado de cuenta (V7, V9).
  `lint` + `build` + `test` en cada fase.
- [ ] PR de `feat/rentas-valores` hacia `main` (cuando el usuario lo pida).

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` ·
login `admin/admin123`. Tests mínimos: agrupación OP/RD, cuota ya en valor vigente no se
re-emite, plazo de 20 días hábiles con fin de semana y feriado, cronograma (suma = monto + interés,
ajuste en última cuota), límites de convenio, anular convenio restaura deudas, recálculo no toca
cuotas en valor. Manual: contribuyente con deuda vencida → simular/emitir OP y RD → imprimir →
notificar → fraccionar otra deuda → transferir un valor exigible → ver situación en estado de
cuenta y los registros en `/accesibilidad/auditoria`.
