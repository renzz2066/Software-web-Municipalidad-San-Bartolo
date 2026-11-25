# Spec: Rentas — Personas, Direcciones, Predios y DJ al modelo Lurín (v2)
<!-- Formato fijo 5 secciones. Decisiones cerradas 2026-11-17; cada fase se implementa cuando el usuario la aprueba. Reemplaza C1–C3 y C5 de `rentas-nucleo-v1.md`. -->

- **Reglas:** `docs/rentas/reglas-negocio.md`. Esta spec las cita por ID y no las repite.
- **Marco:** la ley nacional va en el código; lo que fija la ordenanza de cada muni es un dato en su base.
- **Mapa de tablas de Lurín:** solo en local, `docs/privado/` (está en gitignore porque el repo es público).

## 1. Historia y criterios
- Como SUPERVISOR/ADMIN de Rentas, quiero llevar personas, direcciones, predios y DJ con la estructura de Lurín para declarar, determinar y liquidar igual que ellos. Esa estructura es una **DJ por contribuyente y año, con un anexo por predio**.
- Como CAJERO, sigo consultando el estado de cuenta igual que hoy.
- [ ] C1 **Personas**: nombres y apellidos separados; varios documentos, contactos y relacionados; perfil, clasificación y estado (P01–P15).
- [ ] C2 Pasar a INHABILITADO con deuda, a mano o automático → `409` "mantiene una deuda de S/ X y no puede ser inhabilitado" (P01, P03). Habilitar no tiene restricción (P02). Estados según P16.
- [ ] C3 **Direcciones únicas**: un catálogo que comparten personas, predios y relacionados. La dirección literal se genera con componentes ordenados (D01–D05).
- [ ] C4 **Predio maestro** con linderos, datos para arbitrios y coordenadas, y la vista "personas asociadas" por año (R01–R06).
- [ ] C5 **DJ presentada** (J01–J16):
  - correlativo por año, motivo y sub-motivo;
  - un anexo por predio, con niveles, obras complementarias, usos y aranceles rústicos;
  - documentos adjuntos y adquirientes o transferentes;
  - estados PENDIENTE → LIQUIDADA (se puede reabrir) y ANULADA con motivo.
- [ ] C6 **Determinar**: por cada año afectado sale la HR y un PU/PR por predio, con su autoavalúo y los arbitrios por mes (V01–V07, L01–L07, J10, J15).
- [ ] C7 **Liquidar** ("Generar Cta."): se eligen los años y si va impuesto predial, arbitrios o ambos (L08).
  - Bloqueos: V06, L09 y J14.
  - Reliquidación: L10.
  - Todo en una `$transaction` (L12). Las informativas no generan cuenta (J07).
- [ ] C8 **Multi-muni**:
  - Las mismas migraciones en todas las bases (`db:setup:todas`).
  - Catálogos y reglas sembrados con el valor nacional y editables por muni.
  - Cero `if (muni === …)` en el código.
  - Probado en `sanbartolo.localhost` y `demo.localhost` sin cruzar datos.
- [ ] C9 **Accesos**: se reusan `rentas.registro-tributario` y `rentas.calculo-masivo`. Errores: 401 = credenciales; 409 = regla de negocio con mensaje legible; lo demás = conexión o validación.

## 2. Archivos afectados
- Backend:
  - `backend/prisma/schema.prisma` + migraciones + seed de catálogos.
  - `backend/src/contribuyentes/*` y un nuevo `backend/src/direcciones/*`.
  - `backend/src/predios/*`, del que sale la DJ hacia un nuevo `backend/src/declaraciones/*`.
  - `backend/src/rentas/calculo/*` (determinación + liquidación).
  - Lecturas en `rentas/estado-cuenta`, `rentas/fiscalizacion` (+multas) y `rentas/valores`.
- Frontend:
  - `frontend/src/pages/rentas/*`: Personas, Direcciones, Predios, DJ presentadas + anexo, Determinar/Liquidar.
  - `pages/modulos/catalogo.ts`.
