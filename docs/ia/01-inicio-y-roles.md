# Inicio, roles y accesos

Guía para ingresar al sistema de Rentas de la Municipalidad Distrital de San Bartolo y entender qué puede hacer cada usuario.

## Cómo ingresar al sistema
1. Abre el sistema en el navegador y escribe tu **usuario** y **contraseña**.
2. Si los datos son incorrectos, el sistema muestra "credenciales inválidas": revisa mayúsculas y vuelve a intentar.
3. Si aparece un error de conexión, el problema no es tu contraseña: revisa la red o avisa a soporte.
4. Al ingresar llegas al **Inicio (Dashboard)**, que muestra una tarjeta por cada módulo al que tienes acceso.
5. Para salir usa **Cerrar sesión** en la barra superior. Cada ingreso y cada intento fallido queda registrado en Auditoría.

## Roles del sistema
- **ADMIN**: acceso total. Administra usuarios, roles y accesos.
- **SUPERVISOR**: consulta y aprobación; trabaja en Rentas (registro, cálculo, valores, fiscalización) y revisa reportes.
- **CAJERO**: ventanilla. Cobra cuotas, entrega recibos, extorna sus recibos del día y cierra su caja.
El rol no decide todo: lo que ve cada usuario depende de los **niveles de acceso** asignados a su rol.

## Niveles de acceso
- Cada módulo (Rentas, Caja, Cobranza Coactiva, Utilitarios, Tablero Gerencial, etc.) y cada submódulo es un **nivel**.
- Si tu rol no tiene un nivel, no verás la tarjeta ni el menú, y si entras por la dirección el sistema te devuelve al inicio.
- El catálogo de niveles se ve en **Accesibilidad › Niveles**. Los niveles los registra el sistema, no se crean a mano.
- El botón flotante del **Chat IA** solo aparece si tu rol tiene el nivel **Ayuda › Chat IA** (`ayuda.chat`).

## Cómo dar o quitar accesos a un rol (ADMIN)
1. Entra a **Accesibilidad › Accesos por Roles**.
2. Elige el rol y marca o desmarca los módulos y submódulos.
3. Presiona **Grabar**.
4. Importante: los accesos se aplican **cuando el usuario vuelve a ingresar**. Pídele que cierre sesión y entre de nuevo.

## Cómo crear o modificar un usuario (ADMIN)
1. Entra a **Accesibilidad › Gestión de Usuarios** y presiona **Nuevo usuario**.
2. Completa nombres, apellidos, usuario, contraseña (y su verificación), rol y estado, y presiona **Crear**.
3. Para cambiar datos usa **Modificar** en la fila del usuario.
4. Un usuario **Inactivo** no puede ingresar aunque tenga una sesión abierta.

## Cómo crear un rol (ADMIN)
1. Entra a **Accesibilidad › Roles** y crea el rol nuevo.
2. Luego asígnale niveles en **Accesos por Roles** (ver sección anterior).

## Navegación general
- La barra lateral lista los módulos a los que tienes acceso; en celular se abre como cajón.
- Cada pantalla interna tiene arriba a la izquierda el enlace **"Volver a …"** para regresar a la pantalla anterior.
- Las pantallas imprimibles (recibos, valores, estado de cuenta) se imprimen o guardan en PDF desde el navegador.
