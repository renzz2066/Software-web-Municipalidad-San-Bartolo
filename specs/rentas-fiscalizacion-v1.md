# Spec: Rentas — fiscalización tributaria y multas (v1)
<!-- Formato fijo 5 secciones. Aprobada 2026-10-23. Las `*-v1.md` cerradas no se editan. -->

Referencia SIMUN: `Programas/MENU01.MPR` → Fiscalización Tributaria (`frmfiscalizacion_prediosdeclarados`,
`frmfiscalizacion_fichas`, `fis_requerimientos`, `frmfiscalizacion_calcular_autoavaluo/arbitrio`);
tablas `requerimiento` (307 expedientes, todos de 2015, ninguno llegó a RD), `Fichas_Fiscalizacion`,
`rd_*_predial_fisca` / `rd_*_arbitrio_fisca` (fiscalizado vs declarado vs diferencia, sin filas),
`tabla_tecnico_fisca`, `INFRACCIONES_MULTATRIBUTARIA`, `Multas_tributarias` y
`Programas/generar_multa_omiso.prg` (multa por DJ fuera de plazo: 1 668 pendientes, la parte que sí se usa).
Base: `rentas-nucleo-v1` (predio + DJ versionada, `calculo/motor.ts`, cuyo límite de la fase D era
"una cuota ya pagada que cambia al recalcular no genera la diferencia"), `rentas-valores-v1` (RD,
notificación, exigibilidad, coactivo) y `caja-v1` (cobra cualquier fila de cuenta corriente).
Fuera de v1: descargos (spec propia), cartas informativas masivas, gradualidad automática de multas,
fiscalización masiva por cruce con Catastro, fotos/geo de la inspección desde el celular.

## 1. Historia y criterios
- Como SUPERVISOR/ADMIN de Rentas (fiscalización), quiero abrir expedientes de fiscalización, registrar
  lo verificado en la inspección, determinar la diferencia contra lo declarado y emitir la RD y la
  multa; como registrador, quiero que una DJ presentada fuera de plazo proponga su multa.
- [x] F1 Expediente: apertura con número correlativo (`FIS 2026-000001`), tipo (`ORDINARIA` /
  `A_SOLICITUD`), contribuyente, predios a fiscalizar, años (desde–hasta, dentro de la prescripción:
  4 años, 6 si nunca declaró — Código Tributario art. 43) y fiscalizador. Estados
  `ABIERTO → INSPECCIONADO → RESUELTO | SIN_DIFERENCIAS`, o `ANULADO` con motivo (nunca `DELETE`).
- [x] F2 Requerimiento de inspección imprimible (fecha y hora de la visita, base legal arts. 62 y 87)
  y registro de su notificación (misma modalidad que los valores, art. 104).
- [x] F3 Ficha de inspección: por predio, los datos verificados (terreno, pisos con categorías, otras
  instalaciones, uso, zona) con el mismo formulario de la DJ. La ficha no toca el predio hasta resolver.
- [x] F4 Liquidación (simular): por año y tributo, lo determinado con la ficha contra lo declarado
  (lo que ya está en cuenta corriente), con base imponible, impuesto/arbitrio y diferencia; usa
  `motor.ts` con los parámetros de cada año. Sin diferencias → `SIN_DIFERENCIAS`.
- [x] F5 Resolución (ejecutar, una transacción): la ficha se aplica al predio como DJ de motivo
  `FISCALIZACION` (versionada); las diferencias pasan a cuenta corriente (decisión 3); se emite la RD
  de fiscalización (decisión 4) y, si corresponde, la RM por la infracción (F6). Expediente → `RESUELTO`.
- [x] F6 Multas (Código Tributario art. 180 y tablas): catálogo de infracciones por año (decisión 5) —
  176.1 no declarar en plazo (50 % UIT persona natural / 1 UIT jurídica, como SIMUN), 176.2 otras
  declaraciones (15 % / 30 % UIT), 178.1 declarar cifras falsas u omitir (50 % del tributo omitido).
  La multa nace como deuda (tributo `MULTA`) con su Resolución de Multa imprimible e interés desde la
  comisión o detección de la infracción (art. 181).
