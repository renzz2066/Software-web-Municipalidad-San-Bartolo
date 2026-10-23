-- Caja v1, Fase A (specs/caja-v1.md, decisión 1). `pagos` estaba vacía: pasa a ser el detalle del recibo.
-- Parte 1: generado por prisma migrate diff (sin el DROP de usuarios.oficinaNombre: drift ajeno).

-- DropForeignKey
ALTER TABLE "pagos" DROP CONSTRAINT "pagos_cajeroId_fkey";

-- DropIndex
DROP INDEX "pagos_cajeroId_idx";

-- DropIndex
DROP INDEX "pagos_numRecibo_key";

-- AlterTable
ALTER TABLE "pagos" DROP COLUMN "cajeroId",
DROP COLUMN "descuentoAplicado",
DROP COLUMN "medioPago",
DROP COLUMN "numOperacion",
DROP COLUMN "numRecibo",
ADD COLUMN     "derechoEmision" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "estadoAnterior" "EstadoCuenta" NOT NULL,
ADD COLUMN     "reajuste" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "reciboId" INTEGER NOT NULL,
ADD COLUMN     "subtotal" DECIMAL(12,2) NOT NULL,
ALTER COLUMN "cuentaCorrienteId" SET NOT NULL;

-- CreateTable
CREATE TABLE "recibos" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero" VARCHAR(15) NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "cajeroId" INTEGER NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCaja" DATE NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "medioPago" "MedioPago" NOT NULL DEFAULT 'EFECTIVO',
    "numOperacion" VARCHAR(30),
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'CANCELADO',
    "motivoExtorno" VARCHAR(200),
    "extornadoPorId" INTEGER,
    "fechaExtorno" TIMESTAMPTZ(6),
    "fechaCajaExtorno" DATE,
    "cierreId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recibos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cierres_caja" (
    "id" SERIAL NOT NULL,
    "cajeroId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "cantidadRecibos" INTEGER NOT NULL,
    "cantidadExtornos" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "totalesPorMedio" JSONB NOT NULL,
    "totalesPorTributo" JSONB NOT NULL,
    "efectivoDeclarado" DECIMAL(12,2),
    "diferencia" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierres_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recibos_cajeroId_fechaCaja_idx" ON "recibos"("cajeroId", "fechaCaja");

-- CreateIndex
CREATE INDEX "recibos_extornadoPorId_fechaCajaExtorno_idx" ON "recibos"("extornadoPorId", "fechaCajaExtorno");

-- CreateIndex
CREATE INDEX "recibos_contribuyenteId_idx" ON "recibos"("contribuyenteId");

-- CreateIndex
CREATE INDEX "recibos_fechaCaja_idx" ON "recibos"("fechaCaja");

-- CreateIndex
CREATE UNIQUE INDEX "recibos_anio_numero_key" ON "recibos"("anio", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_caja_cajeroId_fecha_key" ON "cierres_caja"("cajeroId", "fecha");

-- CreateIndex
CREATE INDEX "pagos_reciboId_idx" ON "pagos"("reciboId");

-- CreateIndex
CREATE INDEX "pagos_cuentaCorrienteId_idx" ON "pagos"("cuentaCorrienteId");

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_extornadoPorId_fkey" FOREIGN KEY ("extornadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recibos" ADD CONSTRAINT "recibos_cierreId_fkey" FOREIGN KEY ("cierreId") REFERENCES "cierres_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "recibos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Parte 2: auditoría (triggers PG, specs/auditoria-v1.md). Cobros, extornos y cierres mueven dinero.
SELECT auditoria_habilitar('recibos');
SELECT auditoria_habilitar('pagos');
SELECT auditoria_habilitar('cierres_caja');
