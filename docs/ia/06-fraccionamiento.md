# Fraccionamiento (convenios)

Cómo fraccionar deuda en un cronograma de cuotas. Se hace desde la pestaña **Convenios** de la ficha del contribuyente (nivel `rentas.control-recaudacion`).

## Cómo crear un convenio de fraccionamiento
1. Busca al contribuyente y abre su ficha › pestaña **Convenios**.
2. Presiona **Nuevo convenio de fraccionamiento**.
3. Elige las deudas a fraccionar (al menos una), la cuota inicial y el **N.° de cuotas**.
4. Presiona **Simular cronograma** para ver las cuotas con su interés.
5. Si está conforme, presiona **Grabar convenio**. Solo se puede grabar después de simular.
6. Con **Ver e imprimir** obtienes el convenio y su cronograma para firma.

## Límites del fraccionamiento
- Los fija cada año **Rentas › Maestros › Fraccionamiento**: cuota inicial mínima (%), número máximo de cuotas, monto mínimo, interés mensual y ordenanza.
- El interés es el del año en Maestros; el usuario no lo elige.
- Si el convenio no cumple los límites, el sistema no deja grabarlo e indica qué corregir.

## Cómo se arma el cronograma
- Cuota fija (sistema francés) con el interés mensual del año; redondeo a 2 decimales con ajuste en la última cuota.
- La cuota k vence el último día del mes k siguiente a la fecha del convenio.
- Las cuotas del convenio nacen como deuda nueva (tributo **FRACCION**) y se cobran en Caja como cualquier deuda, en orden: primero la inicial y nunca la cuota k sin haber pagado la k−1.

## Qué pasa con las deudas originales
- Pasan a **FRACCIONADO** y dejan de sumarse en la deuda (las reemplazan las cuotas del convenio).
- Cuando se paga todo el cronograma, el convenio queda **CANCELADO** y las deudas originales también; si alguna OP/RD de esas deudas queda pagada, también se cancela.

## Cómo anular un convenio
- Solo se puede anular si **no tiene pagos**. Se registra el motivo.
- Al anular, las deudas originales vuelven a **PENDIENTE** y las cuotas del convenio se anulan.

## Qué pasa si no se pagan las cuotas
- En esta versión el sistema **no** hace la pérdida automática del fraccionamiento: las cuotas vencidas siguen como deuda del convenio con su mora. La pérdida automática está prevista para una versión posterior; consulte con su supervisor el procedimiento según ordenanza.
