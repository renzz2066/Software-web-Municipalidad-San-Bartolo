-- Rentas núcleo v1, Fase A (specs/rentas-nucleo-v1.md).
-- Parte 1: generado por prisma migrate diff (sin el DROP de usuarios.oficinaNombre: drift ajeno).

-- CreateEnum
CREATE TYPE "MotivoDeclaracion" AS ENUM ('INSCRIPCION', 'COMPRA', 'VENTA', 'RECTIFICACION', 'BAJA');

-- CreateEnum
CREATE TYPE "ComponenteConstruccion" AS ENUM ('MUROS_COLUMNAS', 'TECHOS', 'PISOS', 'PUERTAS_VENTANAS', 'REVESTIMIENTOS', 'BANOS', 'INSTALACIONES');

-- CreateEnum
CREATE TYPE "TipoTasaMora" AS ENUM ('TIM', 'IPM');

-- DropIndex
DROP INDEX "tarifas_arbitrios_anio_concepto_key";

-- AlterTable
ALTER TABLE "escala_predial" ADD COLUMN     "ordenanza" VARCHAR(60);

-- AlterTable
ALTER TABLE "tarifas_arbitrios" ADD COLUMN     "ordenanza" VARCHAR(60),
ADD COLUMN     "uso" VARCHAR(10),
ADD COLUMN     "zonaId" INTEGER;

-- AlterTable
ALTER TABLE "uit" ADD COLUMN     "ordenanza" VARCHAR(60);

-- CreateTable
CREATE TABLE "aranceles" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "viaId" INTEGER NOT NULL,
    "urbanizacionId" INTEGER,
    "valorM2" DECIMAL(12,2) NOT NULL,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aranceles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valores_unitarios" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "componente" "ComponenteConstruccion" NOT NULL,
    "categoria" VARCHAR(1) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valores_unitarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciaciones" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "clasificacion" VARCHAR(30) NOT NULL,
    "material" VARCHAR(20) NOT NULL,
    "antiguedadHasta" INTEGER NOT NULL,
    "estadoConservacion" VARCHAR(15) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasas_mora" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoTasaMora" NOT NULL,
    "vigenciaDesde" DATE NOT NULL,
    "valor" DECIMAL(12,5) NOT NULL,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasas_mora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaraciones_juradas" (
    "id" SERIAL NOT NULL,
    "predioId" INTEGER NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "motivo" "MotivoDeclaracion" NOT NULL,
    "fecha" DATE NOT NULL,
    "snapshot" JSONB NOT NULL,
    "observacion" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "modificadoPorId" INTEGER,

    CONSTRAINT "declaraciones_juradas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aranceles_anio_viaId_idx" ON "aranceles"("anio", "viaId");

-- CreateIndex
CREATE UNIQUE INDEX "valores_unitarios_anio_componente_categoria_key" ON "valores_unitarios"("anio", "componente", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "depreciaciones_anio_clasificacion_material_antiguedadHasta__key" ON "depreciaciones"("anio", "clasificacion", "material", "antiguedadHasta", "estadoConservacion");

-- CreateIndex
CREATE UNIQUE INDEX "tasas_mora_tipo_vigenciaDesde_key" ON "tasas_mora"("tipo", "vigenciaDesde");

-- CreateIndex
CREATE INDEX "declaraciones_juradas_predioId_anio_idx" ON "declaraciones_juradas"("predioId", "anio");

-- CreateIndex
CREATE INDEX "declaraciones_juradas_contribuyenteId_anio_idx" ON "declaraciones_juradas"("contribuyenteId", "anio");

-- CreateIndex
CREATE INDEX "tarifas_arbitrios_anio_concepto_idx" ON "tarifas_arbitrios"("anio", "concepto");

-- AddForeignKey
ALTER TABLE "tarifas_arbitrios" ADD CONSTRAINT "tarifas_arbitrios_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aranceles" ADD CONSTRAINT "aranceles_viaId_fkey" FOREIGN KEY ("viaId") REFERENCES "vias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aranceles" ADD CONSTRAINT "aranceles_urbanizacionId_fkey" FOREIGN KEY ("urbanizacionId") REFERENCES "urbanizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_juradas" ADD CONSTRAINT "declaraciones_juradas_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_juradas" ADD CONSTRAINT "declaraciones_juradas_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_juradas" ADD CONSTRAINT "declaraciones_juradas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_juradas" ADD CONSTRAINT "declaraciones_juradas_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Parte 2: auditoría (triggers PG, specs/auditoria-v1.md).
SELECT auditoria_habilitar('uit');
SELECT auditoria_habilitar('escala_predial');
SELECT auditoria_habilitar('tarifas_arbitrios');
SELECT auditoria_habilitar('aranceles');
SELECT auditoria_habilitar('valores_unitarios');
SELECT auditoria_habilitar('depreciaciones');
SELECT auditoria_habilitar('tasas_mora');
SELECT auditoria_habilitar('zonas');
SELECT auditoria_habilitar('urbanizaciones');
SELECT auditoria_habilitar('vias');
SELECT auditoria_habilitar('declaraciones_juradas');
SELECT auditoria_habilitar_autor('declaraciones_juradas');
