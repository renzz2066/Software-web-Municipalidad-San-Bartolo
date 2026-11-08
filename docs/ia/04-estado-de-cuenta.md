# Estado de cuenta

Consulta de la deuda de un contribuyente a una fecha. Se ve en la ficha del contribuyente (Registro Tributario), en Caja al cobrar y en Utilitarios › Buscador Universal.

## Cómo consultar el estado de cuenta
1. Busca al contribuyente en **Rentas › Registro Tributario** y abre su ficha.
2. Entra a la pestaña **Deuda**: se muestra la deuda al día de hoy.
3. Para imprimir o guardar en PDF usa **Versión imprimible** (se imprime desde el navegador).
4. El cajero ve el mismo estado de cuenta en **Caja › Cancelaciones del Día** al elegir al contribuyente.

## Qué significa cada columna
- **Importe / Insoluto**: lo adeudado original, sin reajuste ni mora.
- **Reajuste**: ajuste por IPM desde el vencimiento; aplica a predial, cuotas 2 a 4.
- **Mora**: interés moratorio con la TIM, calculado día a día hasta la fecha de consulta. No se calcula sobre el derecho de emisión.
- **Total**: insoluto + reajuste + mora (+ derecho de emisión en la cuota 1).
- **Situación**: si la cuota está en un valor (OP/RD N.°), en un convenio (N.°) o en coactivo.
La mora y el reajuste se calculan al momento; por eso el total cambia según la fecha.

## Estados de una cuota
- **PENDIENTE**: aún sin pagar.
- **CANCELADO**: pagada.
- **FRACCIONADO**: cubierta por un convenio; no se suma en la deuda porque la reemplazan las cuotas del convenio (tributo FRACCION).
- **COACTIVO**: transferida a cobranza coactiva; igual se puede cobrar en Caja.

## Por qué cambia el total de un día a otro
- La mora (TIM) corre cada día desde el vencimiento.
- Por eso el cajero debe cobrar con la deuda consultada el mismo día; si cambia, el sistema avisa "la deuda cambió, vuelve a consultar".

## Cómo calcular una mora sin buscar al contribuyente
- Usa **Utilitarios › Calculadora › Mora/reajuste**: ingresa importe, fecha de vencimiento y fecha de pago y obtendrás insoluto, reajuste, mora, total y días de atraso.
