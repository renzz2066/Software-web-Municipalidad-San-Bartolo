// Contrato del proveedor de IA (specs/ia-chat-v1.md). Cambiar de Gemini a Ollama = otra clase.
export type TipoEmbedding = 'consulta' | 'documento';

export interface MensajeLlm {
  rol: 'USER' | 'IA';
  contenido: string;
}

export interface RespuestaLlm {
  texto: string;
  tokens: number | null;
}

export type MotivoLlm = 'SIN_KEY' | 'RED' | 'CUOTA' | 'PROVEEDOR';

export class LlmError extends Error {
  constructor(
    readonly motivo: MotivoLlm,
    detalle: string,
  ) {
    super(detalle);
    this.name = 'LlmError';
  }
}

// Clase abstracta: sirve de token de inyección en Nest.
export abstract class LlmProvider {
  abstract embed(textos: string[], tipo: TipoEmbedding): Promise<number[][]>;
  abstract generar(sistema: string, mensajes: MensajeLlm[]): Promise<RespuestaLlm>;
}
