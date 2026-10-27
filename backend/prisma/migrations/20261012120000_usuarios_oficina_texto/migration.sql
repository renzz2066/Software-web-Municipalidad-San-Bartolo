-- Oficina como texto libre opcional en usuarios (temporal).
-- Solo agrega columna nullable; no toca datos existentes.

ALTER TABLE "usuarios" ADD COLUMN "oficinaNombre" VARCHAR(100);
