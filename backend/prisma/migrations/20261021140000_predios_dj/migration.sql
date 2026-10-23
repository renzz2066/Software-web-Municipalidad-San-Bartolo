-- Rentas núcleo v1, Fase C (specs/rentas-nucleo-v1.md): pisos con catálogos RNT y categorías.
-- Parte 1: generado por prisma migrate diff (sin el DROP de usuarios.oficinaNombre: drift ajeno).
ALTER TABLE "pisos" ADD COLUMN     "categorias" VARCHAR(7),
ALTER COLUMN "clasificacion" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "material" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "estadoConservacion" SET DATA TYPE VARCHAR(15);

-- Parte 2: auditoría (triggers PG, specs/auditoria-v1.md). El autor de predios ya lo fija auditoria_autor.
SELECT auditoria_habilitar('predios');
SELECT auditoria_habilitar('pisos');
SELECT auditoria_habilitar('otras_instalaciones');
SELECT auditoria_habilitar('predio_contribuyente');
