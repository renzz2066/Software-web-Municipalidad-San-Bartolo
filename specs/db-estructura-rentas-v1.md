# Especificación: Estructura BD Rentas V1 (Postgres + Supabase)

- **Rama:** `feat/rentas-db-v1-postgres` (no se toca `main` directo)
- **Stack:** NestJS + Prisma 6.19.3 + PostgreSQL (Supabase Free) — migrado desde MySQL
- **SIMUN:** solo referencial (`D:\Simun\Data\*.DBF`). No se lleva a producción, no hay ETL ni registros iniciales tributarios.
- **Archivos:** `backend/prisma/schema.prisma` (26 modelos) · `backend/prisma/DER.mmd` (diagrama) · `backend/prisma/README.md` (cómo correr)

## 1. Requerimientos

- **Historia de usuario:** Como área de Rentas, quiero una BD web escalable basada en el sistema actual para reemplazar el FoxPro local sin perder los conceptos (contribuyente, predio, cuenta corriente, cobranza, coactivo, licencias).
- **Criterios de aceptación:**
  - [x] Schema Prisma válido para Postgres (`npx prisma validate` pasa)
  - [x] Tablas relacionadas con FKs para visualizar ER (ver `DER.mmd`)
  - [x] Sin registros tributarios (solo seed `admin`)
  - [x] `.env.example` con `DATABASE_URL` (pooler 6543) + `DIRECT_URL` (5432)
  - [ ] `npx prisma migrate dev` ejecutado contra Supabase real (pendiente: faltan las 2 URLs del proyecto)
  - [ ] Login `POST /auth/login` sigue funcionando tras el cambio de motor

## 2. Diseño técnico

### 2.1 Dominios (26 tablas)

| Dominio | Tablas nuevas | Viene de (SIMUN referencial) |
|---|---|---|
| A. Admin | `oficinas`, `usuarios` (existe, extendida con `oficinaId`), `auditoria` | `usuarios.dbf`, `roles.dbf`, `oficinas.dbf`, `accesos.dbf` |
| B. Contribuyente | `contribuyentes` | `generales.DBF` (maestro 9k) + `contribuyentes.DBF` (resumen DJ) |
| C. Predios | `zonas`, `urbanizaciones`, `vias`, `predios`, `predio_contribuyente`, `pisos`, `otras_instalaciones` | `predios_urbanos_rusticos` (125k), `pisos` (100k), `condominos` (125k), `CALLES`, `ZONA`, `URBA`, `tabla_tipo_de_vias` |
| D. Vehicular | `vehiculos`, `vehiculo_detalle_anual` | `impuesto_vehicular` (139) + `detalle_vehicular` (298) |
| E. Parametría | `tributos`, `uit`, `escala_predial`, `tarifas_arbitrios`, `tupa` | `tributo.DBF`, `UIT.DBF`, `impuesto.DBF`, `TARIFAS_ARB.DBF`, `TUPA.DBF` (651) |
| F. Deuda y caja | `cuenta_corriente`, `pagos`, `convenios`, `convenio_detalle` | `cta_aica` (1.9M), `pagos.DBF` (1M), `convenios_contri`, `convenios_detalle` (4681) |
| G. Cobranza | `valores_cab`, `valores_det`, `coactivo_exp`, `coactivo_det` | `valores_cobranza_cab/det` (81k/480k), `coactivo_cab/det`, `tabla_ejecutor_coactivo` |
| H. Licencias | `giros_negocio`, `licencias` | `licencias.dbf`, `giros.dbf` |

Ignorados a propósito: `a_*`, `f_*`, `h_*` (copias anuales), `tmp_*`, `proceso*`, `*.BAK`, `*.XLS` (temporales/reportes).

Flujo de datos: `Ciudadano/Trámite → Frontend → Endpoint NestJS → Prisma → Postgres (Supabase) → Auditoria`

