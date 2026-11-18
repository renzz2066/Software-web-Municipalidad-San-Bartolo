-- Rentas v2, Fase 3 (specs/rentas-nucleo-v2.md): predio maestro (R01–R06).
-- Decisión 7: los datos actuales se CONVIERTEN, no se borran.
--   * Cada predio con ubicación apunta a una dirección única (D01). Si su dirección ya existe
--     (p. ej. la creó el domicilio de su dueño en la Fase 2) se reusa; si no, se crea. La clave se
--     arma igual que backend/src/direcciones/direccion.reglas.ts (componentes ordenados por código).
--     zonaId…referencia del predio se quedan como copia: los leen el cálculo, caja y valores.
--   * Titulares: la condición de propiedad (R05) sale de cuántos titulares vigentes hay
--     (uno → PROPIETARIO_UNICO, varios → CONDOMINIO; una sucesión → SUCESION_INDIVISA).
--   * Titulares dados de baja: la fecha en que dejaron de serlo se toma de la primera DJ del predio
--     cuya foto (snapshot) ya no los incluye. Si no hay DJ que lo muestre, queda sin fecha.

-- ============================================================
-- A. Estructura nueva
-- ============================================================
CREATE TYPE "TipoPredio" AS ENUM ('URBANO', 'RUSTICO');

ALTER TABLE "predio_contribuyente"
ADD COLUMN "condicion" VARCHAR(20),
ADD COLUMN "fechaFin" DATE;

ALTER TABLE "predios"
ADD COLUMN "tipo" "TipoPredio" NOT NULL DEFAULT 'URBANO',
ADD COLUMN "nombre" VARCHAR(120),
ADD COLUMN "direccionId" INTEGER,
ADD COLUMN "latitud" DECIMAL(9,6),
ADD COLUMN "longitud" DECIMAL(9,6),
ADD COLUMN "linderoFrenteMetros" DECIMAL(10,2),
ADD COLUMN "linderoFrenteColindante" VARCHAR(120),
ADD COLUMN "linderoDerechaMetros" DECIMAL(10,2),
ADD COLUMN "linderoDerechaColindante" VARCHAR(120),
ADD COLUMN "linderoIzquierdaMetros" DECIMAL(10,2),
ADD COLUMN "linderoIzquierdaColindante" VARCHAR(120),
ADD COLUMN "linderoFondoMetros" DECIMAL(10,2),
ADD COLUMN "linderoFondoColindante" VARCHAR(120),
ADD COLUMN "frecuenciaBarrido" VARCHAR(20),
ADD COLUMN "ubicacionParque" VARCHAR(20),
ADD COLUMN "frontis" DECIMAL(10,2);

