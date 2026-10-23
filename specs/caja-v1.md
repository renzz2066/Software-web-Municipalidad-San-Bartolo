# Spec: Caja — cobros en ventanilla, extornos y cierre diario (v1)
<!-- Formato fijo 5 secciones. Aprobada 2026-10-23. Las `*-v1.md` cerradas no se editan. -->

Referencia SIMUN: `Programas/MENU_CAJA.MPR` (Cancelaciones del Día, Extorno, Reportes);
`Formularios/frmcobros01`, `frmcajaextorno`, `frmcajaopen`/`frmclosecaja`; tablas `pagos`
(una fila por cuota, `NROMOV` agrupa el cobro, `ESTADO P/E`), `recibos` (correlativo por cuenta)
y `cierre_de_caja` (uno por día para toda la caja). Base: `rentas-nucleo-v1` (estado de cuenta y
`liquidar()`) y `rentas-valores-v1` (OP/RD, convenios con cuotas `FRACCION`, coactivo).
Fuera de v1: descuentos/amnistías, otros ingresos sin deuda (TUPA), pagos por banco (BCP),
reportes mensuales y por clasificador presupuestal, pérdida automática del fraccionamiento.

## 1. Historia y criterios
- Como CAJERO, quiero cobrar en ventanilla las cuotas que elija el contribuyente, entregar un
  recibo imprimible, extornar un cobro equivocado y cerrar mi caja al final del día; como
  SUPERVISOR, quiero ver los cierres y recibos de todos los cajeros.
- [x] K1 Cobro: buscar contribuyente → estado de cuenta a hoy (`GET /contribuyentes/:id/estado-cuenta`)
  → marcar cuotas (`PENDIENTE`, y `COACTIVO` según decisión 6) → ver insoluto + reajuste + mora +
  derecho de emisión y total → medio de pago → cobrar. El backend vuelve a liquidar a la fecha del
  servidor; si el total no coincide con el mostrado → 409 "la deuda cambió, vuelve a consultar".
- [x] K2 Recibo: número correlativo por año (`REC 2026-000001`, `correlativos.ts`), sin huecos ni
  duplicados; imprimible desde el navegador (A5/media hoja) con datos del contribuyente, detalle por
  cuota, total en letras, medio de pago, cajero, fecha y hora. Reimpresión marcada "COPIA".
- [x] K3 Efectos del cobro (en la misma `$transaction`): cuota → `CANCELADO`; si todas las cuotas de
  una OP/RD quedan pagadas → valor `CANCELADO`; si es cuota de convenio → `convenio_detalle`
  `CANCELADO` y, con todo el cronograma pagado, convenio `CANCELADO` (decisión 9). Dos cajeros
  sobre la misma cuota: el segundo recibe 409.
- [x] K4 Extorno con motivo obligatorio: recibo y pagos → `EXTORNADO` (nunca `DELETE`), cada cuota
  vuelve a su estado previo (`PENDIENTE` o `COACTIVO`), y el valor/convenio que se había cancelado
  vuelve a vigente. Reglas de quién y cuándo en decisión 7.
- [x] K5 Cierre diario por cajero: resumen del día (recibos, extornos, total por medio de pago y por
  tributo) → cerrar. Tras el cierre ese cajero no cobra ni extorna en esa fecha. El cierre es una
  foto inmutable e imprimible.
- [x] K6 Consulta: recibos por fecha, cajero, contribuyente o número; cierres por fecha.
- [x] K7 Accesos: niveles existentes `caja.cancelaciones` (K1–K3, K5 propio), `caja.extornos` (K4),
  `caja.reportes` (K6 de todos los cajeros). Sin nivel → 403.

## 2. Archivos afectados
- Backend: `backend/src/caja/*` (cobros, recibos, extornos, cierres + `caja.reglas.ts` puro con tests),
  `backend/src/rentas/correlativos.ts` (serie `REC`), `backend/src/rentas/estado-cuenta/*` (reusar
  `liquidar()`; extraer la carga de cuotas liquidables si hace falta), `backend/prisma/schema.prisma` + migración.
