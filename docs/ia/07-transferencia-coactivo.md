# Transferencia a Cobranza Coactiva y recepción

Paso de valores exigibles de Rentas a Cobranza Coactiva. Rentas transfiere en **Rentas › Control y Recaudación › Transferencia a coactivo** (nivel `rentas.control-recaudacion`); Coactiva recibe en **Cobranza Coactiva › Recepción y Transferencias** (nivel `coactivo.recepcion`) y asigna en **Asignar Valores** (nivel `coactivo.asignar-valores`).

## Cómo transferir valores a coactivo (Rentas)
Para pasar, enviar o mandar valores de Rentas a Cobranza Coactiva (lo hace Rentas, no Coactiva):
1. Entra a **Rentas › Control y Recaudación** › pestaña **Transferencia a coactivo**.
2. Elige el tipo de valores (**OP, RD y RM**, **OP y RD**, **Solo OP** o **Solo RD**) y presiona **Buscar valores exigibles**.
3. Revisa la lista y elige qué valores entran en el memorándum.
4. Genera el **memorándum de transferencia** (correlativo por año, con cantidad y monto).
5. Con **Ver e imprimir** obtienes el memorándum. En **Memorándums enviados** quedan los anteriores.

## Qué valores se pueden transferir
- Solo valores **exigibles** (notificados y con plazo cumplido) y no pagados.
- Al transferir, el valor y sus cuotas pasan a **COACTIVO**.
- Un valor en COACTIVO ya no se puede anular desde Rentas.

## Cómo recibir valores en Cobranza Coactiva
1. Entra a **Cobranza Coactiva › Recepción y Transferencias** (pantalla **Recepción de valores**).
2. Filtra por memorándum, año, tipo, contribuyente o fechas y presiona **Buscar**.
3. Elige un valor (o varios para recepción masiva) e indica **ejecutor**, **auxiliar** y **tipo de gestión** (ejecutor y auxiliar son obligatorios).
4. Confirma. El sistema crea el **expediente coactivo** con número correlativo y muestra cuántos se recibieron y cuáles fallaron.

## Reglas de la recepción
- Solo se reciben valores **COACTIVO transferidos por Rentas** (con memorándum) que aún no tienen expediente.
- Un valor que ya tiene expediente no se vuelve a recibir (el sistema lo informa como fallido).
- La recepción no cambia el valor: solo crea el expediente con sus cuotas.

## Cómo asignar valores a un auxiliar
1. Entra a **Cobranza Coactiva › Asignar Valores** (**Asignar valores a auxiliares**).
2. Elige el memorándum, marca los valores recibidos y el **Auxiliar Asignado**.
3. Presiona **Asignar Valores**. Solo se asignan valores ya recibidos y todavía en COACTIVO.

## Se puede cobrar una deuda en coactivo
- Sí. Las cuotas en COACTIVO se cobran en **Caja › Cancelaciones del Día** sin costas (aún no hay costas en el sistema), con el aviso "en cobranza coactiva".

## Qué no hace todavía Cobranza Coactiva
- Calificar y desafectar valores, gestión de expedientes, consultas y estado de cuenta coactivo aún no están implementados (pantallas "En construcción"). Consulte con el Ejecutor Coactivo.
