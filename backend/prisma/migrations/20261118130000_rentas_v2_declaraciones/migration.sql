-- Rentas v2, Fase 4 (specs/rentas-nucleo-v2.md): DJ presentada con un anexo por predio (J01–J17,
-- R03, R04), sin liquidar. Solo crea tablas: las DJ de v1 (declaraciones_juradas, con snapshot)
-- no se convierten (decisión 7) y siguen funcionando hasta que la Fase 5 liquide con estas.

-- CreateEnum
CREATE TYPE "EstadoDj" AS ENUM ('PENDIENTE', 'EN_REVISION', 'LIQUIDADA', 'ANULADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "dj_presentadas" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "motivo" VARCHAR(20) NOT NULL,
    "subMotivo" VARCHAR(20),
    "tipo" VARCHAR(20) NOT NULL,
    "numeroFormulario" VARCHAR(20),
    "folios" INTEGER,
    "fechaPresentacion" DATE NOT NULL,
    "persona" JSONB NOT NULL,
    "estado" "EstadoDj" NOT NULL DEFAULT 'PENDIENTE',
    "observacion" VARCHAR(250),
    "djPrevioId" INTEGER,
    "anuladaMotivo" VARCHAR(250),
    "anuladaPorId" INTEGER,
    "anuladaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creadoPorId" INTEGER,
    "modificadoPorId" INTEGER,

    CONSTRAINT "dj_presentadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dj_anexos" (
    "id" SERIAL NOT NULL,
    "djId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "predioId" INTEGER NOT NULL,
    "predioNuevo" BOOLEAN NOT NULL DEFAULT false,
    "subMotivo" VARCHAR(20),
    "condicion" VARCHAR(20) NOT NULL,
    "porcentaje" DECIMAL(6,2) NOT NULL,
    "fechaAdquisicion" DATE,
    "fechaDocumento" DATE,
    "fechaDescargo" DATE,
    "anioAfectacion" INTEGER NOT NULL,
    "fechaAfectacionArbitrios" DATE NOT NULL,
    "valorTransferencia" DECIMAL(14,2),
    "moneda" VARCHAR(3),
    "partidaRegistral" VARCHAR(30),
    "areaTerreno" DECIMAL(12,2) NOT NULL,
    "areaComun" DECIMAL(12,2),
    "numeroPisos" INTEGER,
    "observacion" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dj_anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dj_niveles" (
    "id" SERIAL NOT NULL,
    "anexoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "nivel" VARCHAR(10) NOT NULL,
    "anioConstruccion" INTEGER,
    "mesConstruccion" INTEGER,
    "clasificacion" VARCHAR(30) NOT NULL,
    "material" VARCHAR(20) NOT NULL,
    "estadoConservacion" VARCHAR(20) NOT NULL,
    "categorias" VARCHAR(7) NOT NULL,
    "areaPropia" DECIMAL(12,2) NOT NULL,
    "areaComun" DECIMAL(12,2),
    "participacion" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dj_niveles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dj_obras" (
    "id" SERIAL NOT NULL,
    "anexoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" VARCHAR(120) NOT NULL,
    "unidad" VARCHAR(10),
    "cantidad" DECIMAL(12,2) NOT NULL,
    "largo" DECIMAL(10,2),
    "ancho" DECIMAL(10,2),
    "alto" DECIMAL(10,2),
    "anioConstruccion" INTEGER,
    "material" VARCHAR(20),
    "estadoConservacion" VARCHAR(20),
    "valorDeclarado" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dj_obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dj_usos" (
    "id" SERIAL NOT NULL,
    "anexoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "uso" VARCHAR(10) NOT NULL,
    "subUso" VARCHAR(20),
    "inquilino" VARCHAR(120),
    "area" DECIMAL(12,2) NOT NULL,
    "frontis" DECIMAL(10,2),
    "participacion" DECIMAL(6,2),
    "fechaInicio" DATE,
    "fechaFin" DATE,
    "predominante" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dj_usos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dj_aranceles_rusticos" (
    "id" SERIAL NOT NULL,
    "anexoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "categoria" VARCHAR(20) NOT NULL,
    "clasificacion" VARCHAR(20),
    "hectareas" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dj_aranceles_rusticos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dj_documentos" (
    "id" SERIAL NOT NULL,
    "djId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "numero" VARCHAR(40),
    "fecha" DATE,
    "observacion" VARCHAR(250),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dj_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dj_adquirientes" (
    "id" SERIAL NOT NULL,
    "anexoId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "rol" VARCHAR(15) NOT NULL,
    "tipoPersona" "TipoPersona" NOT NULL DEFAULT 'NATURAL',
    "tipoDoc" VARCHAR(20),
    "numDoc" VARCHAR(20),
    "nombreCompleto" VARCHAR(120) NOT NULL,
    "direccion" VARCHAR(250),
    "documentoTransferencia" VARCHAR(20),
    "personaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dj_adquirientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dj_presentadas_contribuyenteId_idx" ON "dj_presentadas"("contribuyenteId");

-- CreateIndex
CREATE INDEX "dj_presentadas_estado_idx" ON "dj_presentadas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "dj_presentadas_anio_numero_key" ON "dj_presentadas"("anio", "numero");

-- CreateIndex
CREATE INDEX "dj_anexos_predioId_idx" ON "dj_anexos"("predioId");

-- CreateIndex
CREATE UNIQUE INDEX "dj_anexos_djId_numero_key" ON "dj_anexos"("djId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "dj_anexos_djId_predioId_key" ON "dj_anexos"("djId", "predioId");

-- CreateIndex
CREATE INDEX "dj_niveles_anexoId_idx" ON "dj_niveles"("anexoId");

-- CreateIndex
CREATE INDEX "dj_obras_anexoId_idx" ON "dj_obras"("anexoId");

-- CreateIndex
CREATE INDEX "dj_usos_anexoId_idx" ON "dj_usos"("anexoId");

-- CreateIndex
CREATE INDEX "dj_aranceles_rusticos_anexoId_idx" ON "dj_aranceles_rusticos"("anexoId");

-- CreateIndex
CREATE INDEX "dj_documentos_djId_idx" ON "dj_documentos"("djId");

-- CreateIndex
CREATE INDEX "dj_adquirientes_anexoId_idx" ON "dj_adquirientes"("anexoId");

-- CreateIndex
CREATE INDEX "dj_adquirientes_personaId_idx" ON "dj_adquirientes"("personaId");

-- AddForeignKey
ALTER TABLE "dj_presentadas" ADD CONSTRAINT "dj_presentadas_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_presentadas" ADD CONSTRAINT "dj_presentadas_djPrevioId_fkey" FOREIGN KEY ("djPrevioId") REFERENCES "dj_presentadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_presentadas" ADD CONSTRAINT "dj_presentadas_anuladaPorId_fkey" FOREIGN KEY ("anuladaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_presentadas" ADD CONSTRAINT "dj_presentadas_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_presentadas" ADD CONSTRAINT "dj_presentadas_modificadoPorId_fkey" FOREIGN KEY ("modificadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_anexos" ADD CONSTRAINT "dj_anexos_djId_fkey" FOREIGN KEY ("djId") REFERENCES "dj_presentadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_anexos" ADD CONSTRAINT "dj_anexos_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_niveles" ADD CONSTRAINT "dj_niveles_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "dj_anexos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_obras" ADD CONSTRAINT "dj_obras_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "dj_anexos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_usos" ADD CONSTRAINT "dj_usos_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "dj_anexos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_aranceles_rusticos" ADD CONSTRAINT "dj_aranceles_rusticos_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "dj_anexos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_documentos" ADD CONSTRAINT "dj_documentos_djId_fkey" FOREIGN KEY ("djId") REFERENCES "dj_presentadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_adquirientes" ADD CONSTRAINT "dj_adquirientes_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "dj_anexos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dj_adquirientes" ADD CONSTRAINT "dj_adquirientes_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "contribuyentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Auditoría: cambios de la DJ y de todo lo que declara; autor en la cabecera.
SELECT auditoria_habilitar('dj_presentadas');
SELECT auditoria_habilitar('dj_anexos');
SELECT auditoria_habilitar('dj_niveles');
SELECT auditoria_habilitar('dj_obras');
SELECT auditoria_habilitar('dj_usos');
SELECT auditoria_habilitar('dj_aranceles_rusticos');
SELECT auditoria_habilitar('dj_documentos');
SELECT auditoria_habilitar('dj_adquirientes');
SELECT auditoria_habilitar_autor('dj_presentadas');
