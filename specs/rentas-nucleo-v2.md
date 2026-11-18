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
- [ ] Fase 4: DJ presentada + anexos (C5), sin liquidar.
- [ ] Fase 5: determinar + liquidar (C6, C7), y adaptar estado de cuenta, fiscalización y valores.
- [ ] Fase 6: determinación anual masiva (J09) con simular/ejecutar.
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