- No cambian: `caja`, `coactiva`, `auth`, `muni`. Consumen `CuentaCorriente`, que conserva sus FK a contribuyente y predio.

## 3. Diseño
Flujo: `Persona → DJ presentada → Anexo por predio (+niveles, obras, usos) → Determinar → Determinacion anual (HR + PU/PR + arbitrios por mes) → Liquidar → CuentaCorriente`.

**Modelo** (nombres provisionales):
- Personas: `Contribuyente` (+ `…Documento`, `…Contacto`, `…Relacionado`).
- Direcciones: `Direccion` (+ `DireccionComponente`).
- `Predio`.
- DJ: `DeclaracionJurada` (con la copia de la persona) y `DjAnexo` (+ `DjNivel`, `DjObra`, `DjUso`, `DjArancelRustico`, `DjDocumento`, `DjAdquiriente`).
- Determinación: `Determinacion` (contribuyente + año = HR), `DeterminacionPredio` (PU/PR, con el detalle del cálculo en JSON) y `DeterminacionArbitrio` (predio × uso × mes).

**Dos capas:**
- Lo **declarado** (la DJ) no se edita una vez liquidado: se reabre o se rectifica con otra DJ.
- Lo **calculado** (la determinación) se regenera al determinar. Por ejemplo, una DJ de 2026 por una compra de 2023 deja determinaciones de 2024 a 2026.

**Otras decisiones de diseño:**
- **Determinación anual masiva (J09):** copia la última determinación al año nuevo con los parámetros nuevos. Reemplaza el cálculo masivo de v1 y reusa simular/ejecutar.
- **Catálogos con código:** motivos y su tipo (informativa o declarativa), condición, usos y sub-usos, exoneraciones, tipos de documento, contacto y relacionado, componentes de dirección, frecuencias, ubicación de parques, perfiles. Son tablas en cada base. Las tasas siguen en los parámetros del año, con su ordenanza.
- **`ReglaMuni`:** clave/valor por base, con su ordenanza. Solo para las reglas marcadas "Parám." que no son un catálogo: J05, J11, J16 y la agrupación de arbitrios en cuotas.
- **No se hace:** descompilar el ejecutable de Lurín, copiar sus pantallas tal cual, alcabala, vehicular, licencias ni los intereses de Lurín (los nuestros se calculan al vuelo).

**Decisiones** (cerradas el 2026-11-17; el detalle está en cada regla):
1. **Estados de la persona (P16):** HABILITADO, INHABILITADO y PENDIENTE.
   - ACTIVO pasa a HABILITADO. INACTIVO y BAJA pasan a INHABILITADO: hoy son dos estados para lo mismo, y por eso INACTIVO se saltaba la regla de la deuda.
   - "Fiscalizado" no es un estado, porque una persona puede estar fiscalizada y habilitada a la vez.
2. **Ficha al liquidar (L13):** gana el dato más reciente.
   - Sobrescribir siempre, como Lurín, pisa datos nuevos al reliquidar una DJ vieja.
   - No actualizar nunca deja la ficha desactualizada.
3. **Relacionados (P10):** se guardan en la ficha, con enlace opcional a la persona registrada. Obligar a registrarlos llenaría el padrón de personas que no tributan.
4. **DJ a la baja (J14, J17):** queda EN_REVISION con un plazo de 45 días hábiles (CT art. 88).
   - La aprueba un SUPERVISOR distinto de quien la registró.
   - Al vencer el plazo no se liquida sola: queda liquidable y ya no se puede rechazar.
5. **Arbitrios (L07):** se determinan por mes y se agrupan en cuotas según `ReglaMuni`. Es la única forma de cobrar bien una compra en mayo o un uso que empieza en agosto.
6. **Sin documento (P08, P17, P18):** se permite, con justificación, y la persona queda PENDIENTE. Prohibirlo lleva a inventar números como 00000000, que es peor.
7. **Datos actuales:** se convierten, no se borran.
   - Documentos, contactos, relacionados y domicilio pasan tal cual.
   - En persona jurídica, el nombre pasa a razón social.
   - En persona natural, el nombre se separa como "paterno materno nombres", que es el orden en que lo arma la consulta de DNI, y la persona queda PENDIENTE para revisarlo.
   - Las DJ de v1 (`snapshot`) no se convierten: son de prueba y la Fase 4 las reemplaza.

