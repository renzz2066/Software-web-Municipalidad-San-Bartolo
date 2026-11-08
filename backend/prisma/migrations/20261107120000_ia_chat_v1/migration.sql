-- Chat San Bartolo (specs/ia-chat-v1.md): pgvector + corpus RAG + historial de chat.
-- ia_documento/ia_fragmento NO se auditan: son derivados de docs/ia/*.md y se regeneran con
-- `npm run docs:ingest` (auditar embeddings de 768 floats inflaría la tabla auditoria).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "RolMensajeChat" AS ENUM ('USER', 'IA');

-- CreateTable
CREATE TABLE "ia_documento" (
    "id" SERIAL NOT NULL,
    "archivo" VARCHAR(150) NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ia_fragmento" (
    "id" SERIAL NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "seccion" VARCHAR(200) NOT NULL,
    "posicion" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "embedding" vector(768),

    CONSTRAINT "ia_fragmento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversacion" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoMensajeEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_mensaje" (
    "id" SERIAL NOT NULL,
    "conversacionId" INTEGER NOT NULL,
    "rol" "RolMensajeChat" NOT NULL,
    "contenido" TEXT NOT NULL,
    "fragmentosJson" JSONB,
    "tokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ia_documento_archivo_key" ON "ia_documento"("archivo");

-- CreateIndex
CREATE INDEX "ia_fragmento_documentoId_idx" ON "ia_fragmento"("documentoId");

-- CreateIndex
CREATE INDEX "chat_conversacion_usuarioId_ultimoMensajeEn_idx" ON "chat_conversacion"("usuarioId", "ultimoMensajeEn");

-- CreateIndex
CREATE INDEX "chat_mensaje_conversacionId_createdAt_idx" ON "chat_mensaje"("conversacionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ia_fragmento" ADD CONSTRAINT "ia_fragmento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "ia_documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversacion" ADD CONSTRAINT "chat_conversacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensaje" ADD CONSTRAINT "chat_mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "chat_conversacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Historial del chat: auditado como toda tabla de la app (skills/backend-db.md §6).
SELECT auditoria_habilitar('chat_conversacion');
SELECT auditoria_habilitar('chat_mensaje');
