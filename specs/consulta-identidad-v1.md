# Spec: Contribuyente — consulta de identidad para autocompletar (v1)

## 1. Historia y criterios
- Como FUNCIONARIO DE RENTAS, quiero escribir el DNI o el RUC y que el formulario se complete solo, para no transcribir mal el nombre del contribuyente.
- [x] Criterio 1 (endpoint): `GET /contribuyentes/identidad?tipoDoc=&numDoc=&excluirId=` responde **antes** de `@Get(':id')` (misma trampa que `ubigeos`) y pide el nivel `rentas.registro-tributario`.
- [x] Criterio 2 (orden de fuentes): 1) nuestra BD —gratis y evita el 409 del alta—, 2) caché local de 30 días, 3) API externa.
- [x] Criterio 3 (caché solo de aciertos): `document_not_found` **no** se guarda, para no bloquear 30 días un DNI recién emitido. La poda es perezosa en cada escritura, sin cron.
- [x] Criterio 4 (degradación): sin `IDENTIDAD_API_KEY` → 503 con mensaje para el funcionario (el detalle técnico va al log) y el alta sigue funcionando a mano; `quota_exceeded` → 429; `upstream_unavailable`/timeout → 503; `document_not_found` → 404.
- [x] Criterio 5 (solo rellena vacíos): el formulario nunca pisa un campo que el funcionario ya escribió. Si ya hay nombre, no se cambia nada (ni siquiera `tipoPersona`). Para el ubigeo, que nace en `UBIGEO_DEFECTO` (`150129`), "vacío" significa "sigue en el default": solo en ese caso se rellena y se recalcula departamento/provincia/distrito.
- [x] Criterio 6 (sin API para CE/PASAPORTE): el botón "Buscar datos" no aparece; si llega igual, el servicio responde 400.
- [x] Criterio 7 (errores visibles): el aviso muestra el mensaje del backend (400/401/403/429/502/503) y solo si no viene ninguno, uno genérico.
- [x] Criterio 8 (ubigeo del RUC): se toma de `ubigeo_sunat` (6 dígitos, **no** del array `ubigeo`) y solo se entrega si existe en el catálogo local `ubigeos`; si no, se descarta (`null`) y el formulario no toca el campo.

## 2. Archivos afectados
- Frontend: `frontend/src/pages/rentas/contribuyentes/ContribuyenteForm.tsx`, `tipos.ts`.
- Backend: `backend/src/contribuyentes/identidad/{identidad.provider.ts, identidad.service.ts}` (+ `*.spec.ts`), `documento.ts`, `dto/contribuyente.dto.ts`, `contribuyentes.controller.ts`, `contribuyentes.module.ts`.
- Config: `backend/prisma/schema.prisma`, migración `20261110130000_consulta_identidad`, `backend/.env.example`.

## 3. Diseño (máx 10 líneas)
Flujo: `Botón "Buscar datos" → GET /contribuyentes/identidad → IdentidadService → [propia | caché | API] → rellena vacíos`.
- Proveedor: **ApiPeruDev** plan gratuito (`IDENTIDAD_API_BASE`, `IDENTIDAD_API_KEY`, `IDENTIDAD_TIMEOUT_MS`). DNI → solo nombre; RUC → razón social + estado + condición + `direccion_completa` como texto + `ubigeo_sunat`.
- El `code` del proveedor (`found`, `document_not_found`, `quota_exceeded`, `upstream_unavailable`, `invalid_input`) se traduce a un motivo propio y de ahí al HTTP; nunca se decide por el texto del `message`.
- La dirección externa **no** se fuerza en `viaId/zonaId/urbanizacionId` (los catálogos casi están vacíos): se muestra como aviso para completar a mano. El ubigeo **sí** se rellena, pero solo si está en el catálogo local y el campo sigue en el default.
- `tipoPersona` la decide el backend: RUC que empieza en 20 → `JURIDICA`, el resto → `NATURAL`. El proveedor no la devuelve.
- Tabla `consultas_identidad`, PK compuesta `(tipoDoc, numDoc)`, TTL 30 días. Datos personales retenidos solo ese tiempo (función pública, Art. 26 Ley 29733).
- NO se hace: ETL de SIMUN (sigue prohibido por `db-estructura-rentas-v1.md`), teléfono/celular/correo/cónyuge desde API, consulta automática al escribir, caché de "no encontrado".

## 4. Tareas
- [x] Rama `feat/consulta-identidad` desde `feat/contribuyente-domicilio-representante`. Implementar. `lint` + `build`/`test`.
- [x] Migración aditiva + `prisma migrate deploy`.
- [x] Botón, estados y aviso de procedencia en el formulario.
- [x] Incremento (misma rama): ubigeo del RUC validado contra `ubigeos`, `direccion_completa` y mensaje legible del 503. Sin migración: el ubigeo vive dentro del JSONB `datos`.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test && npm run build` · `npx prisma validate` · `npx prisma migrate status` · login `admin/admin123` (`:5173` + `:3000`).