## 4. Tareas
- [x] Rama `docs/rentas-nucleo-v2`: esta spec, `docs/rentas/reglas-negocio.md` y las decisiones de §3.
- [x] Fase 0: catálogos + `ReglaMuni` + seed nacional (rama `feat/rentas-v2-catalogos`).
  - Una tabla `catalogos` (grupo + código único) y `reglas_muni`; se editan en Maestros → "Catálogos y reglas". El código no se edita; las filas `sistema` no se desactivan.
  - Seed idempotente: crea lo que falta y no pisa lo editado por la muni.
  - Valores por defecto elegidos (conservadores, editables): motivos DECLARATIVA salvo ACTUALIZACION_DATOS; J05 = INSCRIPCION, COMPRA, MODIFICACION, ACTUALIZACION_DATOS; J11 = mes siguiente; J16 = permitido.
  - Pendiente: pedir a Lurín el contenido de sus catálogos (solo catálogos, sin personas) y ajustar el seed.
- [x] Fase 1: Personas (C1, C2) + conversión de los contribuyentes actuales (decisión 7). No toca el cálculo (rama `feat/rentas-v2-personas`).
  - Tablas `contribuyente_documentos` (tipo + número único), `_contactos`, `_relacionados` y `_beneficios`; estado `EstadoPersona`. `tipoDoc`/`numDoc` de `contribuyentes` quedan como copia del documento principal para caja, valores y coactiva.
  - API: `PATCH :id/estado` (P01 → 409 con el monto de la deuda a la fecha), `POST :id/aprobar-excepcion` y `DELETE :id` (SUPERVISOR/ADMIN), `POST :id/beneficios` y `PATCH …/revocar`, `GET por-documento` (P10).
  - Elegido por ser lo conservador: INHABILITADO no declara ni se fiscaliza (como BAJA en v1); el teléfono de v1 pasa como TELEFONO_CASA; en la sucesión se conservan los nombres del causante si existen; "un cónyuge vigente" lo valida el servicio (sin índice parcial, para no desalinear Prisma).
  - P03 (inhabilitación y rehabilitación automáticas al liquidar) y la aplicación de P14/P15 al determinar quedan para la Fase 5.
- [x] Fase 2: Direcciones únicas (C3) y migración del domicilio de las personas (rama `feat/rentas-v2-direcciones`).
  - Tablas `direcciones` (ubigeo, sector, habilitación y vía con las tablas actuales, literal, referencia, latitud/longitud) y `direccion_componentes` (orden + código de `COMPONENTE_DIRECCION`). La identidad (`clave`) es ubigeo|sector|habilitación|vía|componentes ordenados por código: no se duplica (409 con el id de la existente).
  - Persona: `direccionId` (en el distrito) o `ubigeo` + `domicilioTexto` (foráneo), P11. `direccionFiscal` sigue llenándose con la literal para caja, valores y estado de cuenta; editar una dirección la actualiza en todos los que la usan, en la misma transacción.
  - API `/direcciones` (buscar, ver, crear, `PATCH :id`, `PATCH :id/estado`). Sin DELETE: se da de baja y quien ya la tiene la conserva. Pantalla Registro Tributario → Direcciones.
  - Elegido por ser lo conservador: el distrito propio es la regla `muni.ubigeo` (P11, por defecto 150129, editable en Maestros) en vez de un valor en el código; editar o dar de baja una dirección lo hace un supervisor, porque cambia el domicilio de todos; la literal mantiene el formato de v1 (código de vía tal cual, `N°`, `Dpto.`…) para que los recibos no cambien; el `interior` de v1 pasa al componente DPTO; si dos personas del mismo domicilio tenían referencias distintas, se juntan con " / "; el texto heredado sin estructura queda en `domicilioTexto` (con su referencia) y se conserva mientras no se toque; una dirección exige vía o habilitación.
  - Pendiente: los relacionados siguen con su dirección en texto y los predios con la suya (pasan a direcciones únicas en la Fase 3); renombrar una vía o habilitación en Maestros no regenera las literales (igual que en v1).
