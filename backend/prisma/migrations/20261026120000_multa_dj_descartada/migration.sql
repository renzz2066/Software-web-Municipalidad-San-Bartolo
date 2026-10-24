-- Rentas fiscalización v1, Fase D (specs/rentas-fiscalizacion-v1.md, F7, decisión 6): motivo por el que
-- una DJ extemporánea no lleva la multa 176.1. Escrita a mano: el diff de la BD compartida trae cambios
-- ajenos (tablas de coactivo creadas fuera de migraciones y el drift de usuarios.oficinaNombre).

-- AlterTable
ALTER TABLE "declaraciones_juradas" ADD COLUMN "multaDescartada" VARCHAR(200);
