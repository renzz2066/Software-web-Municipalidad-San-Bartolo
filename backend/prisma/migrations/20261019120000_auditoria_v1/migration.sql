-- Auditoría v1 (specs/auditoria-v1.md).
-- Parte 1: cambios de schema generados por prisma migrate diff.

ALTER TYPE "AccionAuditoria" ADD VALUE 'LOGIN_FALLIDO';
ALTER TYPE "AccionAuditoria" ADD VALUE 'LOGOUT';

-- DropForeignKey
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_usuarioId_fkey";

-- DropIndex
DROP INDEX "auditoria_usuarioId_idx";

-- AlterTable
ALTER TABLE "oficinas" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "auditoria" ADD COLUMN     "datosAntes" JSONB,
ADD COLUMN     "datosDespues" JSONB,
ADD COLUMN     "ip" VARCHAR(45),
ADD COLUMN     "modulo" VARCHAR(100),
ADD COLUMN     "userAgent" VARCHAR(255),
ADD COLUMN     "usuarioNombre" VARCHAR(50),
ALTER COLUMN "registroId" DROP NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "contribuyentes" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "predios" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "vehiculos" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "cuenta_corriente" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "convenios" ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "valores_cab" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "coactivo_exp" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- AlterTable
ALTER TABLE "licencias" ADD COLUMN     "creadoPorId" INTEGER,
ADD COLUMN     "modificadoPorId" INTEGER;

-- CreateIndex
CREATE INDEX "auditoria_createdAt_idx" ON "auditoria"("createdAt");

-- CreateIndex
CREATE INDEX "auditoria_usuarioId_createdAt_idx" ON "auditoria"("usuarioId", "createdAt");

-- CreateIndex
CREATE INDEX "auditoria_accion_createdAt_idx" ON "auditoria"("accion", "createdAt");

-- AddForeignKey
ALTER TABLE "oficinas" ADD CONSTRAINT "oficinas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oficinas" ADD CONSTRAINT "oficinas_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribuyentes" ADD CONSTRAINT "contribuyentes_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribuyentes" ADD CONSTRAINT "contribuyentes_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coactivo_exp" ADD CONSTRAINT "coactivo_exp_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coactivo_exp" ADD CONSTRAINT "coactivo_exp_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================
-- Parte 2: mecanismo genérico (triggers). Contexto por transacción:
-- la app ejecuta set_config('app.<clave>', valor, true) antes de escribir
-- (usuario_id, usuario_nombre, modulo, ip, user_agent). Sin contexto
-- (scripts, psql, seed) se registra usuarioId null + usuario de BD.
-- Auditar una tabla nueva: SELECT auditoria_habilitar('tabla', ARRAY['id']).
-- ============================================================

