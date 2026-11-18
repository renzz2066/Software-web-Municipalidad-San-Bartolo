-- Rentas v2, Fase 2 (specs/rentas-nucleo-v2.md): direcciones únicas (D01–D05) y domicilio fiscal (P11).
-- Decisión 7: los datos actuales se CONVIERTEN, no se borran. Orden: crear → copiar → quitar.
--   * Cada contribuyente con domicilio estructurado (zona, urbanización, vía, número, Dpto., Mz., Lt.)
--     apunta a una dirección única. Dos personas con el mismo domicilio comparten el registro (D01).
--     La identidad ("clave") es ubigeo|zona|habilitación|vía|componentes ordenados por código, la
--     misma que arma backend/src/direcciones/direccion.reglas.ts.
--   * La literal se arma igual que v1 ("AV LOS PINOS N° 123 Dpto. 2 URB. X, SAN BARTOLO"), así
--     direccionFiscal no cambia: la siguen leyendo caja, valores y estado de cuenta.
--   * La referencia pasa a la dirección (D05). Si dos personas del mismo domicilio tenían referencias
--     distintas, se juntan con " / " para no perder ninguna.
--   * Sin domicilio estructurado (texto heredado de SIMUN): el texto y la referencia pasan a
--     domicilioTexto, por revisar. El ubigeo se conserva tal cual.

