# Cálculo de predial y arbitrios, y maestros del año

Cómo se calcula la deuda y cómo preparar los parámetros de cada año. Maestros: **Rentas › Maestros** (nivel `rentas.maestros`). Cálculo masivo: **Rentas › Cálculo Masivo** (nivel `rentas.calculo-masivo`).

## Maestros de Rentas: qué parámetros hay
En **Rentas › Maestros** se elige el **Año fiscal** y se editan, por pestañas:
- **UIT** del año, **Escala predial** (tramos en UIT), **Aranceles** de terreno, **Valores unitarios** de edificación, **Depreciación**.
- **Tarifas arbitrios** por zona y uso (residuos sólidos, barrido, parques y jardines, serenazgo).
- **Ubicación** (zonas, urbanizaciones, vías), **Feriados**, **Fraccionamiento** (límites del año) y **Fiscalización** (fiscalizadores e infracciones).
El resumen superior marca **Falta** cuando un parámetro del año no está cargado. Cada parámetro guarda su ordenanza.

## Cómo abrir un año nuevo
1. En **Maestros** usa el asistente **Abrir año** (N+1).
2. El sistema copia los parámetros del año anterior para que solo edites lo que cambió (UIT, tarifas, aranceles…).
3. Revisa que el resumen no muestre ningún **Falta** antes de calcular.

## Cómo se calcula el impuesto predial
- Autoavalúo = terreno (área × arancel) + suma de pisos (área × valor unitario × (1 − depreciación)) + otras instalaciones.
- Impuesto por tramos de la escala en UIT: 0.2 % hasta 15 UIT, 0.6 % de 15 a 60 UIT y 1.0 % sobre 60 UIT, con un mínimo que es un porcentaje de la UIT del año.
- Si hay condóminos, cada uno paga sobre su porcentaje de participación.
- Se paga en 4 cuotas trimestrales (febrero, mayo, agosto, noviembre); las cuotas 2 a 4 llevan reajuste por IPM. También se puede pagar al contado hasta fin de febrero sin reajuste.
- La cuota 1 incluye el derecho de emisión (monto fijo anual).

## Cómo se calculan los arbitrios
- Tarifa del año por concepto (residuos, barrido, parques, serenazgo) según la zona y el uso del predio.
- Se cobran en 4 cuotas trimestrales.

## Cómo calcular la deuda de un solo contribuyente
1. Abre su ficha y entra a la pestaña **Calcular deuda**.
2. Elige año y tributos, presiona **Simular**, revisa y luego **Ejecutar cálculo**.

## Cómo hacer el cálculo masivo
1. Entra a **Rentas › Cálculo Masivo**.
2. Elige el **Año fiscal** y los tributos: **Predial y arbitrios**, **Solo predial** o **Solo arbitrios**.
3. Presiona **Simular**: verás totales y la lista de contribuyentes afectados, sin grabar nada.
4. Si todo está bien, presiona **Ejecutar cálculo**.

## Qué pasa si vuelvo a ejecutar el cálculo
- Es seguro: re-ejecutar no duplica cuotas.
- Solo se recalculan las cuotas **PENDIENTE** sin valor vigente.
- Nunca se tocan cuotas **CANCELADO**, **FRACCIONADO**, **COACTIVO** ni las que están en una OP/RD vigente. Para corregir una cuota en valor, primero hay que anular el valor.
- Un contribuyente con datos incompletos del predio no se puede calcular: completa la DJ.
