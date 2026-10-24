-- Rentas fiscalización v1, Fase A (specs/rentas-fiscalizacion-v1.md, decisiones 1-6).
-- Parte 1: generado por prisma migrate diff (sin el DROP de usuarios.oficinaNombre: drift ajeno).

-- CreateEnum
CREATE TYPE "TipoFiscalizacion" AS ENUM ('ORDINARIA', 'A_SOLICITUD');

-- CreateEnum
CREATE TYPE "EstadoFiscalizacion" AS ENUM ('ABIERTO', 'INSPECCIONADO', 'RESUELTO', 'SIN_DIFERENCIAS', 'ANULADO');

-- CreateEnum
CREATE TYPE "BaseMulta" AS ENUM ('UIT', 'TRIBUTO_OMITIDO');

-- AlterEnum
ALTER TYPE "MotivoDeclaracion" ADD VALUE 'FISCALIZACION';

-- AlterEnum
ALTER TYPE "TipoValor" ADD VALUE 'RM';

-- AlterTable
ALTER TABLE "cuenta_corriente" ADD COLUMN     "ajusteDeId" INTEGER;

-- AlterTable
ALTER TABLE "declaraciones_juradas" ADD COLUMN     "fechaHecho" DATE;

-- AlterTable
ALTER TABLE "valores_cab" ADD COLUMN     "declaracionId" INTEGER,
ADD COLUMN     "fiscalizacionId" INTEGER,
ADD COLUMN     "infraccionId" INTEGER;

-- CreateTable
CREATE TABLE "fiscalizadores" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "dni" VARCHAR(15) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "usuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscalizadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscalizaciones" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero" VARCHAR(15) NOT NULL,
    "tipo" "TipoFiscalizacion" NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "fiscalizadorId" INTEGER NOT NULL,
    "anioDesde" INTEGER NOT NULL,
    "anioHasta" INTEGER NOT NULL,
    "estado" "EstadoFiscalizacion" NOT NULL DEFAULT 'ABIERTO',
    "fechaInspeccion" TIMESTAMPTZ(6),
    "fechaNotificacion" DATE,
    "modalidadNotificacion" "ModalidadNotificacion",
    "notificadoDni" VARCHAR(15),
    "notificadoNombre" VARCHAR(100),
    "observacion" VARCHAR(500),
    "motivoAnulacion" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "modificadoPorId" INTEGER,

    CONSTRAINT "fiscalizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscalizacion_predios" (
    "id" SERIAL NOT NULL,
    "fiscalizacionId" INTEGER NOT NULL,
    "predioId" INTEGER NOT NULL,
    "ficha" JSONB,
    "liquidacion" JSONB,
    "declaracionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscalizacion_predios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "infracciones" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "articulo" VARCHAR(5) NOT NULL,
    "numeral" VARCHAR(5) NOT NULL,
    "descripcion" VARCHAR(250) NOT NULL,
    "base" "BaseMulta" NOT NULL,
    "porcentajeNatural" DECIMAL(7,2) NOT NULL,
    "porcentajeJuridica" DECIMAL(7,2) NOT NULL,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "infracciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscalizadores_dni_key" ON "fiscalizadores"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "fiscalizadores_usuarioId_key" ON "fiscalizadores"("usuarioId");

-- CreateIndex
CREATE INDEX "fiscalizaciones_contribuyenteId_idx" ON "fiscalizaciones"("contribuyenteId");

-- CreateIndex
CREATE INDEX "fiscalizaciones_estado_idx" ON "fiscalizaciones"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "fiscalizaciones_anio_numero_key" ON "fiscalizaciones"("anio", "numero");

-- CreateIndex
CREATE INDEX "fiscalizacion_predios_predioId_idx" ON "fiscalizacion_predios"("predioId");

-- CreateIndex
CREATE UNIQUE INDEX "fiscalizacion_predios_fiscalizacionId_predioId_key" ON "fiscalizacion_predios"("fiscalizacionId", "predioId");

-- CreateIndex
CREATE UNIQUE INDEX "infracciones_anio_codigo_key" ON "infracciones"("anio", "codigo");

-- CreateIndex
CREATE INDEX "cuenta_corriente_ajusteDeId_idx" ON "cuenta_corriente"("ajusteDeId");

-- CreateIndex
CREATE INDEX "valores_cab_fiscalizacionId_idx" ON "valores_cab"("fiscalizacionId");

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_ajusteDeId_fkey" FOREIGN KEY ("ajusteDeId") REFERENCES "cuenta_corriente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_fiscalizacionId_fkey" FOREIGN KEY ("fiscalizacionId") REFERENCES "fiscalizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_infraccionId_fkey" FOREIGN KEY ("infraccionId") REFERENCES "infracciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_declaracionId_fkey" FOREIGN KEY ("declaracionId") REFERENCES "declaraciones_juradas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscalizadores" ADD CONSTRAINT "fiscalizadores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscalizaciones" ADD CONSTRAINT "fiscalizaciones_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscalizaciones" ADD CONSTRAINT "fiscalizaciones_fiscalizadorId_fkey" FOREIGN KEY ("fiscalizadorId") REFERENCES "fiscalizadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscalizaciones" ADD CONSTRAINT "fiscalizaciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscalizaciones" ADD CONSTRAINT "fiscalizaciones_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscalizacion_predios" ADD CONSTRAINT "fiscalizacion_predios_fiscalizacionId_fkey" FOREIGN KEY ("fiscalizacionId") REFERENCES "fiscalizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscalizacion_predios" ADD CONSTRAINT "fiscalizacion_predios_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscalizacion_predios" ADD CONSTRAINT "fiscalizacion_predios_declaracionId_fkey" FOREIGN KEY ("declaracionId") REFERENCES "declaraciones_juradas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Parte 2: auditoría (triggers PG, specs/auditoria-v1.md). Expedientes y multas generan deuda.
SELECT auditoria_habilitar('fiscalizadores');
SELECT auditoria_habilitar('fiscalizaciones');
SELECT auditoria_habilitar_autor('fiscalizaciones');
SELECT auditoria_habilitar('fiscalizacion_predios');
SELECT auditoria_habilitar('infracciones');