- [x] F7 DJ extemporánea: al grabar una DJ de inscripción o compra fuera de plazo (D.L. 776 art. 14:
  último día hábil de febrero o del mes siguiente a la adquisición) se propone la multa 176.1; quien
  registra confirma o descarta con motivo (decisión 6).
- [x] F8 Accesos: nivel existente `rentas.fiscalizacion` (F1–F6); F7 en la DJ con
  `rentas.registro-tributario`. Fiscalizadores en Maestros (`rentas.maestros`). Sin nivel → 403.

## 2. Archivos afectados
- Backend: `backend/src/rentas/fiscalizacion/*` (expedientes, fichas, liquidación, resolución,
  imprimibles + `fiscalizacion.reglas.ts` y `multas.reglas.ts` puros con tests), `backend/src/rentas/calculo/motor.ts`
  (diferencias al comparar, decisión 3), `backend/src/predios/*` (motivo `FISCALIZACION`, F7),
  `backend/src/rentas/valores/*` (tipo `RM`, origen fiscalización), `backend/src/rentas/maestros/*`
  (fiscalizadores, infracciones), `backend/src/rentas/correlativos.ts` (series `FIS`, `RM`),
  `backend/prisma/schema.prisma` + migración + seed (tributo `MULTA`, infracciones del año).
- Frontend: `frontend/src/pages/rentas/fiscalizacion/*` (Expedientes, Expediente, Ficha, Liquidación,
  Requerimiento/RD/RM imprimibles), pestaña "Fiscalización" en `FichaContribuyente.tsx`, aviso de
  multa en `DeclaracionForm.tsx`, Maestros (fiscalizadores, infracciones), rutas en `App.tsx`.

## 3. Diseño
Flujo: `Página -> Endpoint (JwtAuthGuard+NivelGuard) -> Service -> reglas puras / motor.ts -> Prisma
$transaction -> Postgres (+ triggers de auditoría)`. Simular y ejecutar comparten el mismo plan.
- Liquidación: `diferencias(fiscalizado, declarado)` puro por año, tributo y cuota; lo declarado es la
  suma de `cuenta_corriente` del predio (menos `ANULADO`) y lo fiscalizado sale de `valorizarPredio()`
  con la ficha y los parámetros del año. Solo cuenta lo que sube: si baja, lo resuelve un descargo.
- Multa: `montoMulta(infraccion, tipoPersona, uit, tributoOmitido)` pura, redondeo a 2 decimales.
- Plazos: `vencePlazoDJ(motivo, fechaHecho, feriados)` puro (reusa `plazos.ts` de valores).
- La RD y la RM son `valores_cab` como las de Control y Recaudación: se notifican, se vuelven exigibles
  y se transfieren a coactivo con las pantallas existentes; Caja las cobra sin cambios.
- Endpoints: `GET/POST /rentas/fiscalizacion/expedientes`, `GET /rentas/fiscalizacion/expedientes/:id`,
  `PATCH .../:id/requerimiento`, `PUT .../:id/fichas/:predioId`, `POST .../:id/liquidar`,
  `POST .../:id/resolver`, `POST .../:id/anular`, `GET/PUT /rentas/maestros/fiscalizadores`,
  `GET/PUT /rentas/maestros/infracciones/:anio`, `POST /predios/declaraciones/:id/multa` (F7).
- Modelo (ver Decisiones): tablas nuevas `fiscalizaciones`, `fiscalizacion_predios` (ficha JSON por
  predio), `fiscalizadores`, `infracciones`; `MotivoDeclaracion` + `FISCALIZACION`; `TipoValor` + `RM`;
  `valores_cab.fiscalizacionId?`; `cuenta_corriente.ajusteDeId?`; `declaraciones_juradas.fechaHecho?`.
  Cada tabla nueva: `auditoria_habilitar(...)` en su migración.
- No se hace: descargos/reclamos, rebaja de deuda por fiscalización, gradualidad, fiscalización masiva,
  arbitrios por zona distinta a la del predio, cartas informativas.

