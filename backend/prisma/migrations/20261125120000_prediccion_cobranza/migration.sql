-- CreateEnum
CREATE TYPE "GrupoCobranza" AS ENUM ('PUNTUAL', 'TARDIO', 'INCOBRABLE');

-- CreateEnum
CREATE TYPE "EstadoGestionCobranza" AS ENUM ('PENDIENTE', 'CONTACTADO', 'COMPROMISO', 'PAGO', 'NO_UBICADO');

-- CreateTable
CREATE TABLE "cobranza_lotes" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "modelo" VARCHAR(60) NOT NULL,
    "archivo" VARCHAR(120) NOT NULL,
    "filas" INTEGER NOT NULL,
    "enlazados" INTEGER NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "modificadoPorId" INTEGER,

    CONSTRAINT "cobranza_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puntajes_cobranza" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "prioridad" INTEGER NOT NULL,
    "tramo" CHAR(1) NOT NULL,
    "codigoLegacy" VARCHAR(7) NOT NULL,
    "contribuyenteId" INTEGER,
    "grupo" "GrupoCobranza" NOT NULL,
    "pPuntual" DECIMAL(5,4) NOT NULL,
    "pTardio" DECIMAL(5,4) NOT NULL,
    "pIncobrable" DECIMAL(5,4) NOT NULL,
    "deudaAnio" DECIMAL(12,2) NOT NULL,
    "deudaPendiente" DECIMAL(12,2) NOT NULL,
    "deudaEsperada" DECIMAL(12,2) NOT NULL,
    "accion" VARCHAR(60) NOT NULL,

    CONSTRAINT "puntajes_cobranza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gestiones_cobranza" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "codigoLegacy" VARCHAR(7) NOT NULL,
    "estado" "EstadoGestionCobranza" NOT NULL,
    "observacion" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER,
    "modificadoPorId" INTEGER,

    CONSTRAINT "gestiones_cobranza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cobranza_lotes_anio_vigente_idx" ON "cobranza_lotes"("anio", "vigente");

-- CreateIndex
CREATE INDEX "puntajes_cobranza_contribuyenteId_idx" ON "puntajes_cobranza"("contribuyenteId");

-- CreateIndex
CREATE UNIQUE INDEX "puntajes_cobranza_loteId_codigoLegacy_key" ON "puntajes_cobranza"("loteId", "codigoLegacy");

-- CreateIndex
CREATE UNIQUE INDEX "puntajes_cobranza_loteId_prioridad_key" ON "puntajes_cobranza"("loteId", "prioridad");

-- CreateIndex
CREATE INDEX "gestiones_cobranza_anio_codigoLegacy_createdAt_idx" ON "gestiones_cobranza"("anio", "codigoLegacy", "createdAt");

-- AddForeignKey
ALTER TABLE "cobranza_lotes" ADD CONSTRAINT "cobranza_lotes_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobranza_lotes" ADD CONSTRAINT "cobranza_lotes_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntajes_cobranza" ADD CONSTRAINT "puntajes_cobranza_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "cobranza_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntajes_cobranza" ADD CONSTRAINT "puntajes_cobranza_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestiones_cobranza" ADD CONSTRAINT "gestiones_cobranza_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gestiones_cobranza" ADD CONSTRAINT "gestiones_cobranza_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Auditoría (specs/prediccion-cobranza-v1.md): el lote y las gestiones, con autor.
-- puntajes_cobranza no se audita por fila (~7 mil por import); lo cubre su lote.
SELECT auditoria_habilitar('cobranza_lotes');
SELECT auditoria_habilitar_autor('cobranza_lotes');
SELECT auditoria_habilitar('gestiones_cobranza');
SELECT auditoria_habilitar_autor('gestiones_cobranza');
