-- Cobranza coactiva: maestros de ejecutor/auxiliar, memorándum de recepción y
-- enlaces en coactivo_exp / valores_cab.
-- specs/coactiva-recepcion-transferencia-v1.md (port de feat/coactiva-recepcion-transferencia)
--
-- Idempotente a propósito: la BD compartida ya tiene estos objetos (se crearon
-- fuera de Prisma mientras la rama de coactiva estaba en desarrollo). Los
-- IF NOT EXISTS la dejan intacta y permiten reproducir la misma estructura
-- desde cero en una base nueva.

-- 1) valores_cab: memorándum de origen y auxiliar que recibe el valor
ALTER TABLE "valores_cab" ADD COLUMN IF NOT EXISTS "memorandumId" INTEGER;
ALTER TABLE "valores_cab" ADD COLUMN IF NOT EXISTS "auxiliarAsignadoId" INTEGER;

-- 2) coactivo_exp: ejecutor/auxiliar dejan de ser texto libre
ALTER TABLE "coactivo_exp" DROP COLUMN IF EXISTS "ejecutor";
ALTER TABLE "coactivo_exp" DROP COLUMN IF EXISTS "auxiliar";
ALTER TABLE "coactivo_exp" ADD COLUMN IF NOT EXISTS "ejecutorId" INTEGER;
ALTER TABLE "coactivo_exp" ADD COLUMN IF NOT EXISTS "auxiliarId" INTEGER;
ALTER TABLE "coactivo_exp" ADD COLUMN IF NOT EXISTS "tipoGestionId" INTEGER;

-- 3) maestros de cobranza coactiva
CREATE TABLE IF NOT EXISTS "ejecutores_coactivo" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ejecutores_coactivo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "auxiliares_coactivo" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auxiliares_coactivo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "memorandums_coactiva" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "anio" INTEGER NOT NULL,
    "areaOrigen" VARCHAR(100) NOT NULL,
    "fechaRecepcion" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memorandums_coactiva_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tipos_gestion_coactiva" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "descripcion" VARCHAR(150) NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_gestion_coactiva_pkey" PRIMARY KEY ("id")
);

-- 4) índices
CREATE UNIQUE INDEX IF NOT EXISTS "ejecutores_coactivo_codigo_key" ON "ejecutores_coactivo"("codigo" ASC);
CREATE UNIQUE INDEX IF NOT EXISTS "auxiliares_coactivo_codigo_key" ON "auxiliares_coactivo"("codigo" ASC);
CREATE UNIQUE INDEX IF NOT EXISTS "memorandums_coactiva_numero_key" ON "memorandums_coactiva"("numero" ASC);
CREATE INDEX IF NOT EXISTS "memorandums_coactiva_anio_idx" ON "memorandums_coactiva"("anio" ASC);
CREATE UNIQUE INDEX IF NOT EXISTS "tipos_gestion_coactiva_codigo_key" ON "tipos_gestion_coactiva"("codigo" ASC);
CREATE INDEX IF NOT EXISTS "valores_cab_memorandumId_idx" ON "valores_cab"("memorandumId" ASC);
CREATE INDEX IF NOT EXISTS "valores_cab_auxiliarAsignadoId_idx" ON "valores_cab"("auxiliarAsignadoId" ASC);
CREATE INDEX IF NOT EXISTS "coactivo_exp_ejecutorId_idx" ON "coactivo_exp"("ejecutorId" ASC);
CREATE INDEX IF NOT EXISTS "coactivo_exp_auxiliarId_idx" ON "coactivo_exp"("auxiliarId" ASC);

-- 5) claves foráneas (Postgres no admite ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coactivo_exp_ejecutorId_fkey' AND conrelid = '"coactivo_exp"'::regclass
  ) THEN
    ALTER TABLE "coactivo_exp" ADD CONSTRAINT "coactivo_exp_ejecutorId_fkey"
      FOREIGN KEY ("ejecutorId") REFERENCES "ejecutores_coactivo"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coactivo_exp_auxiliarId_fkey' AND conrelid = '"coactivo_exp"'::regclass
  ) THEN
    ALTER TABLE "coactivo_exp" ADD CONSTRAINT "coactivo_exp_auxiliarId_fkey"
      FOREIGN KEY ("auxiliarId") REFERENCES "auxiliares_coactivo"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valores_cab_memorandumId_fkey' AND conrelid = '"valores_cab"'::regclass
  ) THEN
    ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_memorandumId_fkey"
      FOREIGN KEY ("memorandumId") REFERENCES "memorandums_coactiva"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valores_cab_auxiliarAsignadoId_fkey' AND conrelid = '"valores_cab"'::regclass
  ) THEN
    ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_auxiliarAsignadoId_fkey"
      FOREIGN KEY ("auxiliarAsignadoId") REFERENCES "auxiliares_coactivo"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6) auditoría (convención del proyecto: toda tabla nueva queda auditada)
SELECT auditoria_habilitar('ejecutores_coactivo');
SELECT auditoria_habilitar('auxiliares_coactivo');
SELECT auditoria_habilitar('memorandums_coactiva');
SELECT auditoria_habilitar('tipos_gestion_coactiva');