Mejoras frente a SIMUN (incluidas en v1):
1. Un solo flujo expediente → ficha → liquidación → RD/RM (SIMUN tiene las tablas, pero nunca emitió RD).
2. La ficha reusa el formulario y el motor de la DJ: la valorización fiscalizada es la misma que la declarada.
3. Simular la diferencia antes de resolver, con años limitados por la prescripción.
4. La multa por DJ extemporánea se propone y se confirma, no se genera a ciegas como `generar_multa_omiso`.
5. RD y RM entran al ciclo de valores ya construido (notificación, exigibilidad, coactivo, caja).
Propuestas para v2: gradualidad por ordenanza, fiscalización masiva por cruce con Catastro o
licencias, inspección desde el celular con fotos y geolocalización, programación de inspecciones.

Decisiones (aprobadas 2026-10-23 según la recomendación entre paréntesis):
1. Modelo: `fiscalizaciones (anio, numero, tipo, contribuyenteId, fiscalizadorId, anioDesde,
   anioHasta, estado, fechaInspeccion?, notificación como en valores, motivoAnulacion?)`,
   `fiscalizacion_predios (fiscalizacionId, predioId, ficha JSON, liquidacion JSON)`,
   `fiscalizadores (nombre, dni, activo, usuarioId?)`, `infracciones (anio, codigo, articulo, numeral,
   descripcion, base UIT|TRIBUTO_OMITIDO, porcentajeNatural, porcentajeJuridica, ordenanza)`. (Sí.)
2. Fiscalizadores como catálogo propio en Maestros, con `usuarioId` opcional: los inspectores de
   campo no siempre son usuarios del sistema (SIMUN: `tabla_tecnico_fisca`). (Sí.)
3. Diferencias en cuenta corriente: las cuotas `PENDIENTE` sin valor se recalculan con el predio
   fiscalizado; las protegidas (`CANCELADO`, `FRACCIONADO`, `COACTIVO` o en un valor) reciben una fila
   nueva de diferencia con `ajusteDeId` = la cuota original, mismo tributo, cuota y vencimiento (la mora
   corre desde el vencimiento original). `motor.ts` suma esas diferencias al comparar, para que un
   recálculo posterior no las duplique. Cierra el límite de la fase D del núcleo. (Sí.)
4. RD de fiscalización: misma serie `RD` y mismas pantallas que las de Control y Recaudación, una
   por contribuyente, predio y año (como V2), con `fiscalizacionId`; el imprimible muestra declarado,
   fiscalizado y diferencia. El predial omitido también va en RD (no OP): nace de una fiscalización
   (art. 76), no de lo declarado. (Sí.)
5. Multas: catálogo `infracciones` por año en Maestros, sembrado con 176.1, 176.2 y 178.1; la multa
   es una fila `cuenta_corriente` (tributo `MULTA`, cuota 0, vencimiento = fecha de la infracción) y su
   valor es `RM` (serie propia `RM 2026-000001`). Sin gradualidad en v1: 100 % de la multa. (Sí.)
6. DJ extemporánea (F7): `declaraciones_juradas` gana `fechaHecho?` (adquisición o inscripción); si la
   DJ vence el plazo, el sistema propone la 176.1 y se confirma o descarta con motivo. No se genera
   sola como en SIMUN. (Sí.)
7. Solo se determina lo que sube. Si la fiscalización encuentra menos de lo declarado, se registra en
   el expediente y se atiende por descargo (spec siguiente), sin tocar la deuda. (Sí.)
8. Años fiscalizables: desde el año actual − 4 (− 6 si el contribuyente no tiene DJ del predio) hasta el
   año actual, y solo años con parámetros cargados en Maestros. (Sí.)

## 4. Tareas
- [x] Rama `feat/rentas-fiscalizacion` desde `main`; primer commit = esta spec (`docs(specs)`).
- [x] Fase A: migración (decisiones 1, 5, 6) + series `FIS`/`RM` + tributo `MULTA` + Maestros
  (fiscalizadores, infracciones) + reglas puras con tests. Migración `20261025120000_rentas_fiscalizacion`
  (también `ajusteDeId` y `fiscalizacionId` de las decisiones 3 y 4); `valores_cab` gana además `infraccionId`
  y `declaracionId` para que la RM muestre su infracción y su DJ. Infracciones en Maestros → Fiscalización
  (editables aunque el año tenga deuda; las usadas en una RM no se quitan) y se copian al abrir año. La DJ
  manual no acepta el motivo `FISCALIZACION`; la emisión de Control y Recaudación sigue limitada a OP/RD.
