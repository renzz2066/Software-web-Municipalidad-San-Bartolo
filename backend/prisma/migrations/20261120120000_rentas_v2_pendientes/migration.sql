-- Rentas v2, Fase 7 (specs/rentas-nucleo-v2.md): lo que dejaron abierto las Fases 5 y 6.
-- - uit: incremento por pisos (V03) y factor de oficialización de obras (V05) del año.
-- - valores_obras: valores unitarios de obras complementarias del año (V05); dj_obras.codigo.
-- - dj_presentadas.variacion: autoavalúo antes y después de una modificación (J08, 5 UIT).
-- - dj_presentadas.generadaDesdeId: descargo de oficio del transferente desde la DJ del comprador.
-- - prorrogas_dj: prórrogas del plazo de presentación (J16).
-- Solo agrega: no convierte datos.

-- CreateEnum
CREATE TYPE "EstadoProrroga" AS ENUM ('SOLICITADA', 'APROBADA', 'RECHAZADA', 'ANULADA');

-- AlterTable
ALTER TABLE "uit" ADD COLUMN     "factorOficializacion" DECIMAL(6,4),
ADD COLUMN     "incrementoDesdePiso" INTEGER,
ADD COLUMN     "incrementoPisoPct" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "dj_presentadas" ADD COLUMN     "generadaDesdeId" INTEGER,
ADD COLUMN     "variacion" JSONB;

-- AlterTable
ALTER TABLE "dj_obras" ADD COLUMN     "codigo" VARCHAR(10);

-- CreateTable
CREATE TABLE "valores_obras" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "descripcion" VARCHAR(120) NOT NULL,
    "unidad" VARCHAR(10) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valores_obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prorrogas_dj" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER,
    "anio" INTEGER NOT NULL,
    "motivo" VARCHAR(20),
    "fechaLimite" DATE NOT NULL,
    "fechaSolicitud" DATE NOT NULL,
    "sustento" VARCHAR(250) NOT NULL,
    "estado" "EstadoProrroga" NOT NULL DEFAULT 'SOLICITADA',
    "resueltaPorId" INTEGER,
    "resueltaAt" TIMESTAMP(3),
    "justificacion" VARCHAR(250),
    "anuladaPorId" INTEGER,
    "anuladaAt" TIMESTAMP(3),
    "anuladaMotivo" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "modificadoPorId" INTEGER,

    CONSTRAINT "prorrogas_dj_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "valores_obras_anio_codigo_key" ON "valores_obras"("anio", "codigo");

-- CreateIndex
CREATE INDEX "prorrogas_dj_anio_estado_idx" ON "prorrogas_dj"("anio", "estado");

-- CreateIndex
CREATE INDEX "prorrogas_dj_contribuyenteId_idx" ON "prorrogas_dj"("contribuyenteId");

-- CreateIndex
CREATE INDEX "dj_presentadas_generadaDesdeId_idx" ON "dj_presentadas"("generadaDesdeId");

-- AddForeignKey
ALTER TABLE "dj_presentadas" ADD CONSTRAINT "dj_presentadas_generadaDesdeId_fkey" FOREIGN KEY ("generadaDesdeId") REFERENCES "dj_presentadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prorrogas_dj" ADD CONSTRAINT "prorrogas_dj_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prorrogas_dj" ADD CONSTRAINT "prorrogas_dj_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prorrogas_dj" ADD CONSTRAINT "prorrogas_dj_anuladaPorId_fkey" FOREIGN KEY ("anuladaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prorrogas_dj" ADD CONSTRAINT "prorrogas_dj_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prorrogas_dj" ADD CONSTRAINT "prorrogas_dj_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Auditoría: parámetros nuevos y prórrogas (con autor).
SELECT auditoria_habilitar('valores_obras');
SELECT auditoria_habilitar('prorrogas_dj');
SELECT auditoria_habilitar_autor('prorrogas_dj');
