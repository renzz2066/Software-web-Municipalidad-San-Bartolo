-- Rentas núcleo v1, Fase D (specs/rentas-nucleo-v1.md): derecho de emisión anual.
-- Generado por prisma migrate diff (sin el DROP de usuarios.oficinaNombre: drift ajeno).
ALTER TABLE "uit" ADD COLUMN     "derechoEmision" DECIMAL(10,2) NOT NULL DEFAULT 0;