- [x] Fase B: expediente, requerimiento imprimible con notificación y ficha de inspección (F1–F3).
  `GET /rentas/fiscalizacion/opciones` arma la apertura (predios del contribuyente, años no prescritos con UIT y
  escala). La ficha reusa el formulario de la DJ (`predios/DatosPredioCampos.tsx` + `predioForm.ts`, extraídos de
  `DeclaracionForm`); `GET /predios/catalogos` acepta también `rentas.fiscalizacion`. Guardar una ficha borra la
  liquidación previa del predio.
- [x] Fase C: liquidación y resolución con RD de fiscalización y diferencias en cuenta corriente (F4, F5).
  Lo fiscalizado sale de `CalculoService.lineasFiscalizacion` (el motor con la ficha en lugar del predio, sin escribir) y
  se compara por año, tributo, predio y cuota; las diferencias (`ajusteDeId`) se suman a su cuota en `planificar`
  y en el cálculo. Una cuota pendiente libre entra completa a la RD (sube a lo fiscalizado); la protegida, solo su
  diferencia. El predial va por contribuyente: con un solo predio la RD se liga a él; con varios, RD del año sin predio.
  La liquidación se guarda igual en cada `fiscalizacion_predios`. Sin aumentos: SIN_DIFERENCIAS y el predio no cambia.
  La RD imprimible muestra declarado/fiscalizado/omitido (`/rentas/fiscalizacion/valores/:id`; `GET /rentas/valores/:id`
  acepta también `rentas.fiscalizacion`). Nota: aplicada la ficha, un recálculo posterior sí rebaja cuotas pendientes
  si la ficha dio menos en algún concepto (la decisión 7 rige para la determinación de la RD, no para el cálculo).
- [x] Fase D: multas 178.1 en el expediente y 176.1 en la DJ extemporánea, con RM imprimible (F6, F7) + niveles (F8).
  `lint` + `build` + `test` en cada fase. La liquidación prevé la 178.1 (una RM por año con omitido, 50 % del omitido,
  se comete al detectarse: fecha de la inspección) y la resolución la emite si se marca. La DJ gana "fecha de
  adquisición" (inscripción y compra); el detalle del predio marca la DJ extemporánea y propone la 176.1 (% de la UIT
  del año en que vence el plazo; interés desde el día siguiente), que se emite o se descarta con motivo una sola vez.
  El endpoint quedó en `POST /rentas/fiscalizacion/declaraciones/:id/multa` (no en `/predios/...`: Predios no depende
  de Rentas) con nivel `rentas.registro-tributario` o `rentas.fiscalizacion`. Migración `20261026120000_multa_dj_descartada`
  (`declaraciones_juradas.multaDescartada`), escrita a mano porque la BD compartida trae tablas de coactivo creadas
  fuera de migraciones. Las RM se transfieren a coactivo como OP/RD y se ven en `/rentas/{fiscalizacion|registro-tributario}/valores/:id`.
- [x] Prueba manual completa (2026-10-24, FIS 2026-000006). Corrige la liquidación: lo declarado es, por cuota, lo mayor
  entre la cuenta corriente y lo que `motor.ts` determina sin la ficha (`referenciaDeclarada`); el predial va por
  contribuyente y un predio inscrito por DJ sin calcular se cobraba como omitido y con multa 178.1. Esa parte sube a la
  cuenta corriente sin RD ni multa (en cuota protegida, fila de diferencia propia) y la pantalla la indica.
- [ ] PR de `feat/rentas-fiscalizacion` hacia `main` (cuando el usuario lo pida).

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` ·
login `admin/admin123`. Tests mínimos: diferencia por año con un piso no declarado, nada si baja,
fila de diferencia sobre cuota `CANCELADO` y recálculo posterior sin duplicar, años fuera de
prescripción rechazados, multa 176.1 natural/jurídica y 178.1 sobre el omitido, plazo de DJ con fin
de semana y feriado. Manual: abrir expediente → requerimiento → ficha con un piso más → simular →
resolver → ver RD y RM en el estado de cuenta, cobrarlas en Caja y revisar `/accesibilidad/auditoria`.