- [x] Fase 3: Predio maestro (C4) (rama `feat/rentas-v2-predios`).
  - `Predio` suma tipo urbano/rústico, nombre, `direccionId` (dirección única, D01), coordenadas, 4 linderos (metros + colindante), frecuencia de barrido, ubicación respecto a parques y frontis (R01, R02). Titulares con condición de propiedad (R05) y `fechaFin`. Tabla `predio_beneficios` (R06).
  - API: `PATCH :id/maestro` (identificación, arbitrios y condición de los titulares), `GET :id/personas?anio=` (asociados en el año y contribuyente al 1 de enero, J10), `POST :id/beneficios` y `PATCH …/revocar`. Pantalla: secciones nuevas en la ficha del predio.
  - Elegido por ser lo conservador: ubicación, área y construcción siguen entrando solo por la DJ de v1; la DJ guarda la ubicación como dirección única (la reusa si existe) y deja `zonaId`…`referencia` del predio como copia, porque los leen el cálculo, caja, valores y fiscalización; una dirección que usa un predio no cambia de ubicación desde Direcciones (409: se corrige con una DJ), solo su referencia o coordenadas; la condición se asigna sola (único, condominio o sucesión) salvo que alguien elija otra; un predio inafecto exige que todos sus titulares vigentes tengan inafectación que cubra esos años; la deducción (P15) no va en el predio; en la conversión, la fecha de fin de un titular de baja sale de la primera DJ cuya foto ya no lo incluye (sin DJ queda "sin fecha"); quien vuelve a ser titular reinicia su fecha de adquisición (una fila por persona y predio).
  - Pendiente: varios usos por predio (R03) y el % de cada condómino en su propia DJ (R04) van con la DJ presentada (Fase 4); la condición, los datos de arbitrios y los beneficios se aplican al determinar (Fase 5).
- [x] Fase 4: DJ presentada + anexos (C5), sin liquidar (rama `feat/rentas-v2-declaraciones`).
  - Tablas `dj_presentadas` (correlativo AA-NNNNNNN por año, motivo y sub-motivo, tipo copiado del motivo, formulario y folios, copia de la persona, estado, anulación y DJ que rectifica), `dj_anexos` (un predio por anexo: condición, %, fechas de adquisición, documento y descargo, afectación del predial y de los arbitrios, transferencia, áreas), `dj_niveles`, `dj_obras`, `dj_usos`, `dj_aranceles_rusticos`, `dj_documentos` y `dj_adquirientes`. Estados `PENDIENTE`, `EN_REVISION`, `LIQUIDADA`, `ANULADA`, `RECHAZADA`.
  - API `/declaraciones` (buscar por número, nombre o documento; ver; registrar; `PUT :id` mientras está pendiente; `POST :id/anular` con motivo; `POST :id/reabrir`, supervisor, J05) y `GET /predios?q=` para elegir el predio. Pantallas: DJ presentadas, formulario con anexos y ficha.
  - Elegido por ser lo conservador: los modelos se llaman `DjPresentada`/`DjAnexo` y conviven con la `DeclaracionJurada` de v1 (por predio), que siguen usando el formulario de v1, fiscalización y las multas 176.1, hasta que la Fase 5 liquide con estas; la DJ nueva no toca el predio ni la cuenta: queda PENDIENTE; un predio nuevo se crea INACTIVO, sin titulares, con su dirección única (lo activa la liquidación; si la DJ se anula queda inactivo, no se borra); si no se indican, el predial afecta desde el año siguiente al hecho (J10) y los arbitrios según `arbitrios.inicioAfectacion` (J11); R04 suma lo último que declaró cada otro condómino en su propia DJ (sin contar a quien descargó ni a los transferentes del anexo), no los titulares de v1; un descargo exige ser titular (v1) o haber declarado el predio, y el de transferencia exige adquiriente; una persona inhabilitada no declara; los aranceles rústicos guardan categoría y clasificación en texto, porque aún no hay su tabla de valores (V07); las obras guardan medidas y un valor declarado, como en v1, hasta tener valores oficiales (V05).
  - Pendiente: anular una DJ liquidada (extorna su cuenta, J04) y EN_REVISION/RECHAZADA con la aprobación del supervisor (J14, J17) van con la determinación y la liquidación (Fase 5); las prórrogas de presentación (J16) quedan sin pantalla.
