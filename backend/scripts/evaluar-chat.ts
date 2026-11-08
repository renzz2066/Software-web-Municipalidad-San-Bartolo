// Evaluación del Chat San Bartolo (specs/ia-chat-v1.md): mide si la fuente esperada sale citada.
// Uso: cd backend && npm run docs:evaluar            (solo recuperación, rápido)
//      cd backend && npm run docs:evaluar -- --llm   (además genera y muestra la respuesta)
// No escribe en la BD. Preguntas en docs/ia-evaluacion/preguntas.json
// ("fuentes": [] = fuera de tema, debe responder sin fuentes).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { GeminiProvider } from '../src/ia/llm/gemini.provider.js';
import { RagService } from '../src/ia/rag.service.js';
import {
  RESPUESTA_SIN_INFORMACION,
  construirMensajeUsuario,
  construirSistema,
  fuentesDe,
  sinInformacion,
} from '../src/ia/prompt.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ENV = resolve(AQUI, '../.env');
if (existsSync(ENV)) process.loadEnvFile(ENV);
const conLlm = process.argv.includes('--llm');

const prisma = new PrismaClient();
const config = { get: (k: string) => process.env[k] };
const rag = new RagService(prisma as never, config as never);
const llm = new GeminiProvider({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL,
  fallbackModel: process.env.GEMINI_MODEL_RESPALDO,
  embedModel: process.env.GEMINI_EMBED_MODEL,
  timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 30000),
});

async function main() {
  const casos = JSON.parse(
    await readFile(resolve(AQUI, '../../docs/ia-evaluacion/preguntas.json'), 'utf8'),
  ) as { pregunta: string; fuentes: string[] }[];
  const vectores = await llm.embed(casos.map((c) => c.pregunta), 'consulta');

  let aciertos = 0;
  let errores = 0;
  for (const [i, caso] of casos.entries()) {
    const fragmentos = await rag.buscar(vectores[i]);
    let respuesta = RESPUESTA_SIN_INFORMACION;
    if (conLlm && fragmentos.length > 0) {
      try {
        const r = await llm.generar(construirSistema('SUPERVISOR'), [
          { rol: 'USER', contenido: construirMensajeUsuario(caso.pregunta, fragmentos) },
        ]);
        respuesta = r.texto;
      } catch (e) {
        errores++;
        console.log(`⚠ ${caso.pregunta}\n    error del LLM: ${(e as Error).message.slice(0, 120)}`);
        continue;
      }
    }
    const fuentes =
      fragmentos.length === 0 || (conLlm && sinInformacion(respuesta)) ? [] : fuentesDe(fragmentos);
    const citadas = fuentes.map((f) => `${f.archivo}#${f.seccion}`);
    const ok =
      caso.fuentes.length === 0 ? citadas.length === 0 : caso.fuentes.some((f) => citadas.includes(f));
    if (ok) aciertos++;
    const mejor = fragmentos[0] ? fragmentos[0].similitud.toFixed(3) : '—';
    console.log(`${ok ? '✔' : '✘'} [${mejor}] ${caso.pregunta}`);
    console.log(`    citadas: ${citadas.join(' | ') || '(ninguna)'}`);
    if (!ok) console.log(`    esperada: ${caso.fuentes.join(' | ') || '(ninguna)'}`);
    if (conLlm) console.log(`    respuesta: ${respuesta.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
  const pct = ((aciertos / casos.length) * 100).toFixed(1);
  console.log(
    `\nAciertos: ${aciertos}/${casos.length} (${pct} %)${conLlm ? ` · con LLM · errores del LLM ${errores}` : ' · solo recuperación'}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
