import { LlmError, LlmProvider, MensajeLlm, RespuestaLlm, TipoEmbedding } from './llm.provider.js';

export const DIMENSION_EMBEDDING = 768;
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const LOTE_EMBEDDING = 100; // máximo de batchEmbedContents

// Subconjunto de las respuestas de embedContents/generateContent que se usa.
interface RespuestaGemini {
  embeddings?: { values: number[] }[];
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { totalTokenCount?: number };
}

export interface GeminiConfig {
  apiKey?: string;
  model?: string;
  fallbackModel?: string; // se usa si el principal falla por red o proveedor
  embedModel?: string;
  timeoutMs?: number;
  esperaReintentoMs?: number;
}

// Gemini vía fetch nativo de Node (sin dependencias npm).
export class GeminiProvider extends LlmProvider {
  private readonly model: string;
  private readonly fallbackModel: string;
  private readonly embedModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: GeminiConfig) {
    super();
    this.model = config.model || 'gemini-flash-lite-latest';
    this.fallbackModel = config.fallbackModel || 'gemini-flash-lite-latest';
    this.embedModel = config.embedModel || 'gemini-embedding-001';
    this.timeoutMs = config.timeoutMs || 30000;
  }

  async embed(textos: string[], tipo: TipoEmbedding): Promise<number[][]> {
    const taskType = tipo === 'consulta' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';
    const vectores: number[][] = [];
    for (let i = 0; i < textos.length; i += LOTE_EMBEDDING) {
      const lote = textos.slice(i, i + LOTE_EMBEDDING);
      const json = await this.llamar(`${this.embedModel}:batchEmbedContents`, {
        requests: lote.map((text) => ({
          model: `models/${this.embedModel}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: DIMENSION_EMBEDDING,
        })),
      });
      const embeddings = json.embeddings ?? [];
      if (embeddings.length !== lote.length) {
        throw new LlmError('PROVEEDOR', 'Gemini devolvió un número de embeddings distinto al pedido');
      }
      vectores.push(...embeddings.map((e) => e.values));
    }
    return vectores;
  }

  async generar(sistema: string, mensajes: MensajeLlm[]): Promise<RespuestaLlm> {
    try {
      return await this.generarCon(this.model, sistema, mensajes);
    } catch (e) {
      const reintentable = e instanceof LlmError && (e.motivo === 'RED' || e.motivo === 'PROVEEDOR');
      if (!reintentable || this.fallbackModel === this.model) throw e;
      return this.generarCon(this.fallbackModel, sistema, mensajes);
    }
  }

  private async generarCon(model: string, sistema: string, mensajes: MensajeLlm[]): Promise<RespuestaLlm> {
    const json = await this.llamar(`${model}:generateContent`, {
      systemInstruction: { parts: [{ text: sistema }] },
      contents: mensajes.map((m) => ({
        role: m.rol === 'IA' ? 'model' : 'user',
        parts: [{ text: m.contenido }],
      })),
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });
    const partes = json.candidates?.[0]?.content?.parts ?? [];
    const texto = partes.map((p) => p.text ?? '').join('').trim();
    if (!texto) {
      throw new LlmError('PROVEEDOR', 'Gemini devolvió una respuesta vacía');
    }
    return { texto, tokens: json.usageMetadata?.totalTokenCount ?? null };
  }

  // Gemini responde 5xx cuando está sobrecargado: un reintento corto antes de rendirse.
  private async llamar(ruta: string, cuerpo: unknown): Promise<RespuestaGemini> {
    try {
      return await this.llamarUnaVez(ruta, cuerpo);
    } catch (e) {
      if (!(e instanceof LlmError) || !/^Gemini 5\d\d/.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, this.config.esperaReintentoMs ?? 1500));
      return this.llamarUnaVez(ruta, cuerpo);
    }
  }

  private async llamarUnaVez(ruta: string, cuerpo: unknown): Promise<RespuestaGemini> {
    if (!this.config.apiKey) {
      throw new LlmError('SIN_KEY', 'GEMINI_API_KEY no está configurada');
    }
    let res: Response;
    try {
      res = await fetch(`${BASE}/${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.config.apiKey },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new LlmError('RED', `Sin conexión con Gemini: ${(e as Error).message}`);
    }
    if (res.status === 429) {
      throw new LlmError('CUOTA', 'Cuota de Gemini agotada');
    }
    if (!res.ok) {
      const detalle = (await res.text().catch(() => '')).slice(0, 300);
      throw new LlmError('PROVEEDOR', `Gemini ${res.status}: ${detalle}`);
    }
    return (await res.json()) as RespuestaGemini;
  }
}
