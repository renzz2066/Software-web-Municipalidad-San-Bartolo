-- Rentas valores v1, Fase A (specs/rentas-valores-v1.md, decisiones 1-4).
-- Parte 1: generado por prisma migrate diff (sin el DROP de usuarios.oficinaNombre: drift ajeno).

-- CreateEnum
CREATE TYPE "ModalidadNotificacion" AS ENUM ('PERSONAL', 'NEGATIVA', 'CEDULON', 'PUBLICACION');

-- CreateEnum
CREATE TYPE "EstadoTransferencia" AS ENUM ('ENVIADA', 'RECIBIDA', 'DEVUELTA');

-- AlterTable
ALTER TABLE "convenio_detalle" ADD COLUMN     "amortizacion" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "interes" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "convenios" ADD COLUMN     "interesMensual" DECIMAL(7,4) NOT NULL DEFAULT 0,
ADD COLUMN     "motivoAnulacion" VARCHAR(200);

-- AlterTable
ALTER TABLE "valores_cab" ADD COLUMN     "baseImponible" DECIMAL(12,2),
ADD COLUMN     "fechaExigible" DATE,
ADD COLUMN     "modalidadNotificacion" "ModalidadNotificacion",
ADD COLUMN     "motivoAnulacion" VARCHAR(200),
ADD COLUMN     "notificadoDni" VARCHAR(15),
ADD COLUMN     "notificadoNombre" VARCHAR(100),
ADD COLUMN     "transferenciaId" INTEGER;

-- CreateTable
CREATE TABLE "feriados" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_fraccionamiento" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "cuotaInicialMinPct" DECIMAL(5,2) NOT NULL,
    "cuotasMax" INTEGER NOT NULL,
    "montoMinimo" DECIMAL(12,2) NOT NULL,
    "interesMensual" DECIMAL(7,4) NOT NULL,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parametros_fraccionamiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correlativos" (
    "serie" VARCHAR(10) NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "correlativos_pkey" PRIMARY KEY ("serie","anio")
);

-- CreateTable
CREATE TABLE "convenio_deudas" (
    "id" SERIAL NOT NULL,
    "convenioId" INTEGER NOT NULL,
    "cuentaCorrienteId" INTEGER NOT NULL,
    "insoluto" DECIMAL(12,2) NOT NULL,
    "reajuste" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mora" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "convenio_deudas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencias_coactivo" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero" VARCHAR(15) NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cantidad" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoTransferencia" NOT NULL DEFAULT 'ENVIADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transferencias_coactivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feriados_fecha_key" ON "feriados"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_fraccionamiento_anio_key" ON "parametros_fraccionamiento"("anio");

-- CreateIndex
CREATE INDEX "convenio_deudas_cuentaCorrienteId_idx" ON "convenio_deudas"("cuentaCorrienteId");

-- CreateIndex
CREATE UNIQUE INDEX "convenio_deudas_convenioId_cuentaCorrienteId_key" ON "convenio_deudas"("convenioId", "cuentaCorrienteId");

-- CreateIndex
CREATE UNIQUE INDEX "transferencias_coactivo_anio_numero_key" ON "transferencias_coactivo"("anio", "numero");

-- CreateIndex
CREATE INDEX "valores_cab_estado_idx" ON "valores_cab"("estado");

-- AddForeignKey
ALTER TABLE "convenio_deudas" ADD CONSTRAINT "convenio_deudas_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenio_deudas" ADD CONSTRAINT "convenio_deudas_cuentaCorrienteId_fkey" FOREIGN KEY ("cuentaCorrienteId") REFERENCES "cuenta_corriente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "transferencias_coactivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Parte 2: auditoría (triggers PG, specs/auditoria-v1.md). Valores y convenios mueven deuda: se auditan desde ahora.
SELECT auditoria_habilitar('feriados');
SELECT auditoria_habilitar('parametros_fraccionamiento');
SELECT auditoria_habilitar('correlativos', ARRAY['serie', 'anio']);
SELECT auditoria_habilitar('transferencias_coactivo');
SELECT auditoria_habilitar('convenio_deudas');
SELECT auditoria_habilitar('convenios');
SELECT auditoria_habilitar('convenio_detalle');
SELECT auditoria_habilitar('valores_cab');
SELECT auditoria_habilitar('valores_det');