- [x] Fase 5: determinar + liquidar (C6, C7), y adaptar estado de cuenta, fiscalización y valores (rama `feat/rentas-v2-determinacion`).
  - Tablas `determinaciones` (HR: persona + año; base, deducción, impuesto, emisión, arbitrios; DETERMINADA → LIQUIDADA → REEMPLAZADA o DESCARTADA, nunca se borra), `determinacion_predios` (PU/PR con su autoavalúo y lo declarado que se usó) y `determinacion_arbitrios` (predio × uso × mes × concepto). `cuenta_corriente.determinacionId`. La DJ guarda la revisión (J14), quién liquidó, el padrón previo (`aplicado`) y la multa 176.1 descartada. Maestros: tarifas por criterio (frecuencia, parques; por predio, m² o metro de frontis; L07) y aranceles rústicos (V07).
  - API `/declaraciones/:id/determinar`, `previa-liquidacion`, `liquidar` (años y tributos, L08), `revision` (J14, J17), `multa` (J08), `GET :id/determinacion` y `GET /declaraciones/determinaciones?contribuyenteId=`. Anular una DJ que generó cuenta la extorna y devuelve el padrón (J04). Pantallas: panel en la ficha de la DJ, HR en la ficha de la persona, Maestros; el estado de cuenta muestra la DJ de origen y los ajustes.
  - Qué rige por predio y año (J10, J11, J15): el último anexo liquidado de la persona (o esta DJ) que ya rige; si no, lo que usó la determinación liquidada del año; si no, el padrón (titular al 1 de enero para el predial, en el mes para los arbitrios). Liquidar recalcula y exige que nada haya cambiado desde que se determinó (409: volver a determinar).
  - Reliquidación (L09, L10): lo pendiente sin valor se anula y se rehace; lo pagado se cierra por lo pagado y la diferencia va como cuota de ajuste con el vencimiento original; el exceso pagado se aplica a las cuotas nuevas y lo que sobra queda informado como saldo a favor. Bajar una deuda con valor, coactivo o convenio se bloquea.
  - Elegido por ser lo conservador: J14 vale para toda DJ que baje un período liquidado (también un descargo), con 45 días hábiles desde la presentación y los feriados de Maestros; una DJ con cuenta se anula solo si es la última liquidada sobre la persona y sus predios y su cuenta sigue pendiente sin valor; el transferente enlazado en una compra deja de ser titular (no se cobra dos veces), pero su cuenta se corrige con su propio descargo (aviso); P03 solo tras un descargo de la propia persona; si la deducción P15 cubre la base no hay impuesto mínimo (queda la emisión); el inafecto P14 no paga predial ni emisión; R06 descuenta su % del valor del predio en la base; una resolución revocada rige hasta su año final; el predial vence el último día hábil (L11) y cada cuota de arbitrios el del mes central (feb., may., ago. y nov. con las trimestrales); el área común del terreno del anexo ya es la atribuida al predio; la copia del predio (áreas, uso, pisos, instalaciones, autoavalúo) sigue la última DJ liquidada, para el cálculo v1, caja y fiscalización; el cálculo v1 no toca a quien ya tiene el año liquidado desde una DJ; valores no emite a quien tiene una DJ pendiente que toca el año y toma la base de la determinación; fiscalización cuenta las DJ v2 para el omiso y, en un año liquidado desde una DJ, compara solo con la cuenta; L13: la copia de la persona sale de la ficha al registrar y el formulario no la edita, así que no hay datos que pasar (se avisa si la ficha cambió después); la informativa se determina igual y al liquidar solo aplica el padrón.
  - Pendiente: incremento por pisos (V03) y valores oficiales de obras (V05: sigue el valor declarado); multa por cambios de más de 5 UIT (J08) y prórrogas (J16); corregir la cuenta del transferente desde la DJ del comprador; la fiscalización aún resuelve con la DJ de v1 (motivo FISCALIZACION) y el formulario de DJ de v1 sigue activo: se retiran con la Fase 6.
