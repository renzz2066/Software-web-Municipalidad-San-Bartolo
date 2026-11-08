import { createHash } from 'node:crypto';

// Fragmentación de docs/ia/*.md y plan de re-ingesta por hash (specs/ia-chat-v1.md).
export const MAX_FRAGMENTO = 1200;

export interface FragmentoMd {
  seccion: string;
  posicion: number;
  contenido: string;
}

export interface DocumentoMd {
  titulo: string;
  fragmentos: FragmentoMd[];
}

export function hashContenido(md: string): string {
  return createHash('sha256').update(md.replace(/\r\n/g, '\n')).digest('hex');
}

// Parte por encabezados `##`; una sección larga se divide por párrafos hasta MAX_FRAGMENTO.
export function fragmentarMarkdown(md: string, archivo: string): DocumentoMd {
  const lineas = md.replace(/\r\n/g, '\n').split('\n');
  let titulo = archivo.replace(/\.md$/i, '');
  const secciones: { seccion: string; lineas: string[] }[] = [{ seccion: 'Introducción', lineas: [] }];

  for (const linea of lineas) {
    const h1 = /^#\s+(.+)$/.exec(linea);
    const h2 = /^##\s+(.+)$/.exec(linea);
    if (h1) {
      titulo = h1[1].trim();
    } else if (h2) {
      secciones.push({ seccion: h2[1].trim(), lineas: [] });
    } else {
      secciones[secciones.length - 1].lineas.push(linea);
    }
  }

  const fragmentos: FragmentoMd[] = [];
  for (const s of secciones) {
    for (const contenido of partir(s.lineas.join('\n').trim())) {
      fragmentos.push({ seccion: s.seccion, posicion: fragmentos.length + 1, contenido });
    }
  }
  return { titulo, fragmentos };
}

function partir(texto: string): string[] {
  if (!texto) return [];
  if (texto.length <= MAX_FRAGMENTO) return [texto];
  const partes: string[] = [];
  let actual = '';
  for (const parrafo of texto.split(/\n\s*\n/)) {
    for (const trozo of cortar(parrafo.trim())) {
      if (actual && actual.length + trozo.length + 2 > MAX_FRAGMENTO) {
        partes.push(actual);
        actual = trozo;
      } else {
        actual = actual ? `${actual}\n\n${trozo}` : trozo;
      }
    }
  }
  if (actual) partes.push(actual);
  return partes;
}

// Párrafo más largo que el máximo: corte duro (en el último espacio si lo hay).
function cortar(parrafo: string): string[] {
  const trozos: string[] = [];
  let resto = parrafo;
  while (resto.length > MAX_FRAGMENTO) {
    const espacio = resto.lastIndexOf(' ', MAX_FRAGMENTO);
    const corte = espacio > MAX_FRAGMENTO / 2 ? espacio : MAX_FRAGMENTO;
    trozos.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) trozos.push(resto);
  return trozos;
}

// Texto que se embebe: guía + sección dan contexto al fragmento.
export function textoParaEmbedding(titulo: string, f: FragmentoMd): string {
  return `${titulo} › ${f.seccion}\n${f.contenido}`;
}

export interface PlanIngesta {
  procesar: string[]; // nuevos o con hash distinto
  sinCambio: string[];
  eliminar: { id: number; archivo: string }[]; // en BD pero ya no en docs/ia
}

export function planificarIngesta(
  locales: { archivo: string; hash: string }[],
  enBd: { id: number; archivo: string; hash: string }[],
): PlanIngesta {
  const bd = new Map(enBd.map((d) => [d.archivo, d]));
  const nombres = new Set(locales.map((l) => l.archivo));
  const procesar: string[] = [];
  const sinCambio: string[] = [];
  for (const l of locales) {
    if (bd.get(l.archivo)?.hash === l.hash) sinCambio.push(l.archivo);
    else procesar.push(l.archivo);
  }
  const eliminar = enBd.filter((d) => !nombres.has(d.archivo)).map(({ id, archivo }) => ({ id, archivo }));
  return { procesar, sinCambio, eliminar };
}

export function vectorLiteral(v: number[]): string {
  if (!v.every((x) => Number.isFinite(x))) {
    throw new Error('Embedding con valores no numéricos');
  }
  return `[${v.join(',')}]`;
}
