import { GeminiProvider } from './gemini.provider.js';
import { LlmError } from './llm.provider.js';

const ok = (texto: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }], usageMetadata: { totalTokenCount: 9 } }));
const mensajes = [{ rol: 'USER' as const, contenido: 'hola' }];

describe('GeminiProvider', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const proveedor = () =>
    new GeminiProvider({ apiKey: 'k', model: 'principal', fallbackModel: 'respaldo', esperaReintentoMs: 0 });
  const modeloLlamado = (i: number) => String(fetchMock.mock.calls[i][0]).match(/models\/([^:]+):/)?.[1];

  it('sin key → SIN_KEY sin llamar a la red', async () => {
    const e = await new GeminiProvider({}).embed(['x'], 'consulta').catch((x) => x);
    expect(e).toBeInstanceOf(LlmError);
    expect(e.motivo).toBe('SIN_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('503 pasajero → reintenta el mismo modelo una vez', async () => {
    fetchMock.mockResolvedValueOnce(new Response('overloaded', { status: 503 })).mockResolvedValueOnce(ok('respuesta'));
    const r = await proveedor().generar('sis', mensajes);
    expect(r).toEqual({ texto: 'respuesta', tokens: 9 });
    expect([modeloLlamado(0), modeloLlamado(1)]).toEqual(['principal', 'principal']);
  });

  it('principal con 503 persistente → pasa al respaldo', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('overloaded', { status: 503 }))
      .mockResolvedValueOnce(new Response('overloaded', { status: 503 }))
      .mockResolvedValueOnce(ok('respuesta'));
    await expect(proveedor().generar('sis', mensajes)).resolves.toMatchObject({ texto: 'respuesta' });
    expect(modeloLlamado(2)).toBe('respaldo');
  });

  it('error 400 no se reintenta en el mismo modelo', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 400 })).mockResolvedValueOnce(ok('r'));
    await proveedor().generar('sis', mensajes);
    expect([modeloLlamado(0), modeloLlamado(1)]).toEqual(['principal', 'respaldo']);
  });

  it('principal sin red (timeout) → reintenta con el respaldo', async () => {
    fetchMock.mockRejectedValueOnce(new Error('aborted due to timeout')).mockResolvedValueOnce(ok('r'));
    await expect(proveedor().generar('sis', mensajes)).resolves.toMatchObject({ texto: 'r' });
  });

  it('cuota agotada (429) no reintenta', async () => {
    fetchMock.mockResolvedValue(new Response('quota', { status: 429 }));
    const e = await proveedor().generar('sis', mensajes).catch((x) => x);
    expect(e.motivo).toBe('CUOTA');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('respuesta vacía de ambos → PROVEEDOR', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(ok('')));
    const e = await proveedor().generar('sis', mensajes).catch((x) => x);
    expect(e.motivo).toBe('PROVEEDOR');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('embed rechaza si Gemini devuelve menos vectores que textos', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ embeddings: [{ values: [1] }] })));
    const e = await proveedor().embed(['a', 'b'], 'documento').catch((x) => x);
    expect(e.motivo).toBe('PROVEEDOR');
  });
});