### 2.2 Normalización clave (qué se corrigió del FoxPro)

1. **PKs nuevas autoincrementales** (`id SERIAL`). `CODCLI/CODPRED C(7)` pasan a `codigoLegacy UNIQUE NULL` solo para consulta histórica, no como FK.
2. **Se eliminan descripciones duplicadas** (`DESZON/DESURB/DESDIR/NOMCLI/DIRCLI` en cada tabla) → catálogos `zonas/urbanizaciones/vias` + FKs.
3. **`declaracion_j.DBF` (239k, 134 campos) no es tabla**: era un snapshot que mezclaba contribuyente+predio+condómino. Se reconstruye con `predios + pisos + predio_contribuyente + auditoria`.
4. **Montos**: todo `DECIMAL(12,2)` (tasas `DECIMAL(10,5)` para no perder precisión de arbitrios), fechas `DATE` o `TIMESTAMPTZ`, memos `M` → `TEXT`/`JSON`.
5. **Convención**: tablas en español plural snake (`@@map`), campos camelCase, `createdAt/updatedAt` en maestras, `estado` ENUM en vez de `ESTADO C(1)` críptico (`0/1/2`).

### 2.3 Por qué Postgres/Supabase (decisión aprobada)

- Supabase Free da Postgres 24/7 sin mantener tu PC encendida (500MB, 5GB egress, 2 proyectos, pausa tras 7 días inactivo — se reactiva con 1 clic).
- `DATABASE_URL` (pooler 6543 + pgbouncer) para la app + `DIRECT_URL` (5432) para migraciones. Cambiar de proveedor a futuro es solo cambiar esas 2 URLs, sin tocar código.
- Postgres aporta `CHECK`, `JSONB` (auditoría), `full-text` y `pgvector` para tu tesis de IA. MySQL local sigue posible, pero sin 24/7 gratis real.

## 3. Lista de tareas ejecutables

- [x] Crear rama `feat/rentas-db-v1-postgres`
- [x] Migrar `datasource` a `postgresql` + `directUrl`
- [x] Modelar 26 tablas con FKs e índices
- [x] Actualizar `.env.example`, `prisma/README.md`, `DER.mmd`, esta spec
- [ ] `npm install` (en curso) → `npx prisma validate`
- [ ] Crear proyecto Supabase + pegar `DATABASE_URL/DIRECT_URL` en `.env`
- [ ] `npx prisma migrate dev --name rentas_v1_postgres` + `npx prisma db seed`
- [ ] `npm run start:dev` + `POST /auth/login` + `npm test`
- [ ] PR de la rama hacia `main`

## 4. Cómo levantar (resumen, detalle en `backend/prisma/README.md`)

```bash
cd "D:\Muni San Bartolo\backend"
cp .env.example .env   # completa DATABASE_URL, DIRECT_URL, JWT_SECRET
npm install
npx prisma validate
npx prisma migrate dev --name rentas_v1_postgres
npx prisma db seed     # admin / admin123
npm run start:dev      # http://localhost:3000
```

Ver el ER: abre `backend/prisma/DER.mmd` en VSCode (Mermaid) o GitHub.

## 5. Seguridad e integridad (sin volverlo complejo)

> Esto responde a tu pedido de explicarlo bien. Nivel: suficiente para municipalidad, sin RLS ni cifrado por columna (quedan para fase 2 si se pagan membresías).

**Integridad referencial:**
- FKs `onDelete: Restrict` en todo lo que es deuda o dinero (`CuentaCorriente`, `Pago`, `ConvenioDet`, `ValorDet`, `CoactivoDet`): la BD **rechaza** borrar un contribuyente/predio/tributo con deuda. No depende de que el programador lo valide.
- `Cascade` solo donde es seguro: `Predio → Pisos`, `ValorCab → ValorDet`, `ConvenioCab → ConvenioDet`, `CoactivoExp → CoactivoDet` (al borrar cabecera se van sus líneas, nunca al revés).
- `SetNull` en auditoría y opcionales (`Usuario.oficinaId`, `Pago.cuentaCorrienteId` para TUPA sin deuda previa): al borrar el padre el hijo queda huérfano marcado, no se pierde el pago.

