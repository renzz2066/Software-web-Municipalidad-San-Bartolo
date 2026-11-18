# Spec: Rentas — Personas, Direcciones, Predios y DJ al modelo Lurín (v2)
<!-- Formato fijo 5 secciones. BORRADOR 2026-11-17: no implementar hasta aprobarla. Reemplaza C1–C3 y C5 de `rentas-nucleo-v1.md`. -->

- **Reglas:** `docs/rentas/reglas-negocio.md`. Esta spec las cita por ID y no las repite.
- **Marco:** la ley nacional va en el código; lo que fija la ordenanza de cada muni es un dato en su base.
- **Mapa de tablas de Lurín:** solo en local, `docs/privado/` (está en gitignore porque el repo es público).

## 1. Historia y criterios
- Como SUPERVISOR/ADMIN de Rentas, quiero llevar personas, direcciones, predios y DJ con la estructura de Lurín para declarar, determinar y liquidar igual que ellos. Esa estructura es una **DJ por contribuyente y año, con un anexo por predio**.
- Como CAJERO, sigo consultando el estado de cuenta igual que hoy.
- [ ] C1 **Personas**: nombres y apellidos separados; varios documentos, contactos y relacionados; perfil, clasificación y estado (P01–P15).
- [ ] C2 Inhabilitar, dar de baja o cambiar el estado con deuda → `409` "mantiene una deuda de S/ X y no puede ser inhabilitado" (P01). Habilitar no tiene restricción (P02).
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
- **Datos de San Bartolo:** hoy son de prueba, porque no hay producción. La migración recrea las tablas y el seed, sin ETL desde v1.
- **No se hace:** descompilar el ejecutable de Lurín, copiar sus pantallas tal cual, alcabala, vehicular, licencias ni los intereses de Lurín (los nuestros se calculan al vuelo).

**Decisiones pendientes** (cada una con su propuesta):
1. Estados de la persona: HABILITADO / INHABILITADO / PENDIENTE. "Fiscalizado" sale del módulo de fiscalización.
2. L13: al liquidar, actualizar la ficha de la persona con la DJ, mostrando antes las diferencias.
3. P10: relacionados en línea, con enlace opcional a una persona ya registrada.
4. J14: estado EN_REVISION, que se aprueba o rechaza con justificación, con alerta al vencer los 45 días hábiles.
5. L07: determinar los arbitrios por mes y agruparlos en cuotas según `ReglaMuni`.
6. P08: permitir personas sin documento, con código correlativo y estado PENDIENTE.
7. Confirmar que los datos actuales de San Bartolo se pueden descartar.

## 4. Tareas
- [ ] Rama `docs/rentas-nucleo-v2`: esta spec y `docs/rentas/reglas-negocio.md`. Aprobarlas y cerrar las decisiones pendientes.
- [ ] Fase 0: catálogos + `ReglaMuni` + seed nacional. Pedir a Lurín el contenido de sus catálogos (solo catálogos, sin personas).
- [ ] Fase 1: Personas (C1, C2). No toca el cálculo.
- [ ] Fase 2: Direcciones únicas (C3) y migración del domicilio de las personas.
- [ ] Fase 3: Predio maestro (C4).
- [ ] Fase 4: DJ presentada + anexos (C5), sin liquidar.
- [ ] Fase 5: determinar + liquidar (C6, C7), y adaptar estado de cuenta, fiscalización y valores.
- [ ] Fase 6: determinación anual masiva (J09) con simular/ejecutar.
- Cada fase va en su propia rama `feat/rentas-v2-<fase>` desde `main` (ya con multi-muni) y con su PR. En cada una: `lint` + `build` + `test`.

## 5. Verificación
- Comandos: `cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` · `npx prisma validate`.
- **Tests mínimos:**
  - P01: inhabilitar con deuda → 409.
  - J10: una compra en el año N afecta desde N+1.
  - J15: una DJ con 3 años genera 3 determinaciones e incluye los predios no declarados.
  - J14: una rectificatoria a la baja no genera cuenta.
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