-- ============================================================
-- A. Estructura nueva
-- ============================================================
CREATE TABLE "direcciones" (
    "id" SERIAL NOT NULL,
    "ubigeo" VARCHAR(6) NOT NULL,
    "zonaId" INTEGER,
    "urbanizacionId" INTEGER,
    "viaId" INTEGER,
    "direccion" VARCHAR(250) NOT NULL,
    "clave" TEXT NOT NULL,
    "referencia" VARCHAR(250),
    "latitud" DECIMAL(9,6),
    "longitud" DECIMAL(9,6),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "modificadoPorId" INTEGER,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "direccion_componentes" (
    "id" SERIAL NOT NULL,
    "direccionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "componente" VARCHAR(20) NOT NULL,
    "valor" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direccion_componentes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "direcciones_clave_key" ON "direcciones"("clave");
CREATE INDEX "direcciones_direccion_idx" ON "direcciones"("direccion");
CREATE INDEX "direcciones_zonaId_idx" ON "direcciones"("zonaId");
CREATE INDEX "direcciones_urbanizacionId_idx" ON "direcciones"("urbanizacionId");
CREATE INDEX "direcciones_viaId_idx" ON "direcciones"("viaId");
CREATE UNIQUE INDEX "direccion_componentes_direccionId_componente_key" ON "direccion_componentes"("direccionId", "componente");

ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_urbanizacionId_fkey" FOREIGN KEY ("urbanizacionId") REFERENCES "urbanizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_viaId_fkey" FOREIGN KEY ("viaId") REFERENCES "vias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "direccion_componentes" ADD CONSTRAINT "direccion_componentes_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "direcciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contribuyentes"
ADD COLUMN "direccionId" INTEGER,
ADD COLUMN "domicilioTexto" VARCHAR(250);

CREATE INDEX "contribuyentes_direccionId_idx" ON "contribuyentes"("direccionId");
ALTER TABLE "contribuyentes" ADD CONSTRAINT "contribuyentes_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "direcciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- B. Conversión del domicilio actual (decisión 7)
-- ============================================================

-- Domicilio de cada persona, normalizado como lo guarda el servicio (mayúsculas, un solo espacio).
-- interior era "Dpto." en v1 (INTCLI): pasa al componente DPTO. Sin ubigeo se toma el valor por
-- defecto de la columna (el de la muni, regla muni.ubigeo).
CREATE TEMP TABLE "_domicilio" AS
SELECT c."id" AS cid,
       COALESCE(NULLIF(TRIM(c."ubigeo"), ''), '150129') AS ubigeo,
       c."zonaId", c."urbanizacionId", c."viaId",
       NULLIF(UPPER(regexp_replace(TRIM(c."numero"), '\s+', ' ', 'g')), '') AS numero,
       NULLIF(UPPER(regexp_replace(TRIM(c."interior"), '\s+', ' ', 'g')), '') AS dpto,
       NULLIF(UPPER(regexp_replace(TRIM(c."manzana"), '\s+', ' ', 'g')), '') AS mz,
       NULLIF(UPPER(regexp_replace(TRIM(c."lote"), '\s+', ' ', 'g')), '') AS lt,
       NULLIF(UPPER(regexp_replace(TRIM(c."referencia"), '\s+', ' ', 'g')), '') AS referencia
FROM "contribuyentes" c;

ALTER TABLE "_domicilio" ADD COLUMN estructurado BOOLEAN, ADD COLUMN clave TEXT;

UPDATE "_domicilio" SET estructurado = ("zonaId" IS NOT NULL OR "urbanizacionId" IS NOT NULL OR "viaId" IS NOT NULL
                                         OR numero IS NOT NULL OR dpto IS NOT NULL OR mz IS NOT NULL OR lt IS NOT NULL);

-- Componentes ordenados por código (DPTO < LT < MZ < NUMERO), como claveDireccion() en el backend.
UPDATE "_domicilio" SET clave = ubigeo || '|' || COALESCE("zonaId"::text, '') || '|' || COALESCE("urbanizacionId"::text, '')
                                || '|' || COALESCE("viaId"::text, '') || '|'
                                || concat_ws(';', 'DPTO=' || dpto, 'LT=' || lt, 'MZ=' || mz, 'NUMERO=' || numero)
WHERE estructurado;

-- Una dirección por clave. Literal: vía, N°, Dpto., Mz., Lt., habilitación y distrito (formato v1).
-- Si solo había sector, la literal lleva su nombre para no quedar vacía.
INSERT INTO "direcciones" ("ubigeo", "zonaId", "urbanizacionId", "viaId", "direccion", "clave", "referencia", "updatedAt")
SELECT d.ubigeo, d."zonaId", d."urbanizacionId", d."viaId",
       LEFT(concat_ws(', ',
            COALESCE(NULLIF(concat_ws(' ',
                regexp_replace(TRIM(v."tipoVia" || ' ' || v."nombre"), '\s+', ' ', 'g'),
                'N° ' || d.numero, 'Dpto. ' || d.dpto, 'Mz. ' || d.mz, 'Lt. ' || d.lt,
                u."nombre"), ''), z."nombre"),
            ub."distrito"), 250),
       d.clave,
       (SELECT LEFT(string_agg(DISTINCT x.referencia, ' / '), 250) FROM "_domicilio" x WHERE x.clave = d.clave),
       CURRENT_TIMESTAMP
FROM (SELECT DISTINCT ON (clave) * FROM "_domicilio" WHERE estructurado ORDER BY clave, cid) d
LEFT JOIN "vias" v ON v."id" = d."viaId"
LEFT JOIN "urbanizaciones" u ON u."id" = d."urbanizacionId"
LEFT JOIN "zonas" z ON z."id" = d."zonaId"
LEFT JOIN "ubigeos" ub ON ub."codigo" = d.ubigeo;

INSERT INTO "direccion_componentes" ("direccionId", "orden", "componente", "valor", "updatedAt")
SELECT di."id", ROW_NUMBER() OVER (PARTITION BY di."id" ORDER BY k.o), k.componente, k.valor, CURRENT_TIMESTAMP
FROM "direcciones" di
JOIN (SELECT DISTINCT ON (clave) * FROM "_domicilio" WHERE estructurado ORDER BY clave, cid) d ON d.clave = di."clave"
CROSS JOIN LATERAL (VALUES (1, 'NUMERO', d.numero), (2, 'DPTO', d.dpto), (3, 'MZ', d.mz), (4, 'LT', d.lt)) AS k(o, componente, valor)
WHERE k.valor IS NOT NULL;

-- Cada persona apunta a su dirección; el ubigeo queda igual al de la dirección.
UPDATE "contribuyentes" c SET "direccionId" = di."id", "ubigeo" = di."ubigeo"
FROM "_domicilio" d
JOIN "direcciones" di ON di."clave" = d.clave
WHERE d.cid = c."id" AND d.estructurado;

-- direccionFiscal se conserva; solo se llena si estaba vacía (no debería pasar en v1).
UPDATE "contribuyentes" c SET "direccionFiscal" = LEFT(di."direccion", 150)
FROM "direcciones" di
WHERE c."direccionId" = di."id" AND COALESCE(TRIM(c."direccionFiscal"), '') = '';

-- Sin estructura: el texto heredado (y la referencia, si había) queda en domicilioTexto.
UPDATE "contribuyentes" c SET "domicilioTexto" = LEFT(concat_ws(' REF. ', NULLIF(TRIM(c."direccionFiscal"), ''), d.referencia), 250)
FROM "_domicilio" d
WHERE d.cid = c."id" AND NOT d.estructurado
  AND (COALESCE(TRIM(c."direccionFiscal"), '') <> '' OR d.referencia IS NOT NULL);

DROP TABLE "_domicilio";

-- ============================================================
-- C. Se quitan las columnas ya convertidas
-- ============================================================
ALTER TABLE "contribuyentes" DROP CONSTRAINT "contribuyentes_urbanizacionId_fkey";
ALTER TABLE "contribuyentes" DROP CONSTRAINT "contribuyentes_viaId_fkey";
ALTER TABLE "contribuyentes" DROP CONSTRAINT "contribuyentes_zonaId_fkey";
DROP INDEX "contribuyentes_urbanizacionId_idx";
DROP INDEX "contribuyentes_viaId_idx";
DROP INDEX "contribuyentes_zonaId_idx";

ALTER TABLE "contribuyentes"
DROP COLUMN "zonaId",
DROP COLUMN "urbanizacionId",
DROP COLUMN "viaId",
DROP COLUMN "numero",
DROP COLUMN "interior",
DROP COLUMN "manzana",
DROP COLUMN "lote",
DROP COLUMN "referencia";

-- ============================================================
-- D. Auditoría: cambios y autor de las direcciones (como contribuyentes)
-- ============================================================
SELECT auditoria_habilitar('direcciones');
SELECT auditoria_habilitar('direccion_componentes');
SELECT auditoria_habilitar_autor('direcciones');