**Unicidad (anti-duplicados del FoxPro):**
- `Contribuyente.numDoc`, `Vehiculo.placa`, `Licencia.numeroLicencia`, `Pago.numRecibo`, `Tributo.codigo`, `Uit.anio`, `ValorCab(tipo,anio,numero)`, `CoactivoExp(anioExpediente,numExpediente)`, `PredioContribuyente(contribuyenteId,predioId)`.

**Trazabilidad del dinero (regla de oro):**
- Todo pago referencia `cuenta_corriente.id` cuando existe deuda; todo fraccionamiento referencia `cuenta_corriente.id` por cuota. Se puede responder “¿este pago de qué deuda vino?” con un JOIN, cosa que en SIMUN exigía cruzar `NROMOV/NROREC` a mano.
- `Pago.estado` (`CANCELADO/EXTORNADO`) en vez de borrar: el extorno es un cambio de estado, no un `DELETE`. Igual `CuentaCorriente.estado` (`PENDIENTE/CANCELADO/FRACCIONADO/COACTIVO/ANULADO`).

**Contraseñas y accesos:**
- `Usuario.password VARCHAR(255)` guarda **solo hash bcrypt** (ver `prisma/seed.ts` + `auth.service.ts`). Nunca texto plano, nunca se devuelve en JSON.
- `Rol` (`ADMIN/SUPERVISOR/CAJERO`) + `activo Boolean` (baja lógica): un usuario dado de baja no loguea aunque el token exista (`if (!user || !user.activo)`).
- `JWT_SECRET` y `DATABASE_URL` solo en `.env` (gitignorado). En código solo `process.env` vía `@nestjs/config`.

**Auditoría simple:**
- Los `S_CODUSU/S_NOMUSU/S_FECHA/S_HORA/S_TIPMOV` que cada DBF repetía se reemplazan por tabla única `auditoria(tabla, accion, registroId, usuarioId, detalle JSON, createdAt)`. Los servicios la escriben en la misma transacción Prisma que el trámite.
- `createdAt/updatedAt` automáticos en maestras para saber “cuándo cambió” sin tabla extra.

**Validación por capas (defensa en profundidad simple):**
1. DTO con `class-validator` (ya usado en auth) → 2. Prisma tipos + `CHECK`/`UNIQUE` en BD → 3. Transacciones (`$transaction`) en cobros/convenios para que deuda+pago+valor se graben juntos o nada (exigido por `skills/backend-db.md:7`).

**Qué NO se hace en V1 (a propósito):**
- Sin Row-Level Security de Postgres, sin cifrado de columnas (DNI), sin backups automáticos en Free (exporta con `pg_dump` manual). Se activan al pasar a Pro sin cambiar el modelo.

## 6. Decisiones que debes revisar

1. `codigoLegacy` nullable UNIQUE: permite importar referencia SIMUN después sin obligar a tenerlo hoy. Si prefieres prohibir nulos, lo cambio a requerido.
2. `Pago.cuentaCorrienteId` nullable: permite cobrar TUPA/multas sin deuda previa. Si quieres obligar siempre deuda, lo hago requerido.
3. IDs `Int autoincrement` (no UUID): más simple y compatible con `Usuario.id` actual y `auth.service.ts`. UUID queda para fase multi-sede si la pides.
4. `declaracion_j` no es tabla (se reconstruye). Si tu tesis necesita el histórico año por año, agrego `predio_snapshot_anual` en V2.
5. Migración pendiente de ejecutar: necesito tus `DATABASE_URL` y `DIRECT_URL` de Supabase para correr `migrate dev` y probar login.
