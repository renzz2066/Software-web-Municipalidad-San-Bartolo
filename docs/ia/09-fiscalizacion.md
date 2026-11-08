# Fiscalización tributaria y multas

Revisión de lo declarado contra lo verificado en campo. **Rentas › Fiscalización Tributaria** (nivel `rentas.fiscalizacion`). Fiscalizadores e infracciones en **Rentas › Maestros › Fiscalización**.

## Flujo de una fiscalización
Expediente abierto → requerimiento de inspección notificado → ficha de inspección por predio → liquidación de diferencias → resolución (RD y, si corresponde, RM).
Estados: **ABIERTO → INSPECCIONADO → RESUELTO** o **SIN DIFERENCIAS**, o **ANULADO** con motivo.

## Cómo abrir un expediente de fiscalización
1. Entra a **Rentas › Fiscalización Tributaria** y presiona **Abrir expediente**.
2. En **Apertura de expediente** elige el **Tipo** (ORDINARIA o A SOLICITUD), contribuyente, predios, años (**Desde el año** / **Hasta el año**) y **Fiscalizador**.
3. Presiona **Abrir expediente**. Recibe un número correlativo, por ejemplo `FIS 2026-000001`.

## Qué años se pueden fiscalizar
- Desde el año actual menos 4 (menos 6 si el contribuyente nunca declaró el predio) hasta el año actual (prescripción, Código Tributario art. 43).
- Solo años con parámetros cargados en Maestros (UIT y escala).

## Cómo programar y notificar el requerimiento de inspección
1. En el expediente, sección **Requerimiento de inspección**, presiona **Programar** e indica **Fecha de la visita** y **Hora**.
2. Usa **Imprimir requerimiento** (base legal arts. 62 y 87).
3. Registra la notificación: **Fecha de notificación**, **Modalidad**, **DNI / CE** y **Nombre de quien recibe**, y presiona **Guardar requerimiento**.

## Cómo registrar la ficha de inspección
1. En **Predios y fichas de inspección**, presiona **Registrar ficha** en cada predio.
2. Llena lo verificado (terreno, pisos con categorías, otras instalaciones, uso, zona) con el mismo formulario de la DJ y las **Observaciones de la inspección**.
3. La ficha no cambia el predio hasta resolver. Si editas una ficha, se borra la liquidación previa de ese predio.

## Cómo liquidar las diferencias
1. Presiona **Liquidar diferencias**: por año y tributo se compara lo fiscalizado con lo declarado (base imponible, impuesto o arbitrio y diferencia).
2. Solo cuenta lo que **sube**. Si lo fiscalizado es menor, se registra en el expediente y se atiende por descargo; no rebaja la deuda.
3. Sin aumentos, usa **Confirmar cierre sin diferencias**: el expediente queda SIN DIFERENCIAS y el predio no cambia.

## Cómo resolver el expediente
1. Con la liquidación lista, presiona **Resolver expediente** (puedes marcar si se emite la multa 178.1).
2. En una sola operación: la ficha se aplica al predio como DJ de motivo FISCALIZACIÓN, las diferencias pasan a la cuenta corriente, se emite la **RD de fiscalización** y, si corresponde, la **RM**.
3. La RD y la RM siguen el ciclo normal de valores: se notifican, se vuelven exigibles, se transfieren a coactivo y se cobran en Caja.
4. La RD imprimible muestra lo declarado, lo fiscalizado y lo omitido.

## Multas tributarias (RM)
- **176.1** No presentar la DJ en plazo: 50 % de la UIT (persona natural) o 1 UIT (persona jurídica).
- **176.2** Otras declaraciones fuera de plazo: 15 % / 30 % de la UIT.
- **178.1** Declarar cifras falsas u omitir: 50 % del tributo omitido.
- Sin gradualidad en esta versión: se aplica el 100 %. La multa nace como deuda (tributo MULTA) con interés desde la infracción (art. 181) y su RM tiene numeración propia (`RM 2026-000001`).

## Cómo anular un expediente
- Usa **Anular expediente**, escribe el **Motivo** y **Confirmar anulación**. Queda ANULADO; nunca se borra.
