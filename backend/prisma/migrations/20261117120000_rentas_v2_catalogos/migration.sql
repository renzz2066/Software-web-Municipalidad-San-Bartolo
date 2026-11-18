-- Rentas v2, Fase 0 (specs/rentas-nucleo-v2.md): catálogos con código y reglas por muni.
-- Solo estructura y auditoría: los valores nacionales los siembra prisma/seed.ts (idempotente,
-- no pisa lo que la muni ya editó).

-- CreateEnum
CREATE TYPE "GrupoCatalogo" AS ENUM ('TIPO_DOCUMENTO', 'TIPO_CONTACTO', 'TIPO_RELACIONADO', 'TIPO_SUCESION', 'PERFIL_CUMPLIMIENTO', 'PERFIL_COBRANZA', 'CLASIFICACION_CONTRIBUYENTE', 'BENEFICIO', 'COMPONENTE_DIRECCION', 'TIPO_VIA', 'TIPO_HABILITACION', 'FRECUENCIA_BARRIDO', 'UBICACION_PARQUE', 'CONDICION_PROPIEDAD', 'USO_PREDIO', 'SUB_USO_PREDIO', 'MOTIVO_DJ', 'SUB_MOTIVO_DJ', 'TIPO_DOC_ADJUNTO', 'TIPO_DOC_TRANSFERENCIA');

-- CreateTable
CREATE TABLE "catalogos" (
    "id" SERIAL NOT NULL,
    "grupo" "GrupoCatalogo" NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "abreviatura" VARCHAR(20),
    "padreId" INTEGER,
    "atributos" JSONB,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_muni" (
    "clave" VARCHAR(60) NOT NULL,
    "valor" JSONB NOT NULL,
    "descripcion" VARCHAR(250) NOT NULL,
    "regla" VARCHAR(20),
    "ordenanza" VARCHAR(60),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglas_muni_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "catalogos_grupo_orden_idx" ON "catalogos"("grupo", "orden");

-- CreateIndex
CREATE INDEX "catalogos_padreId_idx" ON "catalogos"("padreId");

-- CreateIndex
CREATE UNIQUE INDEX "catalogos_grupo_codigo_key" ON "catalogos"("grupo", "codigo");

-- AddForeignKey
ALTER TABLE "catalogos" ADD CONSTRAINT "catalogos_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "catalogos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Auditoría de cambios (P13): toda edición de catálogos y reglas queda registrada.
SELECT auditoria_habilitar('catalogos');
SELECT auditoria_habilitar('reglas_muni', ARRAY['clave']);