CREATE TABLE "predio_beneficios" (
    "id" SERIAL NOT NULL,
    "predioId" INTEGER NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
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

    CONSTRAINT "predio_beneficios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "predio_beneficios_predioId_idx" ON "predio_beneficios"("predioId");
CREATE INDEX "predios_direccionId_idx" ON "predios"("direccionId");
ALTER TABLE "predios" ADD CONSTRAINT "predios_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "direcciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "predio_beneficios" ADD CONSTRAINT "predio_beneficios_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- B. Conversión (decisión 7)
-- ============================================================

-- B1. Dirección única de cada predio. El predio está siempre en el distrito: ubigeo de la muni.
CREATE TEMP TABLE "_ubicacion" AS
SELECT p."id" AS pid,
       COALESCE((SELECT r."valor" #>> '{}' FROM "reglas_muni" r WHERE r."clave" = 'muni.ubigeo'), '150129') AS ubigeo,
       p."zonaId", p."urbanizacionId", p."viaId",
       NULLIF(UPPER(regexp_replace(TRIM(p."numero"), '\s+', ' ', 'g')), '') AS numero,
       NULLIF(UPPER(regexp_replace(TRIM(p."manzana"), '\s+', ' ', 'g')), '') AS mz,
       NULLIF(UPPER(regexp_replace(TRIM(p."lote"), '\s+', ' ', 'g')), '') AS lt,
       NULLIF(UPPER(regexp_replace(TRIM(p."referencia"), '\s+', ' ', 'g')), '') AS referencia
FROM "predios" p
WHERE p."zonaId" IS NOT NULL OR p."urbanizacionId" IS NOT NULL OR p."viaId" IS NOT NULL
   OR COALESCE(TRIM(p."numero"), '') <> '' OR COALESCE(TRIM(p."manzana"), '') <> '' OR COALESCE(TRIM(p."lote"), '') <> '';

ALTER TABLE "_ubicacion" ADD COLUMN clave TEXT;
UPDATE "_ubicacion" SET clave = ubigeo || '|' || COALESCE("zonaId"::text, '') || '|' || COALESCE("urbanizacionId"::text, '')
                                || '|' || COALESCE("viaId"::text, '') || '|'
                                || concat_ws(';', 'LT=' || lt, 'MZ=' || mz, 'NUMERO=' || numero);

-- Solo se crean las que faltan; las que ya existen (domicilios) se reusan tal cual.
CREATE TEMP TABLE "_nuevas" (id INTEGER, clave TEXT);
WITH creadas AS (
    INSERT INTO "direcciones" ("ubigeo", "zonaId", "urbanizacionId", "viaId", "direccion", "clave", "referencia", "updatedAt")
    SELECT d.ubigeo, d."zonaId", d."urbanizacionId", d."viaId",
           LEFT(concat_ws(', ',
                COALESCE(NULLIF(concat_ws(' ',
                    regexp_replace(TRIM(v."tipoVia" || ' ' || v."nombre"), '\s+', ' ', 'g'),
                    'N° ' || d.numero, 'Mz. ' || d.mz, 'Lt. ' || d.lt,
                    u."nombre"), ''), z."nombre"),
                ub."distrito"), 250),
           d.clave,
           (SELECT LEFT(string_agg(DISTINCT x.referencia, ' / '), 250) FROM "_ubicacion" x WHERE x.clave = d.clave),
           CURRENT_TIMESTAMP
    FROM (SELECT DISTINCT ON (clave) * FROM "_ubicacion" ORDER BY clave, pid) d
    LEFT JOIN "vias" v ON v."id" = d."viaId"
    LEFT JOIN "urbanizaciones" u ON u."id" = d."urbanizacionId"
    LEFT JOIN "zonas" z ON z."id" = d."zonaId"
    LEFT JOIN "ubigeos" ub ON ub."codigo" = d.ubigeo
    ON CONFLICT ("clave") DO NOTHING
    RETURNING "id", "clave"
)
INSERT INTO "_nuevas" SELECT "id", "clave" FROM creadas;

INSERT INTO "direccion_componentes" ("direccionId", "orden", "componente", "valor", "updatedAt")
SELECT n.id, ROW_NUMBER() OVER (PARTITION BY n.id ORDER BY k.o), k.componente, k.valor, CURRENT_TIMESTAMP
FROM "_nuevas" n
JOIN (SELECT DISTINCT ON (clave) * FROM "_ubicacion" ORDER BY clave, pid) d ON d.clave = n.clave
CROSS JOIN LATERAL (VALUES (1, 'NUMERO', d.numero), (2, 'MZ', d.mz), (3, 'LT', d.lt)) AS k(o, componente, valor)
WHERE k.valor IS NOT NULL;

UPDATE "predios" p SET "direccionId" = di."id"
FROM "_ubicacion" d
JOIN "direcciones" di ON di."clave" = d.clave
WHERE d.pid = p."id";

DROP TABLE "_nuevas";
DROP TABLE "_ubicacion";

-- B2. Condición de propiedad de los titulares vigentes (R05).
UPDATE "predio_contribuyente" pc SET "condicion" = CASE
        WHEN c."tipoPersona" = 'SUCESION' THEN 'SUCESION_INDIVISA'
        WHEN (SELECT count(*) FROM "predio_contribuyente" o WHERE o."predioId" = pc."predioId" AND o."estado" = 'ACTIVO') > 1 THEN 'CONDOMINIO'
        ELSE 'PROPIETARIO_UNICO'
    END
FROM "contribuyentes" c
WHERE c."id" = pc."contribuyenteId" AND pc."estado" = 'ACTIVO';

-- B3. Hasta cuándo fue titular quien ya no lo es: la primera DJ posterior que no lo muestra.
UPDATE "predio_contribuyente" pc SET "fechaFin" = (
    SELECT COALESCE(dj."fechaHecho", dj."fecha")
    FROM "declaraciones_juradas" dj
    WHERE dj."predioId" = pc."predioId"
      AND dj."fecha" >= COALESCE(pc."fechaAdquisicion", DATE '1900-01-01')
      AND jsonb_typeof(dj."snapshot" -> 'contribuyentes') = 'array'
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(dj."snapshot" -> 'contribuyentes') e
          WHERE (e -> 'contribuyente' ->> 'id')::int = pc."contribuyenteId"
      )
    ORDER BY dj."fecha", dj."id"
    LIMIT 1
)
WHERE pc."estado" = 'BAJA';

-- ============================================================
-- C. Auditoría (los cambios de predios y titulares ya se auditan desde v1)
-- ============================================================
SELECT auditoria_habilitar('predio_beneficios');
