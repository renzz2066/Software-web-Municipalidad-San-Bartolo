# Spec: Esqueleto de módulos SIMUN (v1)
<!-- Formato fijo 5 secciones. Las `*-v1.md` cerradas no se editan. -->

## 1. Historia y criterios
- Como ADMIN, quiero ver y asignar por rol todos los módulos y submódulos del sistema
  original (SIMUN) para preparar los accesos antes de implementar sus funciones.
- [ ] Criterio 1: `/accesibilidad/niveles` lista los 7 módulos nuevos con sus submódulos
  (árbol de la sección 3), autoregistrados desde `NIVELES_CATALOGO`.
- [ ] Criterio 2: en Accesos por Rol se pueden marcar/desmarcar estos niveles.
- [ ] Criterio 3: el Dashboard muestra una tarjeta por módulo que el usuario tenga asignado;
  cada submódulo abre un placeholder "En construcción". Sin nivel → acceso denegado
  (`RequireNivel`), igual que Accesibilidad.
- [ ] Criterio 4: sin tablas, endpoints ni lógica de negocio nuevas.

## 2. Archivos afectados
- Backend: `backend/src/niveles/niveles.catalogo.ts` (solo nodos nuevos).
- Frontend: `frontend/src/App.tsx` (rutas), `frontend/src/pages/Dashboard.tsx` (tarjetas),
  `frontend/src/pages/modulos/*` (hub por módulo), `ModuloPlaceholder.tsx` (prop `volverA`).
- Fuera: `backend/.env.example` y migración MySQL `20260912042721_init` (no se commitean).

## 3. Diseño (máx 10 líneas)
Flujo: `NIVELES_CATALOGO -> sync al iniciar Nest -> niveles -> RolNivel -> RequireNivel`.
Fuente: `a_fondo.SCT` (8 botones) y `Programas/MENU_*.MPR` de SIMUN. Rentas usa los grupos
del menú (PAD) como submódulos; el resto, sus opciones. Seguridad = `accesibilidad` (ya existe).
Se omiten opciones genéricas: Menú principal, Salir, Cerrar sesión, Cambiar contraseña,
Ayuda, Calculadora, Agenda, Configurar impresora. Hub de módulo genérico (lista hijos del
catálogo) para no crear 7 páginas casi iguales. No se hace: datos, CRUD, reportes.

Árbol (`codigo` → nombre):
- `rentas` Rentas (MENU01): `.registro-tributario` Registro Tributario · `.control-recaudacion`
  Control y Recaudación · `.fiscalizacion` Fiscalización Tributaria · `.maestros` Maestros ·
  `.descargos` Descargos
- `licencias` Licencia de Funcionamiento (MENU_LICE): `.registro` Registro de Licencias/DDJJ
- `coactivo` Cobranza Coactiva (MENU_COA): `.recepcion` Recepción y Transferencias ·
  `.asignar-valores` · `.calificar-valores` · `.expedientes` Gestión de Expedientes ·
  `.consultas` · `.desafectacion` Desafectación de Valores · `.estado-cuenta` Estado de Cuenta
  Corriente · `.maestros` Maestros · `.configuracion` Unidad Responsable
- `caja` Caja (MENU_CAJA): `.cancelaciones` Cancelaciones del Día · `.extornos` Extorno ·
  `.reportes` Reportes
- `multas` Multas Administrativas: `.registro` Registro de Multas (origen: MENU_LICE)
- `tablero` Tablero Gerencial: `.resumen` Resumen (SIMUN no lo implementó)
- `utilitarios` Utilitarios: `.calculadora` Calculadora (SIMUN no lo implementó)

Decisiones a revisar: (1) "Registro de Multas" pasa de Licencias a Multas. (2) Tablero y
Utilitarios no tienen menú en SIMUN; sus submódulos son provisionales.

## 4. Tareas
- [x] Rama `feat/modulos-esqueleto` desde `main`.
- [ ] Nodos en `NIVELES_CATALOGO` (orden según botones de SIMUN).
- [ ] `ModuloPlaceholder` con `volverA`; hub genérico de módulo; rutas con `RequireNivel`.
- [ ] Tarjetas del Dashboard filtradas por nivel. `lint` + `build`.

## 5. Verificación
`cd frontend && npm run lint && npm run build` · `cd backend && npm run lint && npm run test` ·
login `admin/admin123`: ver árbol en Niveles, quitar `caja` a un rol y comprobar acceso denegado.