- Frontend: `frontend/src/pages/caja/*` (Cobro, ReciboImprimible, Extornos, CierreCaja, ConsultaRecibos),
  rutas en `App.tsx`; reusa `BuscadorContribuyente` y `TablaEstadoCuenta` (con selección).

## 3. Diseño
Flujo: `Página Caja -> Endpoint (JwtAuthGuard+NivelGuard) -> Service -> caja.reglas.ts / liquidar()
-> Prisma $transaction -> Postgres (+ triggers de auditoría)`.
- Cobro: bloquea las cuotas con `updateMany where estado in (PENDIENTE, COACTIVO)` y compara el count;
  reserva el número `REC`; graba recibo + un pago por cuota (snapshot insoluto, reajuste, mora,
  derecho de emisión, subtotal, estado previo); actualiza valor/convenio. Fecha = `hoyLima()`, sin cobros retroactivos.
- Extorno: inverso del cobro; el estado previo de la cuota sale del pago (no se adivina).
- Cierre: `cierres_caja (cajero, fecha)` único; los recibos del día quedan con `cierreId`.
- Endpoints: `POST /caja/cobros/liquidar` (preview), `POST /caja/cobros`, `GET /caja/recibos?fecha=&cajeroId=&contribuyenteId=&numero=`,
  `GET /caja/recibos/:id`, `POST /caja/recibos/:id/extornar`, `GET /caja/cierre?fecha=` (resumen), `POST /caja/cierre`, `GET /caja/cierres?fecha=`.
- Modelo (decisión 1): tabla nueva `recibos`; `pagos` pasa a ser el detalle por cuota; tabla nueva
  `cierres_caja`. Cada tabla nueva: `auditoria_habilitar(...)` en su migración.
- No se hace: descuentos, cobros sin deuda, bancos, comprobantes SUNAT, pagos mixtos, apertura de caja con fondo.

Mejoras frente a SIMUN (incluidas en v1):
1. Un recibo con varias cuotas (SIMUN imprime un `NROREC` por cuota y los agrupa con `NROMOV`).
2. Total recalculado en el servidor al cobrar, con 409 si cambió (SIMUN confía en la pantalla).
3. Correlativo sin huecos y sin doble cobro en concurrencia (SIMUN: `MAX()+1` sobre DBF).
4. Cierre por cajero con detalle por medio de pago (SIMUN cierra el día de toda la caja).
5. Extorno con motivo, autor y restauración exacta de cuota/valor/convenio.
Propuestas para v2: pérdida automática del convenio, descuentos por ordenanza, recaudación BCP,
reporte por clasificador presupuestal, recibo con QR de verificación, arqueo con denominaciones.

Decisiones (aprobadas 2026-10-23 según la recomendación entre paréntesis):
1. Modelo: `recibos (anio, numero, contribuyenteId, cajeroId, fecha, total, medioPago, numOperacion?,
   estado CANCELADO|EXTORNADO, motivoExtorno?, extornadoPorId?, fechaExtorno?, cierreId?)`, único
   `(anio, numero)`; `pagos` gana `reciboId`, `reajuste`, `derechoEmision`, `subtotal`, `estadoAnterior`
   y pierde `numRecibo/cajeroId/medioPago/numOperacion/descuentoAplicado` (pasan al recibo; la tabla está vacía);
   `cierres_caja (cajeroId, fecha, cantidadRecibos, cantidadExtornos, total, totalesPorMedio JSON,
   efectivoDeclarado?, diferencia?)`. (Sí.)
2. Un recibo = un cobro de un contribuyente con N cuotas, no un recibo por cuota. (Sí.)
3. Cobro parcial de una cuota: no; solo cuotas completas. Si se aprobara, se imputa primero a la
   mora (Código Tributario art. 31). (No.)
4. Orden: tributos en el orden que elija el contribuyente; cuotas de convenio en orden (inicial primero,
   no la k sin la k−1). (Sí.)
