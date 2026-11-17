import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';

// Multi-municipalidad (specs/multi-muni-v1.md): una base por muni, elegida por el host del frontend.
// El JSON solo trae datos públicos; la URL de cada base va en DATABASE_URL__<SLUG>.

export interface MuniPublica {
  slug: string;
  nombre: string;
  nombreCorto: string;
  ubicacion: string;
  lema: string;
  gentilicio: string;
  web: string;
  escudoUrl: string;
  fondoUrl: string | null;
  colores: Record<string, string>;
}

export interface Muni extends MuniPublica {
  hosts: string[];
  databaseUrl: string;
}

export interface Registro {
  defecto: Muni;
  porSlug: Map<string, Muni>;
  porHost: Map<string, Muni>;
  // Hosts que, sin subdominio de muni, usan la muni por defecto (p. ej. localhost de FRONTEND_URL).
  hostsDefecto: Set<string>;
}

type Entorno = Record<string, string | undefined>;

const SLUG = /^[a-z0-9]{2,30}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
// Solo tokens de index.css: el JSON no puede inyectar CSS arbitrario.
const TOKENS_COLOR = new Set(['mar-profundo', 'mar', 'mar-medio', 'turquesa', 'arena', 'arena-claro', 'coral']);

export const contextoMuni = new AsyncLocalStorage<Muni>();

export const envUrl = (slug: string) => `DATABASE_URL__${slug.toUpperCase()}`;

function hostname(valor: string): string | null {
  try {
    return new URL(valor.includes('://') ? valor : `http://${valor}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function cargarRegistro(json: unknown, env: Entorno): Registro {
  const datos = json as { defecto?: string; munis?: unknown[] };
  if (!Array.isArray(datos?.munis) || datos.munis.length === 0) {
    throw new Error('config/munis.json: falta la lista "munis"');
  }
  const slugDefecto = (env.MUNI_DEFAULT || datos.defecto || '').trim();
  const activos = (env.MUNIS || slugDefecto)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!activos.includes(slugDefecto)) activos.push(slugDefecto);

  const porSlug = new Map<string, Muni>();
  const porHost = new Map<string, Muni>();
  for (const crudo of datos.munis as Record<string, unknown>[]) {
    const slug = String(crudo.slug ?? '');
    if (!SLUG.test(slug)) throw new Error(`config/munis.json: slug inválido "${slug}"`);
    if (!activos.includes(slug)) continue;

    // La muni por defecto acepta DATABASE_URL: así un .env de una sola muni sigue igual que antes.
    const databaseUrl = env[envUrl(slug)] || (slug === slugDefecto ? env.DATABASE_URL : undefined);
    if (!databaseUrl) throw new Error(`Falta ${envUrl(slug)} para la municipalidad "${slug}"`);

    const colores: Record<string, string> = {};
    for (const [token, valor] of Object.entries((crudo.colores ?? {}) as Record<string, unknown>)) {
      if (TOKENS_COLOR.has(token) && typeof valor === 'string' && COLOR.test(valor)) colores[token] = valor;
    }
    const texto = (k: string) => (typeof crudo[k] === 'string' ? (crudo[k] as string) : '');
    const muni: Muni = {
      slug,
      nombre: texto('nombre') || slug,
      nombreCorto: texto('nombreCorto') || texto('nombre') || slug,
      ubicacion: texto('ubicacion'),
      lema: texto('lema'),
      gentilicio: texto('gentilicio'),
      web: texto('web'),
      escudoUrl: texto('escudoUrl'),
      fondoUrl: typeof crudo.fondoUrl === 'string' ? crudo.fondoUrl : null,
      colores,
      hosts: (Array.isArray(crudo.hosts) ? crudo.hosts : []).map((h) => String(h).toLowerCase()),
      databaseUrl,
    };
    porSlug.set(slug, muni);
    for (const h of muni.hosts) porHost.set(h, muni);
  }

  const faltantes = activos.filter((s) => !porSlug.has(s));
  if (faltantes.length) throw new Error(`config/munis.json: no existe la municipalidad "${faltantes.join('", "')}"`);

  const hostsDefecto = new Set<string>();
  const front = env.FRONTEND_URL ? hostname(env.FRONTEND_URL) : 'localhost';
  if (front) hostsDefecto.add(front);

  return { defecto: porSlug.get(slugDefecto)!, porSlug, porHost, hostsDefecto };
}

// Valor de X-Muni = hostname del frontend. Sin cabecera (curl, scripts) → defecto.
// Un host desconocido devuelve null: NUNCA cae en la muni por defecto.
export function resolverMuni(registro: Registro, cabecera: string | undefined): Muni | null {
  const valor = cabecera?.trim();
  if (!valor) return registro.defecto;
  const host = hostname(valor.slice(0, 255));
  if (!host) return null;
  return registro.porHost.get(host) ?? (registro.hostsDefecto.has(host) ? registro.defecto : null);
}

export function hostsPermitidos(registro: Registro): Set<string> {
  return new Set([...registro.porHost.keys(), ...registro.hostsDefecto]);
}

export function aPublica({ hosts: _h, databaseUrl: _d, ...publica }: Muni): MuniPublica {
  return publica;
}

export function leerRegistro(env: Entorno = process.env): Registro {
  const ruta = new URL('../../config/munis.json', import.meta.url);
  return cargarRegistro(JSON.parse(readFileSync(ruta, 'utf8')), env);
}