-- Lee el contexto; '' (GUC ya usado en la conexión) cuenta como null.
CREATE OR REPLACE FUNCTION auditoria_ctx(clave text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.' || clave, true), '')
$$;

-- Quita campos sensibles. marcar=true deja "[CAMBIADO]" en vez del valor.
-- Agregar aquí cualquier otro campo sensible.
CREATE OR REPLACE FUNCTION auditoria_ocultar(datos jsonb, marcar boolean) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  campo text;
BEGIN
  IF datos IS NULL THEN
    RETURN NULL;
  END IF;
  FOREACH campo IN ARRAY ARRAY['password'] LOOP
    IF datos ? campo THEN
      IF marcar THEN
        datos := jsonb_set(datos, ARRAY[campo], '"[CAMBIADO]"');
      ELSE
        datos := datos - campo;
      END IF;
    END IF;
  END LOOP;
  RETURN datos;
END
$$;

-- Solo los campos que cambiaron. Sin cambios reales → (null, null).
CREATE OR REPLACE FUNCTION auditoria_diff(antes jsonb, despues jsonb, OUT d_antes jsonb, OUT d_despues jsonb)
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_object_agg(n.key, o.value), jsonb_object_agg(n.key, n.value)
  FROM jsonb_each(despues) n
  JOIN jsonb_each(antes) o ON o.key = n.key
  WHERE n.value IS DISTINCT FROM o.value
    AND n.key NOT IN ('updatedAt', 'modificadoPorId')
$$;

-- AFTER ROW. TG_ARGV = columnas de la PK (compuesta → "a:b").
CREATE OR REPLACE FUNCTION auditoria_registrar() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_antes jsonb;
  v_despues jsonb;
  v_registro text;
  v_usuario_id int := auditoria_ctx('usuario_id')::int;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old := to_jsonb(OLD);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new := to_jsonb(NEW);
  END IF;

  SELECT string_agg(COALESCE(v_new, v_old) ->> t.pk, ':' ORDER BY t.ord)
    INTO v_registro
    FROM unnest(TG_ARGV) WITH ORDINALITY AS t(pk, ord);

  IF TG_OP = 'UPDATE' THEN
    SELECT d.d_antes, d.d_despues INTO v_antes, v_despues FROM auditoria_diff(v_old, v_new) d;
    IF v_despues IS NULL THEN
      RETURN NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_despues := v_new;
  ELSE
    v_antes := v_old;
  END IF;

  INSERT INTO "auditoria" (
    "usuarioId", "usuarioNombre", "accion", "tabla", "registroId", "modulo",
    "ip", "userAgent", "datosAntes", "datosDespues", "detalle"
  ) VALUES (
    v_usuario_id,
    left(auditoria_ctx('usuario_nombre'), 50),
    (CASE TG_OP WHEN 'INSERT' THEN 'CREATE' WHEN 'UPDATE' THEN 'UPDATE' ELSE 'DELETE' END)::"AccionAuditoria",
    TG_TABLE_NAME,
    left(v_registro, 50),
    left(auditoria_ctx('modulo'), 100),
    left(auditoria_ctx('ip'), 45),
    left(auditoria_ctx('user_agent'), 255),
    auditoria_ocultar(v_antes, false),
    auditoria_ocultar(v_despues, TG_OP = 'UPDATE'),
    CASE WHEN v_usuario_id IS NULL THEN jsonb_build_object('dbUsuario', session_user) END
  );
  RETURN NULL;
END
$$;

-- BEFORE ROW. creadoPorId/modificadoPorId los decide el servidor, nunca el cliente.
-- jsonb_populate_record ignora las columnas que la tabla no tenga.
CREATE OR REPLACE FUNCTION auditoria_autor() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_usuario_id int := auditoria_ctx('usuario_id')::int;
  v_old jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'creadoPorId', v_usuario_id, 'modificadoPorId', v_usuario_id));
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  NEW := jsonb_populate_record(NEW, jsonb_build_object('creadoPorId', v_old -> 'creadoPorId'));
  -- Un UPDATE sin cambios reales no cambia el autor.
  IF (auditoria_diff(v_old, to_jsonb(NEW))).d_despues IS NOT NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('modificadoPorId', v_usuario_id));
  ELSE
    NEW := jsonb_populate_record(NEW, jsonb_build_object('modificadoPorId', v_old -> 'modificadoPorId'));
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION auditoria_habilitar(tabla regclass, pk text[] DEFAULT ARRAY['id']) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS auditoria_registrar ON %s', tabla);
  EXECUTE format(
    'CREATE TRIGGER auditoria_registrar AFTER INSERT OR UPDATE OR DELETE ON %s '
    'FOR EACH ROW EXECUTE FUNCTION auditoria_registrar(%s)',
    tabla, (SELECT string_agg(quote_literal(c), ', ') FROM unnest(pk) AS c));
END
$$;

CREATE OR REPLACE FUNCTION auditoria_habilitar_autor(tabla regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS auditoria_autor ON %s', tabla);
  EXECUTE format(
    'CREATE TRIGGER auditoria_autor BEFORE INSERT OR UPDATE ON %s '
    'FOR EACH ROW EXECUTE FUNCTION auditoria_autor()', tabla);
END
$$;

-- Auditoría solo de inserción.
CREATE OR REPLACE FUNCTION auditoria_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auditoria es solo de insercion: % bloqueado', TG_OP;
END
$$;

CREATE TRIGGER auditoria_inmutable BEFORE UPDATE OR DELETE ON "auditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_inmutable();
CREATE TRIGGER auditoria_inmutable_truncate BEFORE TRUNCATE ON "auditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_inmutable();

-- Sin políticas: la Data API de Supabase (anon/authenticated) no la ve. El dueño (app) sí.
ALTER TABLE "auditoria" ENABLE ROW LEVEL SECURITY;

-- Tablas auditadas en v1 (seguridad). Rentas: solo autoría (D3).
SELECT auditoria_habilitar('usuarios');
SELECT auditoria_habilitar('roles');
SELECT auditoria_habilitar('oficinas');
SELECT auditoria_habilitar('niveles');
SELECT auditoria_habilitar('rol_nivel', ARRAY['rolId', 'nivelId']);

SELECT auditoria_habilitar_autor('usuarios');
SELECT auditoria_habilitar_autor('roles');
SELECT auditoria_habilitar_autor('oficinas');
SELECT auditoria_habilitar_autor('contribuyentes');
SELECT auditoria_habilitar_autor('predios');
SELECT auditoria_habilitar_autor('vehiculos');
SELECT auditoria_habilitar_autor('cuenta_corriente');
SELECT auditoria_habilitar_autor('pagos');
SELECT auditoria_habilitar_autor('convenios');
SELECT auditoria_habilitar_autor('valores_cab');
SELECT auditoria_habilitar_autor('coactivo_exp');
SELECT auditoria_habilitar_autor('licencias');
