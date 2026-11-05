-- Auditoría se muda de Accesibilidad a Tablero Gerencial (specs/auditoria-gerencial-v1.md, A2).
-- Re-ubica la fila existente CONSERVANDO su id: las asignaciones de "rol_nivel" siguen
-- apuntando igual y ningún rol pierde el acceso. Idempotente y seguro en cualquier orden
-- respecto al seed (si el seed ya creó la fila nueva, se re-apuntan los accesos y se borra
-- la vieja en lugar de duplicar).

DO $$
DECLARE
  v_viejo integer;
  v_nuevo integer;
  v_tablero integer;
BEGIN
  SELECT id INTO v_viejo FROM niveles WHERE codigo = 'accesibilidad.auditoria';
  IF v_viejo IS NULL THEN
    RETURN; -- ya re-ubicado (o nunca existió): nada que hacer
  END IF;

  SELECT id INTO v_nuevo FROM niveles WHERE codigo = 'tablero.auditoria';

  IF v_nuevo IS NULL THEN
    -- Camino normal: mismo id, nuevo código y padre.
    SELECT id INTO v_tablero FROM niveles WHERE codigo = 'tablero';
    UPDATE niveles
       SET codigo = 'tablero.auditoria',
           "padreId" = v_tablero,
           orden = 2
     WHERE id = v_viejo;
  ELSE
    -- Borde: el sync ya creó la fila nueva. Re-apunta los accesos viejos y borra la vieja.
    INSERT INTO "rol_nivel" ("rolId", "nivelId")
      SELECT "rolId", v_nuevo FROM "rol_nivel" WHERE "nivelId" = v_viejo
      ON CONFLICT DO NOTHING;
    DELETE FROM "rol_nivel" WHERE "nivelId" = v_viejo;
    DELETE FROM niveles WHERE id = v_viejo;
  END IF;
END $$;
