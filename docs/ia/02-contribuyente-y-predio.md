# Contribuyentes y predios

Registro de contribuyentes, predios y declaraciones juradas (DJ). Se trabaja en **Rentas › Registro Tributario** (nivel `rentas.registro-tributario`).

## Cómo buscar un contribuyente
1. Entra a **Rentas › Registro Tributario**.
2. En **Buscar contribuyente** escribe DNI/RUC, nombre o razón social, código anterior (SIMUN) o dirección, y presiona **Buscar**.
3. Los resultados se muestran paginados (Anterior / Siguiente). Marca **Incluir dados de baja** si buscas a alguien dado de baja.
4. Haz clic (o Enter) en la fila para abrir su **Ficha del contribuyente**.

## Cómo registrar un contribuyente nuevo
1. En **Registro Tributario** presiona **Nuevo contribuyente** (o **Registrar contribuyente**).
2. Completa tipo de persona (natural, jurídica o sucesión), documento, nombre o razón social y domicilio fiscal.
3. Validaciones: el **DNI** tiene 8 dígitos; el **RUC** tiene 11 dígitos y dígito verificador válido; el **CE** de 9 a 12 caracteres.
4. Si el documento ya existe, el sistema lo indica (no se permiten duplicados): busca al contribuyente existente.

## Ficha del contribuyente (vista 360)
En una sola pantalla se ve todo el contribuyente, en pestañas:
- **Predios**: predios a su nombre con su porcentaje de condominio.
- **Deuda**: deuda por año y tributo.
- **Declaraciones juradas**: historial de DJ.
- **Calcular deuda**: cálculo individual de predial y arbitrios.
- **Valores** y **Convenios**: solo con nivel `rentas.control-recaudacion`.
- **Fiscalización**: solo con nivel `rentas.fiscalizacion`.
Desde la ficha están **Editar datos** y **Versión imprimible**.

## Cómo dar de baja a un contribuyente
- La baja cambia su estado a **BAJA**; nunca se borra el registro.
- No se puede dar de baja si tiene deuda pendiente.

## Cómo inscribir un predio (DJ de inscripción)
1. Desde la ficha del contribuyente presiona **Inscribir predio**.
2. Completa **Ubicación y terreno** (zona, urbanización y vía del catálogo, área de terreno), **Construcción (pisos)** con sus categorías, y otras instalaciones.
3. En **Titulares (condóminos)** agrega al menos un titular con su porcentaje.
4. Indica el año fiscal y, en inscripción o compra, la **fecha de adquisición**.
5. Presiona **Registrar declaración**. Toda DJ queda versionada (se guarda el historial).

## Motivos de declaración jurada
- **Inscripción**: predio nuevo en el registro.
- **Compra**: el declarante es el comprador.
- **Venta**: transferencia a otro titular.
- **Rectificación**: corrige datos de una DJ anterior.
- **Baja**: retira el predio (botón **Registrar baja del predio**).
- **Fiscalización**: solo la genera el sistema al resolver un expediente; no se elige a mano.

## DJ presentada fuera de plazo (multa 176.1)
- El plazo vence el último día hábil de febrero (inscripción) o del mes siguiente a la adquisición (compra), D.L. 776 art. 14.
- Si la DJ se presenta tarde, el detalle del predio la marca como extemporánea y **propone** la multa 176.1.
- Quien registra decide: emitir la multa, o **No corresponde** y escribir el motivo, luego **Confirmar descarte**. Solo se decide una vez.
- Detalle de multas en la guía de fiscalización.