- [x] Fase 6: determinación anual masiva (J09) con simular/ejecutar (rama `feat/rentas-v2-masiva`).
  - `POST /rentas/calculo/simular` y `ejecutar` (mismas pantallas: Cálculo Masivo y "Determinar un año sin DJ" en la ficha de la persona) determinan con la v2 y liquidan como una DJ (L09, L10, L12): determinación sin DJ (`djId` nulo, `detalle.masiva`). Reemplaza al cálculo v1, que se retiró; valores (a quién no emitir y la base de la OP) y fiscalización (lo fiscalizado con la ficha) usan el mismo motor.
  - Qué rige (J09): lo de la Fase 5 y, si el año aún no tiene determinación, la del último año determinado tal como estaba en diciembre (quien tenía el predio en diciembre paga el predial del año nuevo, J10; quien lo dejó antes, no), con los parámetros del año nuevo.
  - No se determina a quien tiene el año liquidado desde una DJ (se corrige con otra DJ), ni a quien tiene una DJ pendiente o reabierta que toca el año, ni a quien bajaría una deuda con valor, coactivo o convenio (L09): se informan. Repetirla no escribe nada si la determinación y la cuenta son las mismas.
  - La resolución de una fiscalización deja su ficha como DJ de motivo FISCALIZACION ya liquidada (rige desde el año de la resolución y no se anula: se corrige con un reclamo contra la RD), para que la determinación siguiente parta de lo fiscalizado. El formulario de DJ de v1 se retiró: sus rutas llevan a la DJ presentada con persona, motivo y predio precargados (ya no existe `POST /predios/declaraciones`); las DJ de v1 se siguen viendo.
  - Elegido por ser lo conservador: carga en bloques de 300 personas en una sola transacción (hasta 5 min); el arrastre busca la última determinación hasta 10 años atrás; sin arancel (V06) no se toca el predial de la persona, pero sí sus arbitrios; la masiva no pasa por la revisión J14 (es la actualización de valores de la muni, no una DJ); una cuota extornada (J04) ya no cuenta como declarada en fiscalización ni bloquea los parámetros del año.
  - Pendiente: lo que la Fase 5 dejó abierto (V03, V05, multa por cambios de más de 5 UIT, J16, cuenta del transferente); la objeción a la actualización (J09) se presenta como DJ, sin registro propio. Van en la Fase 7.
