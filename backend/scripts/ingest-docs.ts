// Ingesta del corpus docs/ia/*.md → ia_documento/ia_fragmento (specs/ia-chat-v1.md).
// Uso: cd backend && npm run docs:ingest   (re-ejecutable: solo re-embebe lo que cambió).
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { GeminiProvider } from '../src/ia/llm/gemini.provider.js';
import {
  fragmentarMarkdown,
  hashContenido,
  planificarIngesta,
  textoParaEmbedding,
  vectorLiteral,
} from '../src/ia/ingesta.logic.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(AQUI, '../../docs/ia');
const ENV = resolve(AQUI, '../.env');
if (existsSync(ENV)) process.loadEnvFile(ENV); // Node nativo, sin dotenv

const prisma = new PrismaClient();
const llm = new GeminiProvider({
  apiKey: process.env.GEMINI_API_KEY,
  embedModel: process.env.GEMINI_EMBED_MODEL,
  timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 60000),
});

async function main() {
  const archivos = (await readdir(DOCS)).filter((a) => a.toLowerCase().endsWith('.md')).sort();
  const contenidos = new Map<string, string>();
  for (const archivo of archivos) {
    contenidos.set(archivo, await readFile(join(DOCS, archivo), 'utf8'));
  }
  const locales = archivos.map((archivo) => ({ archivo, hash: hashContenido(contenidos.get(archivo)!) }));
  const enBd = await prisma.iaDocumento.findMany({ select: { id: true, archivo: true, hash: true } });
  const plan = planificarIngesta(locales, enBd);
  const hashes = new Map(locales.map((l) => [l.archivo, l.hash]));

  let fragmentosTotal = 0;
  const errores: string[] = [];
  for (const archivo of plan.procesar) {
    try {
      const doc = fragmentarMarkdown(contenidos.get(archivo)!, archivo);
      // Embeddings antes de la transacción: la llamada de red no retiene la tx abierta.
      const vectores = await llm.embed(
        doc.fragmentos.map((f) => textoParaEmbedding(doc.titulo, f)),
        'documento',
      );
      await prisma.$transaction(async (tx) => {
        const fila = await tx.iaDocumento.upsert({
          where: { archivo },
          create: { archivo, titulo: doc.titulo, hash: hashes.get(archivo)! },
          update: { titulo: doc.titulo, hash: hashes.get(archivo)! },
        });
        await tx.iaFragmento.deleteMany({ where: { documentoId: fila.id } });
        for (const [i, f] of doc.fragmentos.entries()) {
          await tx.$executeRaw`
            INSERT INTO ia_fragmento ("documentoId", titulo, seccion, posicion, contenido, embedding)
            VALUES (${fila.id}, ${doc.titulo}, ${f.seccion}, ${f.posicion}, ${f.contenido},
                    ${vectorLiteral(vectores[i])}::vector)`;
        }
      });
      fragmentosTotal += doc.fragmentos.length;
      console.log(`  ✔ ${archivo}: ${doc.fragmentos.length} fragmentos`);
    } catch (e) {
      errores.push(`${archivo}: ${(e as Error).message}`);
      console.error(`  ✘ ${archivo}: ${(e as Error).message}`);
    }
  }

  if (plan.eliminar.length > 0) {
    // Guía borrada de docs/ia → sus fragmentos caen por ON DELETE CASCADE.
    await prisma.iaDocumento.deleteMany({ where: { id: { in: plan.eliminar.map((d) => d.id) } } });
  }

  console.log(
    `\nDocumentos: ${archivos.length} · procesados ${plan.procesar.length - errores.length} · ` +
      `sin cambio ${plan.sinCambio.length} · eliminados ${plan.eliminar.length} · ` +
      `fragmentos nuevos ${fragmentosTotal} · errores ${errores.length}`,
  );
  if (errores.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
