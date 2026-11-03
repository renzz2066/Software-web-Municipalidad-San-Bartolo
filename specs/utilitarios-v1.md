# Spec: Utilitarios — herramientas de apoyo (v1)
<!-- Formato fijo 5 secciones. Las `*-v1.md` cerradas no se editan. -->

Base: `modulos-esqueleto-v1` (módulo `utilitarios` con submódulo `calculadora` **provisional**; SIMUN
lo traía como "Ayuda, Calculadora, Agenda, Configurar impresora" y nunca lo implementó).
El cálculo de mora/reajuste replica `rentas/estado-cuenta/liquidacion.ts` y los días hábiles
replican `rentas/valores/plazos.ts` (lógica pura ya testeada en backend).
Fuera de v1: multa DJ extemporánea, simulador de predial, generador de documentos, agenda de
vencimientos, ayuda/atajos, búsqueda por nº de valor o nº de expediente (no hay endpoint) y
**cualquier endpoint o migración nuevo**.

## 1. Historia y criterios
- Como ADMIN/SUPERVISOR/CAJERO, quiero tener en un solo módulo las herramientas de apoyo de
  ventanilla (cálculo, calendario, búsqueda y exportación), para resolver consultas sin navegar
  entre módulos ni salir del sistema.
- [x] U1 Calculadora UIT: convierte S/↔UIT y fracciones (1/12, 1/6, 1/4, 1/3, 1/2, 1, 2…) con la UIT
  vigente de `GET /rentas/maestros/resumen/:anio` y marca si supera un umbral.
- [x] U2 Mora/reajuste: importe + fecha de vencimiento + fecha de pago → insoluto, reajuste, mora,
  total y días de atraso; reproduce **todos** los vectores golden de `liquidacion.spec.ts`.
- [x] U3 Verificador de DNI/RUC (dígitos verificadores) y desglose de efectivo (billetes y monedas
  de S/100 a S/0.01, con cuadre de vuelto).
- [x] U4 Calendario: feriados de `GET /rentas/maestros/feriados/:anio`, ¿es día hábil?, días
  hábiles entre dos fechas y suma de N días hábiles; mismos resultados que `plazos.spec.ts`.
- [x] U5 Buscador: por DNI/RUC/nombre (`GET /contribuyentes?q=`) o nº de recibo
  (`GET /caja/recibos?numero=`); desde el contribuyente elegido muestra en una pantalla sus
  valores, recibos, expedientes, convenios y estado de cuenta (todos por `contribuyenteId`).
- [x] U6 Exportar: CSV descargado en el navegador (BOM UTF-8 + separador `;`) de los listados
  existentes, con las columnas visibles y cabecera legible.
- [ ] U7 Cero nivel de un módulo origen → esa sección pinta «Sin acceso» y el resto de la pantalla
  sigue funcionando. La regla 403 → «Sin acceso» está testeada (`utilitariosApi.test.ts`) y cada
  sección carga por separado; **falta el chequeo en vivo con un rol restringido**.
- [x] U8 **Sin escrituras**: ningún `POST/PUT/DELETE` nuevo, sin migraciones ni cambios de esquema.
- [x] U9 Errores de red con `mensajeError` (401 = credenciales, resto = conexión), igual que el resto.

## 2. Archivos afectados
- Frontend: `frontend/src/pages/utilitarios/**` (nuevo: `utilitariosApi.ts` + `utilitariosApi.test.ts`,
  `utilitariosUi.tsx`, `calculadora/{Calculadora,UIT,Mora,Documento,Efectivo}.tsx`,
  `calendario/Calendario.tsx`, `buscador/BuscadorUniversal.tsx`, `exportar/{Exportar,Glosario}.tsx`),
  `frontend/src/lib/{liquidacion,plazos,exportarCsv,validacion}.ts` (nuevo) con sus `*.test.ts`,
  `frontend/src/pages/modulos/catalogo.ts` (+3 submódulos), `frontend/src/App.tsx` (+4 entradas de
  `PAGINAS_SUBMODULO`; las rutas salen solas del catálogo), `frontend/package.json` (+`decimal.js`).
  **No** se toca `tsconfig.app.json` ni `Dashboard.tsx` (ya itera `MODULOS`).
- Backend: `backend/src/niveles/niveles.catalogo.ts` (+3 nodos bajo `utilitarios`). **Ni endpoints ni
  guards nuevos**; `prisma/schema.prisma` y `prisma/migrations/` intactos.

## 3. Diseño (máx 10 líneas)
Flujo: `Usuario -> Pantalla utilitarios -> GET ya existentes -> cálculo puro en frontend -> resultado`.
Los endpoints están tras niveles de otros módulos: cada sección hace su propia petición en un hook
independiente (`useSeccion`) y un 403 se pinta como «Sin acceso» solo en esa sección; por eso un rol
solo con Utilitarios ve las secciones a las que ya tiene derecho. La mora usa `decimal.js` (la misma
librería que `Prisma.Decimal`) para no divergir de Caja, con los vectores golden de
`liquidacion.spec.ts`; los días hábiles replican `plazos.ts` con sus vectores. **No** se agregan
endpoints: por eso el buscador es contribuyente-céntrico (valores, expedientes y convenios solo se
alcanzan por `contribuyenteId`). CSV generado en el navegador con `Blob` (sin librería de Excel).

## 4. Tareas
- [x] Rama `utilitarios` desde `main` (nunca rama de producción).
- [x] Spec + registro en `specs/_index.md`.
- [x] Niveles: `niveles.catalogo.ts` y `pages/modulos/catalogo.ts` (+3 cada uno) → `npx prisma db seed`.
- [x] Libs puras con tests golden: `liquidacion`, `plazos`, `validacion`, `exportarCsv`.
- [x] Pantallas en orden: Calculadora → Calendario → Buscador → Exportar.
- [x] Wiring en `App.tsx`; `lint` + `build` + `test` de frontend y backend.

## 5. Verificación
`cd backend && npm run lint && npm run test && npx prisma validate && npx prisma migrate status`
(sin migraciones nuevas) · `cd frontend && npm run lint && npm run test && npm run build`
(`tsc -b && vite build`) · `npx prisma db seed` → "Niveles sincronizados: 38" · smoke manual en
`:5173` con `admin/admin123`: tarjeta Utilitarios → los 4 submódulos abren, cada herramienta da el
mismo resultado esperado y las secciones sin nivel muestran «Sin acceso».

Hecho: backend `lint` 0 · **163/163** tests · `prisma validate` ok · `migrate status` 14/14 sin
migraciones nuevas · seed 38 niveles. Frontend `lint` 0 (solo los 3 avisos preexistentes) ·
**56/56** tests · `tsc -b && vite build` 0 errores. Vite transforma los 17 módulos nuevos sin error y
las 8 variantes de pantalla renderizan (`react-dom/server`). Los GET que usan las pantallas responden
200 con `admin` y sus formas coinciden con los tipos (`/contribuyentes/:id/{resumen,estado-cuenta}`,
`/rentas/valores`, `/caja/recibos`, `/rentas/fiscalizacion/expedientes`, `/rentas/convenios`,
`/rentas/maestros/{resumen,tasas-mora,feriados,infracciones,fiscalizadores}`).
Pendiente: **U7 en vivo** con un rol que no tenga el nivel del módulo origen, y el clic de descarga
del CSV en el navegador.
