# Auditoría, tablero gerencial y utilitarios

Monitoreo de cambios del sistema y herramientas de apoyo. Auditoría: **Tablero Gerencial › Auditoría** (nivel `tablero.auditoria`, solo ADMIN). Utilitarios: **Utilitarios** (niveles `utilitarios.*`).

## Qué registra la auditoría
- Toda creación, modificación y desactivación de registros (quién, cuándo, qué tabla, qué registro y el detalle del cambio).
- Los ingresos al sistema y los **intentos fallidos** de inicio de sesión.
- La registra la base de datos automáticamente; no se puede editar ni borrar.

## Cómo consultar la auditoría
1. Entra a **Tablero Gerencial › Auditoría**.
2. Filtra por **Usuario**, **Acción**, **Tabla**, **Desde** / **Hasta** e **ID de registro** y presiona **Buscar**. **Limpiar** quita los filtros.
3. Sin filtros, se muestran los últimos 7 días. Puedes elegir 20, 50 o 100 por página.
4. Haz clic en una fila para ver el detalle del cambio (antes y después). Esc cierra el detalle.
- "Intento: «…»" en rojo indica un ingreso fallido con ese nombre de usuario.
- "SISTEMA" indica un cambio hecho por un proceso del sistema, no por un usuario.

## Utilitarios: calculadora
En **Utilitarios › Calculadora**:
- **UIT**: convierte soles ↔ UIT y fracciones (1/12, 1/4, 1/2, 1, 2…) con la UIT vigente.
- **Mora/reajuste**: importe, vencimiento y fecha de pago → insoluto, reajuste, mora, total y días de atraso.
- **Documento**: verifica DNI y RUC (dígito verificador).
- **Efectivo**: desglose de billetes y monedas y cálculo del vuelto.

## Utilitarios: calendario tributario
- **Utilitarios › Calendario Tributario** muestra los feriados del año, responde **¿Es día hábil?**, cuenta **días hábiles entre fechas** y suma N días hábiles a una fecha. Usa los mismos feriados que los plazos de valores.

## Utilitarios: buscador universal
- **Utilitarios › Buscador Universal** busca por DNI/RUC, nombre o número de recibo y muestra en una pantalla la ficha, valores, recibos, expedientes, convenios y estado de cuenta del contribuyente.
- Si te falta el nivel de un módulo, esa sección dice **Sin acceso** y el resto sigue funcionando.

## Utilitarios: exportación de datos
- **Utilitarios › Exportación de Datos** descarga en CSV (abre en Excel) los listados existentes con sus columnas visibles. Incluye un **glosario** de términos.
- Ninguna herramienta de Utilitarios graba datos.
