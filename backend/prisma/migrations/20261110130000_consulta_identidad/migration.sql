-- Consulta de identidad: caché de aciertos para no gastar el cupo mensual (specs/consulta-identidad-v1.md).
-- PK compuesta (tipoDoc, numDoc) porque el documento es lo único que se repite; no hay id.
CREATE TABLE "consultas_identidad" (
    "tipoDoc" VARCHAR(10) NOT NULL,
    "numDoc" VARCHAR(20) NOT NULL,
    "datos" JSONB NOT NULL,
    "consultadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_identidad_pkey" PRIMARY KEY ("tipoDoc","numDoc")
);

CREATE INDEX "consultas_identidad_consultadoAt_idx" ON "consultas_identidad"("consultadoAt");