- [x] Fase 7: lo que dejaron abierto las Fases 5 y 6 (rama `feat/rentas-v2-pendientes`).
  - **V03:** la UIT del año suma "incremento desde el piso N" y su %; el valor unitario de cada nivel numérico ≥ N sube ese % antes de depreciar. Vacío = no aplica (la muni lo llena según la RM vigente). Sótanos, azoteas y mezzanines no cuentan como piso.
  - **V05:** tabla `valores_obras` del año (código, descripción, unidad, valor por unidad) y factor de oficialización en la UIT del año. La obra con código vale cantidad × valor × factor × (1 − depreciación); la depreciación sale de la tabla del año con la clasificación del primer nivel (casa habitación si no hay niveles), el material, la conservación y la antigüedad de la obra, que pasan a ser obligatorios con código. Sin código sigue el valor declarado (como v1). Sin valor o sin factor del año, el predio no se valoriza (como V06).
  - **J08 (5 UIT):** al determinar una DJ de motivo MODIFICACION se guarda, por predio, el autoavalúo de antes (lo que regía sin esta DJ) y el de después, ambos con los parámetros del año del hecho (fecha del documento). Si alguno cambia más de 5 UIT de ese año, el plazo es el último día hábil del mes siguiente y fuera de él se propone la 176.1. Al reabrir se conserva lo guardado (el padrón ya tiene lo nuevo).
  - **J16:** tabla `prorrogas_dj`. General (sin persona, por ordenanza: nace aprobada, la registra un supervisor) o individual (SOLICITADA → APROBADA o RECHAZADA por un supervisor distinto de quien la registró). Lleva año y motivo (vacío = todos los motivos con plazo) y la nueva fecha límite; mueve el vencimiento de J08 si el plazo original cae en ese año. Se anula con motivo (no se borra). La regla `dj.prorrogaPresentacion` en falso impide registrar nuevas. Pantalla Registro Tributario → DJ presentadas → Prórrogas.
  - **Cuenta del transferente:** al liquidar una adquisición, al transferente enlazado que deja de ser titular y tiene determinaciones o arbitrios del predio desde el año siguiente al hecho se le genera de oficio una DJ de descargo (VENTA, PENDIENTE, con el comprador como adquiriente y enlace `generadaDesdeId`). Sigue el camino normal: determinar, revisión J14 si baja (la aprueba otro supervisor), L09 y L10. No propone multa. Anular la compra anula la de oficio si aún no se liquidó (si se liquidó, la compra ya no se anula: hay una DJ posterior sobre el predio).
  - **J09 (objeción):** sub-motivo de sistema `AN_OBJECION` de la DJ anual. Solo hasta el vencimiento del pago al contado del año (último día hábil de febrero) y si el año se liquidó con la actualización masiva; sus anexos rigen desde ese año. Queda registrada como objeción en la ficha y en la HR; si baja la obligación pasa igual por la revisión J14.
  - Elegido por ser lo conservador: el incremento, el factor y los valores de obras no tienen valor nacional en el seed (cambian con cada RM); la de oficio no se liquida sola ni se salta la revisión; la objeción no se salta la revisión J14 aunque sea anterior al plazo.
  - De paso: un descargo lo puede presentar quien es **o fue** titular (antes, tras la compra de otro, el vendedor quedaba en baja y su propio descargo se rechazaba).
  - Como todo parámetro del año, V03 y V05 no se editan en un año que ya tiene deuda: rigen desde el año que se abra con ellos.
  - Pendiente: confirmar con la RM vigente la clasificación con que se deprecian las obras (hoy, la del primer nivel).
- Cada fase va en su propia rama `feat/rentas-v2-<fase>` desde `main` (ya con multi-muni) y con su PR. En cada una: `lint` + `build` + `test`.

## 5. Verificación
- Comandos: `cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` · `npx prisma validate`.
- **Tests mínimos:**
  - P01/P03: inhabilitar con deuda → 409; el descargo del último predio inhabilita solo si no hay deuda.
  - P08/P17: sin documento queda PENDIENTE; 00000000 se rechaza.
  - J10: una compra en el año N afecta desde N+1.
  - J15: una DJ con 3 años genera 3 determinaciones e incluye los predios no declarados.
  - J14/J17: una DJ a la baja queda EN_REVISION y no genera cuenta; quien la registró no puede aprobarla; vencidos los 45 días hábiles ya no se puede rechazar.
  - L09: no se baja una deuda que ya tiene valor emitido.
  - L10: reliquidación con una cuota pagada en parte y con exceso pagado.
  - L06: la última cuota absorbe el redondeo.
- **Prueba manual:**
  1. Crear la persona y su dirección.
  2. Crear 2 predios, uno en condominio al 50%.
  3. Registrar una DJ con 2 anexos.
  4. Determinar (2 años), liquidar y revisar el estado de cuenta.
  5. Rectificar a la baja: la DJ debe quedar en revisión.
  6. Repetir en `demo.localhost` y verificar que no se cruzan datos.
