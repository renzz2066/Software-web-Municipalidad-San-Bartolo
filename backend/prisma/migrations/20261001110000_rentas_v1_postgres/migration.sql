-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'SUPERVISOR', 'CAJERO');

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('NATURAL', 'JURIDICA', 'SUCESION');

-- CreateEnum
CREATE TYPE "EstadoRegistro" AS ENUM ('ACTIVO', 'INACTIVO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('PENDIENTE', 'CANCELADO', 'FRACCIONADO', 'COACTIVO', 'ANULADO', 'EXTORNADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'CHEQUE', 'TARJETA', 'DEPOSITO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoTributo" AS ENUM ('PREDIAL', 'ARBITRIOS', 'VEHICULAR', 'ALCABALA', 'MULTA', 'TUPA', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoValor" AS ENUM ('OP', 'RD');

-- CreateEnum
CREATE TYPE "EstadoValor" AS ENUM ('EMITIDO', 'NOTIFICADO', 'COACTIVO', 'CANCELADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoLicencia" AS ENUM ('VIGENTE', 'VENCIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN');

-- CreateTable
CREATE TABLE "oficinas" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oficinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "usuario" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CAJERO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "oficinaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuarioId" INTEGER,
    "tabla" VARCHAR(60) NOT NULL,
    "accion" "AccionAuditoria" NOT NULL,
    "registroId" VARCHAR(50) NOT NULL,
    "detalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribuyentes" (
    "id" SERIAL NOT NULL,
    "codigoLegacy" VARCHAR(7),
    "tipoPersona" "TipoPersona" NOT NULL DEFAULT 'NATURAL',
    "tipoDoc" VARCHAR(10) NOT NULL,
    "numDoc" VARCHAR(20) NOT NULL,
    "nombreCompleto" VARCHAR(120) NOT NULL,
    "direccionFiscal" VARCHAR(150),
    "ubigeo" VARCHAR(6),
    "telefono" VARCHAR(15),
    "celular" VARCHAR(15),
    "email" VARCHAR(100),
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contribuyentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(5) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zonas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "urbanizaciones" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "urbanizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vias" (
    "id" SERIAL NOT NULL,
    "tipoVia" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predios" (
    "id" SERIAL NOT NULL,
    "codigoLegacy" VARCHAR(7),
    "codigoCatastro" VARCHAR(20),
    "zonaId" INTEGER,
    "urbanizacionId" INTEGER,
    "viaId" INTEGER,
    "numero" VARCHAR(10),
    "manzana" VARCHAR(10),
    "lote" VARCHAR(10),
    "referencia" VARCHAR(150),
    "areaTerreno" DECIMAL(12,2),
    "areaConstruida" DECIMAL(12,2),
    "valorAutovaluo" DECIMAL(14,2),
    "usoPredio" VARCHAR(10),
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predio_contribuyente" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "predioId" INTEGER NOT NULL,
    "porcentaje" DECIMAL(6,2) NOT NULL DEFAULT 100.0,
    "fechaAdquisicion" DATE,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT true,
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "predio_contribuyente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pisos" (
    "id" SERIAL NOT NULL,
    "predioId" INTEGER NOT NULL,
    "nivel" VARCHAR(10) NOT NULL,
    "anioConstruccion" INTEGER,
    "clasificacion" VARCHAR(5),
    "material" VARCHAR(5),
    "estadoConservacion" VARCHAR(5),
    "areaConstruida" DECIMAL(10,2),
    "valorUnitario" DECIMAL(10,2),
    "valorConstruccion" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otras_instalaciones" (
    "id" SERIAL NOT NULL,
    "predioId" INTEGER NOT NULL,
    "pisoId" INTEGER,
    "descripcion" VARCHAR(150) NOT NULL,
    "unidad" VARCHAR(10),
    "cantidad" DECIMAL(10,2),
    "valor" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otras_instalaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculos" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "placa" VARCHAR(15) NOT NULL,
    "marca" VARCHAR(50) NOT NULL,
    "modelo" VARCHAR(80) NOT NULL,
    "anioFabricacion" INTEGER NOT NULL,
    "numMotor" VARCHAR(30),
    "numTarjeta" VARCHAR(20),
    "valorAdquisicion" DECIMAL(12,2),
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'ACTIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehiculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehiculo_detalle_anual" (
    "id" SERIAL NOT NULL,
    "vehiculoId" INTEGER NOT NULL,
    "anioFiscal" INTEGER NOT NULL,
    "baseImponible" DECIMAL(12,2) NOT NULL,
    "impuesto" DECIMAL(12,2) NOT NULL,
    "derechoEmision" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehiculo_detalle_anual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tributos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" "TipoTributo" NOT NULL DEFAULT 'OTRO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tributos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uit" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escala_predial" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "tramo" INTEGER NOT NULL,
    "desdeUit" DECIMAL(8,2) NOT NULL,
    "hastaUit" DECIMAL(8,2),
    "tasa" DECIMAL(6,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escala_predial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas_arbitrios" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "concepto" VARCHAR(30) NOT NULL,
    "tasa" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarifas_arbitrios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tupa" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "glosa" VARCHAR(200) NOT NULL,
    "tasa" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tupa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuenta_corriente" (
    "id" SERIAL NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "predioId" INTEGER,
    "vehiculoId" INTEGER,
    "tributoId" INTEGER NOT NULL,
    "anioFiscal" INTEGER NOT NULL,
    "cuota" INTEGER NOT NULL DEFAULT 0,
    "importe" DECIMAL(12,2) NOT NULL,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reajuste" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mora" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "derechoEmision" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fechaVencimiento" DATE,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuenta_corriente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" SERIAL NOT NULL,
    "cuentaCorrienteId" INTEGER,
    "contribuyenteId" INTEGER NOT NULL,
    "cajeroId" INTEGER NOT NULL,
    "numRecibo" VARCHAR(20) NOT NULL,
    "fechaPago" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importe" DECIMAL(12,2) NOT NULL,
    "moraPagada" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuentoAplicado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "medioPago" "MedioPago" NOT NULL DEFAULT 'EFECTIVO',
    "numOperacion" VARCHAR(30),
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'CANCELADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convenios" (
    "id" SERIAL NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "cuotaInicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "numCuotas" INTEGER NOT NULL,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'FRACCIONADO',
    "creadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convenio_detalle" (
    "id" SERIAL NOT NULL,
    "convenioId" INTEGER NOT NULL,
    "cuentaCorrienteId" INTEGER NOT NULL,
    "cuotaNumero" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "convenio_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valores_cab" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoValor" NOT NULL,
    "anio" INTEGER NOT NULL,
    "numero" VARCHAR(15) NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "predioId" INTEGER,
    "totalDeuda" DECIMAL(12,2) NOT NULL,
    "fechaEmision" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaNotificacion" DATE,
    "estado" "EstadoValor" NOT NULL DEFAULT 'EMITIDO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valores_cab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valores_det" (
    "id" SERIAL NOT NULL,
    "valorId" INTEGER NOT NULL,
    "cuentaCorrienteId" INTEGER NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "mora" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reajuste" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "valores_det_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coactivo_exp" (
    "id" SERIAL NOT NULL,
    "anioExpediente" INTEGER NOT NULL,
    "numExpediente" VARCHAR(15) NOT NULL,
    "valorId" INTEGER,
    "contribuyenteId" INTEGER NOT NULL,
    "ejecutor" VARCHAR(100),
    "auxiliar" VARCHAR(100),
    "estado" "EstadoValor" NOT NULL DEFAULT 'EMITIDO',
    "fechaGeneracion" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coactivo_exp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coactivo_det" (
    "id" SERIAL NOT NULL,
    "expedienteId" INTEGER NOT NULL,
    "cuentaCorrienteId" INTEGER,
    "descripcion" VARCHAR(150) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "coactivo_det_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giros_negocio" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "descripcion" VARCHAR(150) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "giros_negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licencias" (
    "id" SERIAL NOT NULL,
    "numeroLicencia" VARCHAR(20) NOT NULL,
    "contribuyenteId" INTEGER NOT NULL,
    "predioId" INTEGER,
    "giroId" INTEGER,
    "direccionLocal" VARCHAR(150),
    "area" DECIMAL(10,2),
    "horario" VARCHAR(100),
    "fechaEmision" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" DATE,
    "estado" "EstadoLicencia" NOT NULL DEFAULT 'VIGENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oficinas_codigo_key" ON "oficinas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- CreateIndex
CREATE INDEX "usuarios_oficinaId_idx" ON "usuarios"("oficinaId");

-- CreateIndex
CREATE INDEX "auditoria_tabla_registroId_idx" ON "auditoria"("tabla", "registroId");

-- CreateIndex
CREATE INDEX "auditoria_usuarioId_idx" ON "auditoria"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "contribuyentes_codigoLegacy_key" ON "contribuyentes"("codigoLegacy");

-- CreateIndex
CREATE UNIQUE INDEX "contribuyentes_numDoc_key" ON "contribuyentes"("numDoc");

-- CreateIndex
CREATE INDEX "contribuyentes_nombreCompleto_idx" ON "contribuyentes"("nombreCompleto");

-- CreateIndex
CREATE INDEX "contribuyentes_estado_idx" ON "contribuyentes"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_codigo_key" ON "zonas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "urbanizaciones_codigo_key" ON "urbanizaciones"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "vias_tipoVia_nombre_key" ON "vias"("tipoVia", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "predios_codigoLegacy_key" ON "predios"("codigoLegacy");

-- CreateIndex
CREATE UNIQUE INDEX "predios_codigoCatastro_key" ON "predios"("codigoCatastro");

-- CreateIndex
CREATE INDEX "predios_zonaId_idx" ON "predios"("zonaId");

-- CreateIndex
CREATE INDEX "predios_urbanizacionId_idx" ON "predios"("urbanizacionId");

-- CreateIndex
CREATE INDEX "predios_estado_idx" ON "predios"("estado");

-- CreateIndex
CREATE INDEX "predio_contribuyente_predioId_idx" ON "predio_contribuyente"("predioId");

-- CreateIndex
CREATE UNIQUE INDEX "predio_contribuyente_contribuyenteId_predioId_key" ON "predio_contribuyente"("contribuyenteId", "predioId");

-- CreateIndex
CREATE INDEX "pisos_predioId_idx" ON "pisos"("predioId");

-- CreateIndex
CREATE INDEX "otras_instalaciones_predioId_idx" ON "otras_instalaciones"("predioId");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculos_placa_key" ON "vehiculos"("placa");

-- CreateIndex
CREATE INDEX "vehiculos_contribuyenteId_idx" ON "vehiculos"("contribuyenteId");

-- CreateIndex
CREATE UNIQUE INDEX "vehiculo_detalle_anual_vehiculoId_anioFiscal_key" ON "vehiculo_detalle_anual"("vehiculoId", "anioFiscal");

-- CreateIndex
CREATE UNIQUE INDEX "tributos_codigo_key" ON "tributos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "uit_anio_key" ON "uit"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "escala_predial_anio_tramo_key" ON "escala_predial"("anio", "tramo");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_arbitrios_anio_concepto_key" ON "tarifas_arbitrios"("anio", "concepto");

-- CreateIndex
CREATE UNIQUE INDEX "tupa_codigo_key" ON "tupa"("codigo");

-- CreateIndex
CREATE INDEX "cuenta_corriente_contribuyenteId_anioFiscal_idx" ON "cuenta_corriente"("contribuyenteId", "anioFiscal");

-- CreateIndex
CREATE INDEX "cuenta_corriente_predioId_anioFiscal_idx" ON "cuenta_corriente"("predioId", "anioFiscal");

-- CreateIndex
CREATE INDEX "cuenta_corriente_tributoId_anioFiscal_idx" ON "cuenta_corriente"("tributoId", "anioFiscal");

-- CreateIndex
CREATE INDEX "cuenta_corriente_estado_idx" ON "cuenta_corriente"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_numRecibo_key" ON "pagos"("numRecibo");

-- CreateIndex
CREATE INDEX "pagos_contribuyenteId_idx" ON "pagos"("contribuyenteId");

-- CreateIndex
CREATE INDEX "pagos_cajeroId_idx" ON "pagos"("cajeroId");

-- CreateIndex
CREATE INDEX "pagos_fechaPago_idx" ON "pagos"("fechaPago");

-- CreateIndex
CREATE UNIQUE INDEX "convenios_numero_key" ON "convenios"("numero");

-- CreateIndex
CREATE INDEX "convenios_contribuyenteId_idx" ON "convenios"("contribuyenteId");

-- CreateIndex
CREATE INDEX "convenio_detalle_cuentaCorrienteId_idx" ON "convenio_detalle"("cuentaCorrienteId");

-- CreateIndex
CREATE UNIQUE INDEX "convenio_detalle_convenioId_cuotaNumero_key" ON "convenio_detalle"("convenioId", "cuotaNumero");

-- CreateIndex
CREATE INDEX "valores_cab_contribuyenteId_idx" ON "valores_cab"("contribuyenteId");

-- CreateIndex
CREATE UNIQUE INDEX "valores_cab_tipo_anio_numero_key" ON "valores_cab"("tipo", "anio", "numero");

-- CreateIndex
CREATE INDEX "valores_det_cuentaCorrienteId_idx" ON "valores_det"("cuentaCorrienteId");

-- CreateIndex
CREATE INDEX "coactivo_exp_contribuyenteId_idx" ON "coactivo_exp"("contribuyenteId");

-- CreateIndex
CREATE UNIQUE INDEX "coactivo_exp_anioExpediente_numExpediente_key" ON "coactivo_exp"("anioExpediente", "numExpediente");

-- CreateIndex
CREATE INDEX "coactivo_det_expedienteId_idx" ON "coactivo_det"("expedienteId");

-- CreateIndex
CREATE UNIQUE INDEX "giros_negocio_codigo_key" ON "giros_negocio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "licencias_numeroLicencia_key" ON "licencias"("numeroLicencia");

-- CreateIndex
CREATE INDEX "licencias_contribuyenteId_idx" ON "licencias"("contribuyenteId");

-- CreateIndex
CREATE INDEX "licencias_estado_idx" ON "licencias"("estado");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "oficinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "zonas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_urbanizacionId_fkey" FOREIGN KEY ("urbanizacionId") REFERENCES "urbanizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predios" ADD CONSTRAINT "predios_viaId_fkey" FOREIGN KEY ("viaId") REFERENCES "vias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predio_contribuyente" ADD CONSTRAINT "predio_contribuyente_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predio_contribuyente" ADD CONSTRAINT "predio_contribuyente_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pisos" ADD CONSTRAINT "pisos_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otras_instalaciones" ADD CONSTRAINT "otras_instalaciones_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otras_instalaciones" ADD CONSTRAINT "otras_instalaciones_pisoId_fkey" FOREIGN KEY ("pisoId") REFERENCES "pisos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculos" ADD CONSTRAINT "vehiculos_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehiculo_detalle_anual" ADD CONSTRAINT "vehiculo_detalle_anual_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_corriente" ADD CONSTRAINT "cuenta_corriente_tributoId_fkey" FOREIGN KEY ("tributoId") REFERENCES "tributos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cuentaCorrienteId_fkey" FOREIGN KEY ("cuentaCorrienteId") REFERENCES "cuenta_corriente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenios" ADD CONSTRAINT "convenios_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenio_detalle" ADD CONSTRAINT "convenio_detalle_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convenio_detalle" ADD CONSTRAINT "convenio_detalle_cuentaCorrienteId_fkey" FOREIGN KEY ("cuentaCorrienteId") REFERENCES "cuenta_corriente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_cab" ADD CONSTRAINT "valores_cab_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_det" ADD CONSTRAINT "valores_det_valorId_fkey" FOREIGN KEY ("valorId") REFERENCES "valores_cab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valores_det" ADD CONSTRAINT "valores_det_cuentaCorrienteId_fkey" FOREIGN KEY ("cuentaCorrienteId") REFERENCES "cuenta_corriente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coactivo_exp" ADD CONSTRAINT "coactivo_exp_valorId_fkey" FOREIGN KEY ("valorId") REFERENCES "valores_cab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coactivo_exp" ADD CONSTRAINT "coactivo_exp_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coactivo_det" ADD CONSTRAINT "coactivo_det_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "coactivo_exp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coactivo_det" ADD CONSTRAINT "coactivo_det_cuentaCorrienteId_fkey" FOREIGN KEY ("cuentaCorrienteId") REFERENCES "cuenta_corriente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_contribuyenteId_fkey" FOREIGN KEY ("contribuyenteId") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_predioId_fkey" FOREIGN KEY ("predioId") REFERENCES "predios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licencias" ADD CONSTRAINT "licencias_giroId_fkey" FOREIGN KEY ("giroId") REFERENCES "giros_negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

