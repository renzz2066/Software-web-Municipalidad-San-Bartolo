-- Crear tabla roles (ref SIMUN: roles.dbf) y relacionarla con usuarios.
-- Migración con backfill: no se pierde ningún usuario existente.

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- Seed base de roles
INSERT INTO "roles" ("nombre", "descripcion", "updatedAt") VALUES
    ('ADMIN', 'Acceso total al sistema', CURRENT_TIMESTAMP),
    ('SUPERVISOR', 'Supervisión y consulta de operaciones', CURRENT_TIMESTAMP),
    ('CAJERO', 'Operación de caja y cobros', CURRENT_TIMESTAMP);

-- Nuevas columnas en usuarios
ALTER TABLE "usuarios" ADD COLUMN "nombres" VARCHAR(100);
ALTER TABLE "usuarios" ADD COLUMN "apellidos" VARCHAR(100);
ALTER TABLE "usuarios" ADD COLUMN "rolId" INTEGER;

-- Backfill: nombre -> nombres, enum rol -> roles.id
UPDATE "usuarios" SET "nombres" = "nombre", "apellidos" = '';
UPDATE "usuarios" SET "rolId" = (SELECT "id" FROM "roles" WHERE "roles"."nombre" = "usuarios"."rol"::text);

-- NOT NULL (todo usuario existente ya tiene valores por el backfill)
ALTER TABLE "usuarios" ALTER COLUMN "nombres" SET NOT NULL;
ALTER TABLE "usuarios" ALTER COLUMN "apellidos" SET NOT NULL;
ALTER TABLE "usuarios" ALTER COLUMN "rolId" SET NOT NULL;

-- Índices y FK (Restrict: no se elimina un rol con usuarios asignados)
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");
CREATE INDEX "usuarios_rolId_idx" ON "usuarios"("rolId");
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Soltar columnas y tipo viejos
ALTER TABLE "usuarios" DROP COLUMN "nombre";
ALTER TABLE "usuarios" DROP COLUMN "rol";
DROP TYPE "Rol";
