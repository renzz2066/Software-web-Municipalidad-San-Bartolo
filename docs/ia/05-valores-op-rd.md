# Valores: Orden de Pago (OP) y Resolución de Determinación (RD)

Emisión, notificación y anulación de valores. Se trabaja en **Rentas › Control y Recaudación** (nivel `rentas.control-recaudacion`), pestaña **Emisión de valores**, o desde la pestaña **Valores** de la ficha del contribuyente.

## Qué es una OP y qué es una RD
- **OP (Orden de Pago)**: para impuesto predial (Código Tributario art. 78). Se agrupa por contribuyente y año.
- **RD (Resolución de Determinación)**: para arbitrios (art. 76). Se agrupa por contribuyente, predio y año.
- **RM (Resolución de Multa)**: nace de una infracción (ver guía de fiscalización).
- Numeración correlativa por tipo y año, por ejemplo `OP 2026-000123`.

## Cómo emitir una OP o RD (masivo)
1. Entra a **Rentas › Control y Recaudación** › **Emisión de valores**.
2. Elige **Año fiscal**, tipo (**OP (predial) y RD (arbitrios)**, **Solo OP** o **Solo RD**), marca **Solo cuotas vencidas** y, si quieres, monto mínimo y **Zona**.
3. Presiona **Simular**: verás contribuyentes, valores y montos sin grabar nada.
4. Revisa y presiona **Emitir valores**.
5. Para un solo contribuyente, hazlo desde la pestaña **Valores** de su ficha.

## Reglas al emitir
- Solo entran cuotas **PENDIENTE** vencidas que no estén ya en un valor vigente (EMITIDO o NOTIFICADO).
- Una cuota no puede estar en dos valores vigentes; re-emitir no duplica.
- Si el cálculo de ese contribuyente cambiaría sus cuotas, la emisión se bloquea con "recalcula primero": ejecuta el cálculo y vuelve a emitir.
- Los montos (insoluto, reajuste, interés a la fecha de emisión) quedan guardados en el valor; la pantalla también muestra la deuda actualizada a hoy.

## Cómo imprimir un valor
- Abre el valor desde la ficha o la lista y usa la vista imprimible; se imprime o guarda en PDF desde el navegador.
- Contiene deudor, domicilio fiscal, tributo, periodo y cuotas, base imponible, tasa, insoluto, reajuste, interés, total y base legal.

## Cómo registrar la notificación
1. Abre el valor y usa **Registrar notificación**.
2. Indica **Fecha de notificación**, **Modalidad** (PERSONAL, NEGATIVA, CEDULÓN o PUBLICACIÓN, art. 104), **DNI / CE** y nombre de quien recibe.
3. Presiona **Guardar notificación**. Mientras el valor siga vigente se puede corregir con **Corregir notificación**.

## Cuándo un valor es exigible
- **OP**: el día hábil siguiente a la notificación (art. 106).
- **RD**: el día hábil siguiente al vencimiento del plazo de reclamo de 20 días hábiles (art. 137).
- Días hábiles = lunes a viernes menos los feriados cargados en Maestros. El sistema calcula la fecha sola.

## Cómo anular un valor
1. Abre el valor, escribe el **Motivo** (obligatorio) y presiona **Anular valor**.
2. El valor queda **ANULADO** (no se borra) y sus cuotas quedan libres para otro valor.
3. No se puede anular un valor que ya está en **COACTIVO**.

## Estados de un valor
EMITIDO (creado, sin notificar) → NOTIFICADO (entregado, corre la exigibilidad) → CANCELADO (pagado completo en Caja) o COACTIVO (transferido) o ANULADO (con motivo).