5. Medios de pago: uno por recibo; `EFECTIVO`, `TARJETA`, `TRANSFERENCIA` (incluye Yape/Plin) y
   `DEPOSITO`, con n.° de operación obligatorio salvo efectivo; `CHEQUE` deshabilitado; en efectivo la
   pantalla calcula el vuelto sin guardarlo. (Sí.)
6. Cuotas en `COACTIVO`: se cobran en ventanilla sin costas (aún no hay expedientes ni costas), con
   aviso "en cobranza coactiva"; el extorno las devuelve a `COACTIVO`. (Sí.)
7. Extorno: del recibo completo. El cajero extorna sus recibos del día antes de cerrar; después del
   cierre o de otro cajero, solo quien tenga `caja.extornos`; el extorno cuenta en el día en que se hace
   (no reabre el cierre original). (Sí.)
8. Cierre: sin apertura explícita (el primer cobro abre el día); arqueo opcional (efectivo contado →
   diferencia sobrante/faltante); un cajero no cobra con días anteriores sin cerrar. (Sí, sin el bloqueo
   por días anteriores en v1: solo aviso.)
9. Convenio pagado por completo: convenio `CANCELADO` y sus deudas originales `FRACCIONADO → CANCELADO`
   (rastreables por `convenio_deudas`); el extorno las devuelve a `FRACCIONADO`. (Sí.)
10. Pérdida automática del fraccionamiento: fuera de `caja-v1`, en una spec propia de Control y
    Recaudación que use los pagos de esta. (Fuera.)

## 4. Tareas
- [x] Rama `feat/caja-v1` desde `main`; primer commit = esta spec (`docs(specs)`).
- [x] Fase A: migración `20261024120000_caja` (decisión 1) + serie `REC` + `caja/caja.reglas.ts` con tests.
  `recibos` gana `fechaCaja` y `fechaCajaExtorno` (día de caja en hora Lima, para el cierre);
  `cierres_caja` gana `totalesPorTributo` (la foto no depende de extornos posteriores); `pagos`
  conserva `contribuyenteId`/`fechaPago` y `cuentaCorrienteId` pasa a obligatorio (todo pago tiene su deuda).
- [x] Fase B: cobro + recibo imprimible + efectos en valor/convenio (K1–K3). Pantalla en `Caja → Cancelaciones
  del Día` (`?contribuyente=` en la URL); recibo en `/caja/recibos/:id`, "COPIA" salvo la vista que sigue al cobro.
  Al cancelarse un convenio, la OP/RD de sus deudas originales también se cancela si queda pagada.
- [x] Fase C: extorno (K4). Desde el detalle del recibo; listas en "Mis recibos de hoy" (cobro) y `Caja → Extorno`
  (por día o número; adelanta `GET /caja/recibos` de K6). Una cuota de convenio no se extorna si una posterior
  sigue pagada en otro recibo (orden de la decisión 4 al revés).
- [x] Fase D: cierre diario y consultas (K5, K6) + niveles (K7). `lint` + `build` + `test` en cada fase.
  `/caja/cierre` (resumen en vivo → arqueo → cerrar; también un día anterior abierto) y `/caja/cierres/:id`
  imprimible; `Caja → Reportes`: cierres del día (con quién falta cerrar) y recibos. El resumen omite medios y
  tributos que netean cero. Con la caja cerrada, la pantalla de cobro avisa y oculta el cobro.
- [x] PR de `feat/caja-v1` hacia `main` (cuando el usuario lo pida): #13.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` ·
login `admin/admin123`. Tests mínimos: suma del recibo = Σ liquidaciones, total distinto → 409,
cuota ya cobrada → 409, última cuota de una OP → valor `CANCELADO`, última cuota del convenio →
convenio y deudas originales `CANCELADO`, cuota de convenio fuera de orden rechazada, extorno
restaura `PENDIENTE`/`COACTIVO` y valor/convenio, cierre bloquea cobros del día. Manual: cobrar
2 cuotas de predial y 1 de convenio → imprimir recibo → extornar → cobrar de nuevo → cerrar caja →
ver recibos, cierre y `/accesibilidad/auditoria`.
