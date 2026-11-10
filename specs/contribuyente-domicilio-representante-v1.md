# Spec: Contribuyente — domicilio fiscal + representante legal (v1)

## 1. Historia y criterios
- Como FUNCIONARIO DE RENTAS, quiero registrar el domicilio fiscal completo y los datos de cónyuge y representante legal del contribuyente para que las notificaciones, recibos y estado de cuenta salgan con la dirección y el firmante correctos.
- [ ] Criterio 1 (API): `POST /contribuyentes` y `PATCH /contribuyentes/:id` aceptan `ubigeo`, `zonaId`, `urbanizacionId`, `viaId`, `numero`, `interior`, `manzana`, `lote`, `referencia`, `telefonoOficina`, `conyuge*`, `representante*`.
- [ ] Criterio 2 (obligatoriedad, igual que SIMUN): solo `ubigeo` es obligatorio en el alta (`"Obligatorio: Falta Ingresar el Codigo Postal"`); cónyuge y representante legal **no** son obligatorios (SIMUN solo valida CP, tipo persona y nombre al grabar).
- [ ] Criterio 3 (dirección derivada): `direccionFiscal` se recalcula en el backend con vía + N° + Dpto + Mz + Lt + urbanización + distrito (máx. 150). No se envía desde el formulario; sin ningún tramo de dirección no se toca la que ya había.
- [ ] Criterio 4 (catálogos): `GET /contribuyentes/ubigeos?q=` devuelve código o nombre de distrito; `zonaId`/`urbanizacionId`/`viaId` se eligen desde `GET /predios/catalogos`. Un id inexistente responde 400, no 500.
- [ ] Criterio 5 (errores: 401 = credenciales, resto = conexión): el formulario muestra el mensaje del backend y no navega.

## 2. Archivos afectados
- Frontend: `frontend/src/pages/rentas/contribuyentes/ContribuyenteForm.tsx`, `tipos.ts`, `FichaContribuyente.tsx`.
- Backend: `backend/src/contribuyentes/{dto/contribuyente.dto.ts, contribuyentes.service.ts, contribuyentes.controller.ts}`, `backend/prisma/schema.prisma`, migración `20261110120000_contribuyente_domicilio_representante`.

## 3. Diseño (máx 10 líneas)
Flujo: `Usuario -> Form -> GET /contribuyentes/ubigeos + /predios/catalogos -> POST/PATCH -> Prisma -> DB`.
- Nueva tabla `ubigeos` (1872 distritos, seed de SIMUN `DISTRITO.DBF`, solo lectura). **Sin FK** desde `contribuyentes.ubigeo`: una fila heredada sin catalogar rompería la migración.
- Ubigeo por defecto `150129` (LIMA/LIMA/SAN BARTOLO) en tres capas: `VACIO.ubigeo`, `data.ubigeo || '150129'` y `@default("150129")`.
- `direccionFiscal` pasa a ser columna derivada (consumida en ~20 puntos: recibos, OP/RD, estado de cuenta, búsqueda, CSV).
- NO se hace: FK a `ubigeos`, edición manual de `direccionFiscal`, alta masiva, `telefonoOficina`/`FAXCLI` (el usuario pidió solo cónyuge).

## 4. Tareas
- [x] Rama `feat/contribuyente-domicilio-representante` desde `main`. Implementar. `lint` + `build`/`test`.
- [x] Migración aditiva + `prisma migrate deploy`.
- [x] Ficha 360 muestra domicilio, cónyuge y representante.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` · login `admin/admin123` (`:5173` + `:3000`).
