-- Crear tabla niveles (catálogo auto-registrado por el sistema).
-- Solo crea estructura; los datos los inserta la sincronización (seed o endpoint).
-- No afecta a ninguna tabla existente.

-- CreateEnum
CREATE TYPE "TipoNivel" AS ENUM ('MODULO', 'FUNCIONALIDAD');

-- CreateTable
CREATE TABLE "niveles" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "tipo" "TipoNivel" NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(200),
    "padreId" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "niveles_pkey" PRIMARY KEY ("id")
);

-- Índices y FK jerárquica (Restrict: un módulo con subniveles no se elimina)
CREATE UNIQUE INDEX "niveles_codigo_key" ON "niveles"("codigo");
CREATE INDEX "niveles_padreId_idx" ON "niveles"("padreId");
ALTER TABLE "niveles" ADD CONSTRAINT "niveles_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "niveles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
