-- Rentas v2, Fase 1 (specs/rentas-nucleo-v2.md): personas al modelo Lurín (P01–P18).
-- Decisión 7: los datos actuales se CONVIERTEN, no se borran. Orden: crear → copiar → quitar.
--   * Documento, contactos, cónyuge y representante pasan tal cual a sus tablas.
--   * Jurídica: el nombre pasa a razón social.
--   * Natural y sucesión: el nombre se separa como "paterno materno nombres" (orden de la consulta
--     de DNI) y queda por revisar (nombreRevisado = false → PENDIENTE). nombreCompleto no cambia
--     hasta que alguien guarde la ficha revisada.
--   * Estados (decisión 1): ACTIVO → HABILITADO (o PENDIENTE si falta revisar el nombre);
--     INACTIVO y BAJA → INHABILITADO.

-- ============================================================
-- A. Estructura nueva
-- ============================================================
CREATE TYPE "EstadoPersona" AS ENUM ('HABILITADO', 'INHABILITADO', 'PENDIENTE');

CREATE TABLE "contribuyente_documentos" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipoDoc" VARCHAR(20) NOT NULL,
    "numDoc" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribuyente_documentos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contribuyente_contactos" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "valor" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribuyente_contactos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contribuyente_relacionados" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "tipoDoc" VARCHAR(20),
    "numDoc" VARCHAR(20),
    "nombreCompleto" VARCHAR(120) NOT NULL,
    "direccion" VARCHAR(150),
    "personaId" INTEGER,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribuyente_relacionados_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contribuyente_beneficios" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "baseLegal" VARCHAR(150) NOT NULL,
    "expediente" VARCHAR(30),
    "resolucion" VARCHAR(40) NOT NULL,
    "fechaResolucion" DATE NOT NULL,
    "anioDesde" INTEGER NOT NULL,
    "anioHasta" INTEGER,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "observacion" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribuyente_beneficios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contribuyente_documentos_contribuyenteId_idx" ON "contribuyente_documentos"("contribuyenteId");
CREATE INDEX "contribuyente_documentos_numDoc_idx" ON "contribuyente_documentos"("numDoc");
CREATE UNIQUE INDEX "contribuyente_documentos_tipoDoc_numDoc_key" ON "contribuyente_documentos"("tipoDoc", "numDoc");
CREATE INDEX "contribuyente_contactos_contribuyenteId_idx" ON "contribuyente_contactos"("contribuyenteId");
CREATE INDEX "contribuyente_relacionados_contribuyenteId_idx" ON "contribuyente_relacionados"("contribuyenteId");
CREATE INDEX "contribuyente_relacionados_personaId_idx" ON "contribuyente_relacionados"("personaId");
CREATE INDEX "contribuyente_beneficios_contribuyenteId_idx" ON "contribuyente_beneficios"("contribuyenteId");

ALTER TABLE "contribuyente_documentos" ADD CONSTRAINT "contribuyente_documentos_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contribuyente_contactos" ADD CONSTRAINT "contribuyente_contactos_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contribuyente_relacionados" ADD CONSTRAINT "contribuyente_relacionados_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contribuyente_relacionados" ADD CONSTRAINT "contribuyente_relacionados_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "contribuyentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contribuyente_beneficios" ADD CONSTRAINT "contribuyente_beneficios_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contribuyentes"
ADD COLUMN "apellidoPaterno" VARCHAR(60),
ADD COLUMN "apellidoMaterno" VARCHAR(60),
ADD COLUMN "nombres" VARCHAR(80),
ADD COLUMN "razonSocial" VARCHAR(120),
ADD COLUMN "tipoSucesion" VARCHAR(20),
ADD COLUMN "nombreRevisado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "fechaNacimiento" DATE,
ADD COLUMN "dniCausante" VARCHAR(8),
ADD COLUMN "perfilCumplimiento" VARCHAR(20),
ADD COLUMN "perfilCobranza" VARCHAR(20),
ADD COLUMN "clasificacion" VARCHAR(20),
ADD COLUMN "sinDocumentoMotivo" VARCHAR(250),
ADD COLUMN "excepcionAprobadaPorId" INTEGER,
ADD COLUMN "excepcionAprobadaAt" TIMESTAMP(3),
ADD COLUMN "motivoEstado" VARCHAR(250),
ADD COLUMN "estadoPersona" "EstadoPersona" NOT NULL DEFAULT 'HABILITADO',
ALTER COLUMN "tipoDoc" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "numDoc" DROP NOT NULL;

