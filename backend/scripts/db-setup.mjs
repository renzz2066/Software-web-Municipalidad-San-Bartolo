// Aplica migraciones + seed a bases locales del laboratorio (infra/README.md).
//   npm run db:setup -- <url>      → una base concreta
//   npm run db:setup:todas         → cada muni de MUNIS (DATABASE_URL__<SLUG> de .env.local-lab)
// Fija DATABASE_URL y DIRECT_URL a cada URL (pisa .env), así nunca cae en Supabase por accidente.
import { spawnSync } from 'node:child_process';

const HOSTS_LOCALES = ['localhost', '127.0.0.1', '[::1]', '::1'];
const ocultar = (url) => url.replace(/\/\/[^@]*@/, '//***@');

function objetivos() {
  if (process.argv[2] !== '--todas') {
    const url = process.argv[2];
    if (!url) {
      console.error('Uso: npm run db:setup -- postgresql://postgres:postgres@localhost:5433/muni_demo');
      process.exit(1);
    }
    return [{ nombre: url, url }];
  }
  const slugs = (process.env.MUNIS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (slugs.length === 0) {
    console.error('MUNIS está vacío: revisa .env.local-lab');
    process.exit(1);
  }
  return slugs.map((slug) => {
    const url = process.env[`DATABASE_URL__${slug.toUpperCase()}`];
    if (!url) {
      console.error(`Falta DATABASE_URL__${slug.toUpperCase()} para "${slug}"`);
      process.exit(1);
    }
    return { nombre: slug, url };
  });
}

function validarLocal(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    console.error(`URL inválida: ${ocultar(url)}`);
    process.exit(1);
  }
  if (!HOSTS_LOCALES.includes(host)) {
    console.error(`Rechazado: "${host}" no es local. db:setup es solo para el laboratorio local.`);
    process.exit(1);
  }
}

const lista = objetivos();
lista.forEach(({ url }) => validarLocal(url));

for (const { nombre, url } of lista) {
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  for (const args of [['migrate', 'deploy'], ['db', 'seed']]) {
    console.log(`\n> [${nombre}] prisma ${args.join(' ')}  (${ocultar(url)})`);
    const r = spawnSync(`npx prisma ${args.join(' ')}`, { stdio: 'inherit', env, shell: true });
    if (r.status !== 0) {
      console.error(`\nFalló "prisma ${args.join(' ')}" en "${nombre}". Las siguientes bases no se tocaron.`);
      process.exit(r.status ?? 1);
    }
  }
}
if (lista.length > 1) console.log(`\nListo: ${lista.map((o) => o.nombre).join(', ')}`);
