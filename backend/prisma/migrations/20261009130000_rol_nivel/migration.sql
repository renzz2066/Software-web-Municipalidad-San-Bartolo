-- Crear tabla rol_nivel (asignación de niveles a roles).
-- Solo crea estructura; no toca datos existentes.

-- CreateTable
CREATE TABLE "rol_nivel" (
    "rolId" INTEGER NOT NULL,
    "nivelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rol_nivel_pkey" PRIMARY KEY ("rolId", "nivelId")
);

-- FKs: al borrar un rol se van sus accesos; un nivel asignado no se elimina
ALTER TABLE "rol_nivel" ADD CONSTRAINT "rol_nivel_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rol_nivel" ADD CONSTRAINT "rol_nivel_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "niveles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