ALTER TABLE "contribuyentes" ADD CONSTRAINT "contribuyentes_excepcionAprobadaPorId_fkey" FOREIGN KEY ("excepcionAprobadaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La unicidad del documento pasa a contribuyente_documentos (P06).
DROP INDEX "contribuyentes_numDoc_key";
CREATE INDEX "contribuyentes_numDoc_idx" ON "contribuyentes"("numDoc");

-- ============================================================
-- B. Conversión de los datos actuales (decisión 7)
-- ============================================================

-- Documento principal: hoy era único en toda la base, así que no choca con el nuevo índice.
INSERT INTO "contribuyente_documentos" ("contribuyenteId", "orden", "tipoDoc", "numDoc", "updatedAt")
SELECT "id", 1, "tipoDoc", "numDoc", CURRENT_TIMESTAMP
FROM "contribuyentes"
WHERE COALESCE(TRIM("numDoc"), '') <> '';

-- Contactos: correo, teléfono (se asume de casa) y celular, en ese orden.
INSERT INTO "contribuyente_contactos" ("contribuyenteId", "orden", "tipo", "valor", "updatedAt")
SELECT "contribuyenteId", ROW_NUMBER() OVER (PARTITION BY "contribuyenteId" ORDER BY o), "tipo", "valor", CURRENT_TIMESTAMP
FROM (
    SELECT "id" AS "contribuyenteId", 1 AS o, 'EMAIL' AS "tipo", TRIM("email") AS "valor" FROM "contribuyentes" WHERE COALESCE(TRIM("email"), '') <> ''
    UNION ALL
    SELECT "id", 2, 'TELEFONO_CASA', TRIM("telefono") FROM "contribuyentes" WHERE COALESCE(TRIM("telefono"), '') <> ''
    UNION ALL
    SELECT "id", 3, 'CELULAR', TRIM("celular") FROM "contribuyentes" WHERE COALESCE(TRIM("celular"), '') <> ''
) c;

-- Relacionados: cónyuge y representante legal. Si su DNI es de una persona registrada, se enlaza.
INSERT INTO "contribuyente_relacionados" ("contribuyenteId", "orden", "tipo", "tipoDoc", "numDoc", "nombreCompleto", "direccion", "personaId", "updatedAt")
SELECT r."contribuyenteId", ROW_NUMBER() OVER (PARTITION BY r."contribuyenteId" ORDER BY r.o), r."tipo",
       CASE WHEN r."numDoc" IS NULL THEN NULL ELSE 'DNI' END, r."numDoc",
       COALESCE(r."nombre", 'SIN NOMBRE'), r."direccion", p."id", CURRENT_TIMESTAMP
FROM (
    SELECT "id" AS "contribuyenteId", 1 AS o, 'CONYUGE' AS "tipo", NULLIF(TRIM("conyugeNumDoc"), '') AS "numDoc",
           NULLIF(TRIM("conyugeNombre"), '') AS "nombre", NULL::VARCHAR AS "direccion"
    FROM "contribuyentes"
    WHERE COALESCE(TRIM("conyugeNombre"), '') <> '' OR COALESCE(TRIM("conyugeNumDoc"), '') <> ''
    UNION ALL
    SELECT "id", 2, 'REPRESENTANTE_LEGAL', NULLIF(TRIM("representanteNumDoc"), ''),
           NULLIF(TRIM("representanteNombre"), ''), NULLIF(TRIM("representanteDireccion"), '')
    FROM "contribuyentes"
    WHERE COALESCE(TRIM("representanteNombre"), '') <> '' OR COALESCE(TRIM("representanteNumDoc"), '') <> ''
) r
LEFT JOIN "contribuyentes" p ON p."numDoc" = r."numDoc" AND p."tipoDoc" = 'DNI' AND p."id" <> r."contribuyenteId";

-- Nombres. Jurídica: razón social tal cual.
UPDATE "contribuyentes" SET "razonSocial" = "nombreCompleto" WHERE "tipoPersona" = 'JURIDICA';

-- Natural y sucesión: "paterno materno nombres". En la sucesión se quita antes el prefijo SUC./SUCESIÓN.
WITH partes AS (
    SELECT "id",
           regexp_split_to_array(
               TRIM(regexp_replace(
                   CASE WHEN "tipoPersona" = 'SUCESION'
                        THEN regexp_replace(UPPER("nombreCompleto"), '^\s*(SUC\.?|SUCESI[OÓ]N)(\s+INDIVISA)?\s+', '')
                        ELSE "nombreCompleto" END,
                   '\s+', ' ', 'g')),
               ' ') AS w
    FROM "contribuyentes"
    WHERE "tipoPersona" IN ('NATURAL', 'SUCESION') AND TRIM("nombreCompleto") <> ''
)
UPDATE "contribuyentes" c SET
    "apellidoPaterno" = LEFT(p.w[1], 60),
    "apellidoMaterno" = CASE WHEN array_length(p.w, 1) >= 3 THEN LEFT(p.w[2], 60) END,
    "nombres" = CASE
        WHEN array_length(p.w, 1) >= 3 THEN LEFT(array_to_string(p.w[3:], ' '), 80)
        WHEN array_length(p.w, 1) = 2 THEN LEFT(p.w[2], 80)
    END,
    "nombreRevisado" = false
FROM partes p
WHERE c."id" = p."id";

UPDATE "contribuyentes" SET "tipoSucesion" = 'INDIVISA' WHERE "tipoPersona" = 'SUCESION';

-- Estados (decisión 1). INACTIVO se saltaba la regla de la deuda; ahora es INHABILITADO como BAJA.
UPDATE "contribuyentes" SET
    "estadoPersona" = (CASE
        WHEN "estado" IN ('INACTIVO', 'BAJA') THEN 'INHABILITADO'
        WHEN "nombreRevisado" = false THEN 'PENDIENTE'
        ELSE 'HABILITADO'
    END)::"EstadoPersona",
    "motivoEstado" = CASE WHEN "estado" IN ('INACTIVO', 'BAJA') THEN 'Convertido de v1 (estado ' || "estado"::text || ')' END;

-- ============================================================
-- C. Se quitan las columnas ya convertidas
-- ============================================================
ALTER TABLE "contribuyentes"
DROP COLUMN "telefono",
DROP COLUMN "celular",
DROP COLUMN "email",
DROP COLUMN "conyugeNombre",
DROP COLUMN "conyugeNumDoc",
DROP COLUMN "representanteNombre",
DROP COLUMN "representanteNumDoc",
DROP COLUMN "representanteDireccion",
DROP COLUMN "estado";

ALTER TABLE "contribuyentes" RENAME COLUMN "estadoPersona" TO "estado";
CREATE INDEX "contribuyentes_estado_idx" ON "contribuyentes"("estado");

-- ============================================================
-- D. Auditoría (P13): las listas de la persona también quedan registradas
-- ============================================================
SELECT auditoria_habilitar('contribuyente_documentos');
SELECT auditoria_habilitar('contribuyente_contactos');
SELECT auditoria_habilitar('contribuyente_relacionados');
SELECT auditoria_habilitar('contribuyente_beneficios');
