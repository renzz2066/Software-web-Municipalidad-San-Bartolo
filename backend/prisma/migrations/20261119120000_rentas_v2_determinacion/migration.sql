-- Rentas v2, Fase 5 (specs/rentas-nucleo-v2.md): determinar y liquidar la DJ presentada.
-- - determinaciones (HR: contribuyente + año), determinacion_predios (PU/PR) y determinacion_arbitrios
--   (predio × uso × mes × concepto, L07). Lo calculado no se borra: cambia de estado.
-- - cuenta_corriente.determinacionId: qué determinación generó cada cuota (para extornar al anular, J04).
-- - dj_presentadas: revisión J14/J17, quién y cuándo liquidó, padrón previo (`aplicado`) y multa 176.1 (J08).
-- - tarifas_arbitrios: criterios de la ordenanza por concepto (frecuencia, parques, unidad; L07, R02).
-- - aranceles_rusticos: arancel rústico del año por categoría y clasificación (V07).
-- Solo agrega: no convierte datos. Las tarifas existentes quedan "por predio", como en v1.


-- CreateEnum
CREATE TYPE "EstadoDeterminacion" AS ENUM ('DETERMINADA', 'LIQUIDADA', 'REEMPLAZADA', 'DESCARTADA');

-- AlterTable
ALTER TABLE "tarifas_arbitrios" ADD COLUMN     "frecuencia" VARCHAR(20),
ADD COLUMN     "ubicacionParque" VARCHAR(20),
ADD COLUMN     "unidad" VARCHAR(10) NOT NULL DEFAULT 'PREDIO';

-- AlterTable
ALTER TABLE "dj_presentadas" ADD COLUMN     "aplicado" JSONB,
ADD COLUMN     "liquidadaAt" TIMESTAMP(3),
ADD COLUMN     "liquidadaPorId" INTEGER,
ADD COLUMN     "multaDescartada" VARCHAR(200),
ADD COLUMN     "revisionJustificacion" VARCHAR(250),
ADD COLUMN     "revisionResueltaAt" TIMESTAMP(3),
ADD COLUMN     "revisionResueltaPorId" INTEGER,
ADD COLUMN     "revisionVence" DATE;

-- AlterTable
ALTER TABLE "cuenta_corriente" ADD COLUMN     "determinacionId" INTEGER;

-- AlterTable
ALTER TABLE "valores_cab" ADD COLUMN     "djPresentadaId" INTEGER;

-- CreateTable
CREATE TABLE "aranceles_rusticos" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "categoria" VARCHAR(20) NOT NULL,
    "clasificacion" VARCHAR(20),
    "valorHa" DECIMAL(12,2) NOT NULL,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aranceles_rusticos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "determinaciones" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "djId" INTEGER,
    "estado" "EstadoDeterminacion" NOT NULL DEFAULT 'DETERMINADA',
    "baseImponible" DECIMAL(14,2) NOT NULL,
    "deduccion" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "baseAfecta" DECIMAL(14,2) NOT NULL,
    "impuesto" DECIMAL(12,2) NOT NULL,
    "derechoEmision" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "arbitrios" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "predialCalculable" BOOLEAN NOT NULL DEFAULT true,
    "liquidaPredial" BOOLEAN NOT NULL DEFAULT false,
    "liquidaArbitrios" BOOLEAN NOT NULL DEFAULT false,
    "detalle" JSONB NOT NULL,
    "liquidadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "modificadoPorId" INTEGER,

    CONSTRAINT "determinaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "determinacion_predios" (
    "id" SERIAL NOT NULL,
    "determinacionId" INTEGER NOT NULL,
    "predioId" INTEGER NOT NULL,
    "tipo" "TipoPredio" NOT NULL,
    "origen" VARCHAR(60) NOT NULL,
    "condicion" VARCHAR(20),
    "porcentaje" DECIMAL(6,2) NOT NULL,
    "afectoPredial" BOOLEAN NOT NULL,
    "exoneracion" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "terreno" DECIMAL(14,2),
    "construccion" DECIMAL(14,2),
    "obras" DECIMAL(14,2),
    "autoavaluo" DECIMAL(14,2),
    "valorAfecto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "arbitrios" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "error" VARCHAR(250),
    "datos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "determinacion_predios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "determinacion_arbitrios" (
    "id" SERIAL NOT NULL,
    "determinacionId" INTEGER NOT NULL,
    "predioId" INTEGER NOT NULL,
    "uso" VARCHAR(10) NOT NULL,
    "mes" INTEGER NOT NULL,
    "concepto" VARCHAR(30) NOT NULL,
    "importe" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "determinacion_arbitrios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aranceles_rusticos_anio_categoria_idx" ON "aranceles_rusticos"("anio", "categoria");

-- CreateIndex
CREATE INDEX "determinaciones_contribuyenteId_anio_idx" ON "determinaciones"("contribuyenteId", "anio");

-- CreateIndex
CREATE INDEX "determinaciones_djId_idx" ON "determinaciones"("djId");

-- CreateIndex
CREATE INDEX "determinaciones_estado_idx" ON "determinaciones"("estado");

-- CreateIndex
CREATE INDEX "determinacion_predios_determinacionId_idx" ON "determinacion_predios"("determinacionId");

-- CreateIndex
CREATE INDEX "determinacion_predios_predioId_idx" ON "determinacion_predios"("predioId");

-- CreateIndex
CREATE INDEX "determinacion_arbitrios_determinacionId_idx" ON "determinacion_arbitrios"("determinacionId");

-- CreateIndex
CREATE INDEX "cuenta_corriente_determinacionId_idx" ON "cuenta_corriente"("determinacionId");

-- AddForeignKey
ALTER TABLE "dj_presentadas" ADD CONSTRAINT "dj_presentadas_revisionResueltaPorId_fkey" FOREIGN KEY ("revisionResueltaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_presentadas" ADD CONSTRAINT "dj_presentadas_liquidadaPorId_fkey" FOREIGN KEY ("liquidadaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "determinaciones" ADD CONSTRAINT "determinaciones_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "determinaciones" ADD CONSTRAINT "determinaciones_djId_fkey" FOREIGN KEY ("djId") REFERENCES "dj_presentadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "determinaciones" ADD CONSTRAINT "determinaciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "determinaciones" ADD CONSTRAINT "determinaciones_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "determinacion_predios" ADD CONSTRAINT "determinacion_predios_determinacionId_fkey" FOREIGN KEY ("determinacionId") REFERENCES "determinaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "determinacion_predios" ADD CONSTRAINT "determinacion_predios_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "determinacion_arbitrios" ADD CONSTRAINT "determinacion_arbitrios_determinacionId_fkey" FOREIGN KEY ("determinacionId") REFERENCES "determinaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "determinacion_arbitrios" ADD CONSTRAINT "determinacion_arbitrios_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_determinacionId_fkey" FOREIGN KEY ("determinacionId") REFERENCES "determinaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_djPresentadaId_fkey" FOREIGN KEY ("djPresentadaId") REFERENCES "dj_presentadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Auditoría: lo calculado y los parámetros nuevos; autor en la cabecera de la determinación.
SELECT auditoria_habilitar('determinaciones');
SELECT auditoria_habilitar('determinacion_predios');
SELECT auditoria_habilitar('determinacion_arbitrios');
SELECT auditoria_habilitar('aranceles_rusticos');
SELECT auditoria_habilitar_autor('determinaciones');
