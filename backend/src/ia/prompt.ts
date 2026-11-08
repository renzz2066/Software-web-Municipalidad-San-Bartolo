// Reglas del asistente y armado del prompt con fuentes (specs/ia-chat-v1.md C3/C4).

export interface FragmentoRecuperado {
  id: number;
  archivo: string;
  titulo: string;
  seccion: string;
  contenido: string;
  similitud: number;
}

export interface Fuente {
  archivo: string;
  guia: string;
  seccion: string;
}

export const RESPUESTA_SIN_INFORMACION =
  'No tengo información sobre eso en las guías del sistema. Consulta con tu supervisor o con la ' +
  'Subgerencia de Rentas, o reformula la pregunta indicando el trámite o la pantalla.';

const DATO_OMITIDO = '[dato omitido]';

// Ley 29733: DNI (8), celular (9), RUC (11) y correos no salen hacia el LLM ni se guardan.
export function anonimizar(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, DATO_OMITIDO)
    .replace(/\b\d{8,11}\b/g, DATO_OMITIDO)
    .trim();
}

export function construirSistema(rol: string): string {
  return [
    'Eres MuniAI, el asistente interno del sistema de Rentas de la Municipalidad Distrital de San Bartolo.',
    `Atiendes a un funcionario con rol ${rol}.`,
    'Reglas:',
    '1. Responde en español, con tono de funcionario municipal, conciso y en pasos numerados cuando sea un trámite. Ve directo a la respuesta: sin saludos ("Estimado…"), sin despedidas y sin repetir la pregunta.',
    '2. Usa SOLO la información de las FUENTES. Si no está ahí, di literalmente "No tengo información sobre eso" y sugiere consultar al supervisor o a la Subgerencia de Rentas.',
    '3. No inventes tasas, montos, plazos, artículos ni nombres de pantallas.',
    '4. No cites guías ni secciones en el texto ni al final: el sistema muestra las fuentes aparte. Sí nombra las pantallas y botones tal como aparecen en las fuentes (por ejemplo "Caja › Extorno").',
    '5. No pidas ni uses datos personales (DNI, RUC, nombres, deudas de contribuyentes); si el usuario los escribe, ignóralos.',
    '6. Si la pregunta no trata sobre el sistema o trámites municipales, indícalo amablemente.',
  ].join('\n');
}

export function construirMensajeUsuario(pregunta: string, fragmentos: FragmentoRecuperado[]): string {
  const fuentes = fragmentos
    .map((f, i) => `[${i + 1}] Guía: ${f.titulo} › Sección: ${f.seccion}\n${f.contenido}`)
    .join('\n\n');
  return `FUENTES:\n${fuentes}\n\nPREGUNTA: ${pregunta}`;
}

export const MARGEN_FUENTES = 0.08;
const MAX_FUENTES = 3;

export function sinInformacion(respuesta: string): boolean {
  return /no tengo informaci[oó]n/i.test(respuesta.slice(0, 200));
}

// Fuentes a mostrar: únicas por guía + sección, en orden de relevancia y solo las cercanas a
// la mejor (al LLM van todas las recuperadas; al usuario, las que realmente sostienen la respuesta).
export function fuentesDe(fragmentos: FragmentoRecuperado[], margen = MARGEN_FUENTES): Fuente[] {
  const mejor = Math.max(...fragmentos.map((f) => f.similitud));
  const vistas = new Set<string>();
  const fuentes: Fuente[] = [];
  for (const f of fragmentos.filter((x) => x.similitud >= mejor - margen)) {
    if (fuentes.length === MAX_FUENTES) break;
    const clave = `${f.archivo}#${f.seccion}`;
    if (!vistas.has(clave)) {
      vistas.add(clave);
      fuentes.push({ archivo: f.archivo, guia: f.titulo, seccion: f.seccion });
    }
  }
  return fuentes;
}

export function tituloConversacion(pregunta: string): string {
  const limpio = pregunta.replace(/\s+/g, ' ').trim();
  return limpio.length > 80 ? `${limpio.slice(0, 77)}...` : limpio;
}
