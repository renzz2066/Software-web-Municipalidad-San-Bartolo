# Skill: Dominio Rentas (SIMUN → web)
<!-- Formato: <40 líneas, glosario + reglas oro. Si editas, mantén este formato. -->

Fuente de verdad del modelo: `backend/prisma/schema.prisma`. En `main` solo existe
`Usuario` (+auth); el resto del dominio vive en specs activas (ver `specs/_index.md`).

1. Términos: contribuyente (maestro), predio (urbano/rústico), cuenta corriente (deuda),
   pago/recibo, valores (cobranza), coactivo, licencias/giros, TUPA/UIT. SIMUN (`*.DBF`,
   FoxPro) es solo referencia histórica: no ETL, no registros tributarios iniciales.
2. Reglas oro: `codigoLegacy` solo para consulta histórica (nunca como FK); montos
   `DECIMAL(12,2)`; estados en vez de `DELETE`; todo pago rastreable a su deuda por FK.
3. Auditoría: tabla única (`tabla, accion, registroId, usuarioId, detalle JSON`), escrita
   en la misma transacción del trámite. `createdAt/updatedAt` en maestras.
4. No inventes tablas/campos. Si la spec no los define, pregunta antes de modelar.
