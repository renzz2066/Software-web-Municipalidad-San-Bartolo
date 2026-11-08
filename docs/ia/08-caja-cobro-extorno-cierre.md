# Caja: cobro, recibo, extorno y cierre

Cobros en ventanilla. **Caja › Cancelaciones del Día** (nivel `caja.cancelaciones`), **Caja › Extorno** (nivel `caja.extornos`) y **Caja › Reportes** (nivel `caja.reportes`).

## Cómo cobrar en caja
1. Entra a **Caja › Cancelaciones del Día** y busca al contribuyente (DNI/RUC o nombre).
2. Se muestra su estado de cuenta a hoy. Marca las cuotas que va a pagar (PENDIENTE o en COACTIVO).
3. Presiona **Continuar al cobro**: verás insoluto, reajuste, mora, derecho de emisión y total.
4. Elige el **Medio de pago** y, si no es efectivo, escribe el número de operación.
5. Presiona **Confirmar cobro**. Se genera el recibo.
Para atender a otra persona usa **Cambiar contribuyente**; para corregir la selección, **Volver a la selección**.

## Medios de pago
- **EFECTIVO**: la pantalla calcula el vuelto (no se guarda). El cheque no está habilitado.
- **TARJETA**, **TRANSFERENCIA** (incluye Yape y Plin) y **DEPÓSITO**: el número de operación es obligatorio.
- Un solo medio de pago por recibo; no hay pagos mixtos.

## Reglas del cobro
- Solo cuotas completas; no hay pago parcial de una cuota.
- El contribuyente elige qué tributos paga; las cuotas de un convenio van en orden (inicial primero, nunca la k sin la k−1).
- El sistema vuelve a calcular el total al cobrar; si cambió, muestra "la deuda cambió, vuelve a consultar".
- Si otro cajero cobró la misma cuota un instante antes, el segundo cobro se rechaza.
- No hay cobros con fecha retroactiva. No se aplican descuentos ni amnistías en esta versión.

## El recibo de caja
- Número correlativo por año, por ejemplo `REC 2026-000001`, sin huecos ni duplicados.
- Un recibo agrupa todas las cuotas de un mismo cobro; muestra contribuyente, detalle por cuota, total en letras, medio de pago, cajero, fecha y hora.
- Se imprime desde el navegador (media hoja). Las reimpresiones salen marcadas **COPIA**.
- Tus recibos del día están en **Mis recibos de hoy**.

## Qué cambia al cobrar
- La cuota pasa a **CANCELADO**.
- Si se pagan todas las cuotas de una OP/RD, el valor queda **CANCELADO**.
- Si es la última cuota de un convenio, el convenio y sus deudas originales quedan **CANCELADO**.

## Cómo extornar un recibo
1. Abre el recibo (desde **Mis recibos de hoy** o desde **Caja › Extorno**, buscando por día o número).
2. Presiona **Extornar recibo**, escribe el **Motivo** (obligatorio) y confirma con **Extornar**.
3. El recibo queda **EXTORNADO** (nunca se borra) y cada cuota vuelve a su estado anterior (PENDIENTE o COACTIVO); el valor o convenio que se había cancelado vuelve a vigente.

## Quién puede extornar
- El cajero puede extornar **sus** recibos **del día** antes de cerrar su caja.
- Después del cierre, o recibos de otro cajero: solo quien tenga el nivel **Caja › Extorno**.
- Se extorna el recibo completo, no una cuota suelta.
- Una cuota de convenio no se extorna si una cuota posterior sigue pagada en otro recibo: extorna primero la posterior.
- El extorno cuenta en el día en que se hace; no reabre el cierre original.

## Cómo cerrar la caja al final del día
1. En **Cancelaciones del Día** presiona **Cerrar mi caja**.
2. Revisa el resumen: recibos, extornos y total por medio de pago y por tributo.
3. Opcional: escribe el efectivo contado (arqueo); el sistema indica si **cuadra**, hay **sobrante** o **faltante**.
4. Presiona **Cerrar caja** y luego **Confirmar cierre**.
5. Tras el cierre no puedes cobrar ni extornar en esa fecha; la pantalla de cobro lo avisa. El cierre queda como foto inmutable e imprimible (**Ver mi cierre**).
- No hay apertura de caja: el primer cobro abre el día. Si quedó un día anterior sin cerrar, el sistema avisa y también se puede cerrar.

## Reportes de caja (supervisor)
- **Caja › Reportes** › **Cierres del día**: cierres de cada cajero y quiénes tienen movimientos sin cerrar.
- **Recibos**: recibos de todos los cajeros por día de caja, cajero, contribuyente o número.
