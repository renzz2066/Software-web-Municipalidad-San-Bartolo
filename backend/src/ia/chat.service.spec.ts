import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { RolMensajeChat } from '@prisma/client';
import { ChatService } from './chat.service.js';
import { LlmError } from './llm/llm.provider.js';
import { RESPUESTA_SIN_INFORMACION } from './prompt.js';

const usuario = { id: 7, usuario: 'caja1', rol: 'CAJERO', niveles: ['ayuda.chat'] };
const fragmento = {
  id: 1,
  archivo: '08-caja.md',
  titulo: 'Caja',
  seccion: 'Extornar un recibo',
  contenido: 'Paso 1...',
  similitud: 0.8,
};

function crear({ fragmentos = [fragmento], conv = null as unknown } = {}) {
  let idMensaje = 100;
  const tx = {
    chatConversacion: {
      create: vi.fn().mockResolvedValue({ id: 55 }),
      update: vi.fn().mockResolvedValue({ id: 12 }),
    },
    chatMensaje: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: ++idMensaje, createdAt: new Date('2026-11-07'), fragmentosJson: null, ...data }),
      ),
    },
  };
  const prisma = {
    chatConversacion: { findFirst: vi.fn().mockResolvedValue(conv), findMany: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const rag = { buscar: vi.fn().mockResolvedValue(fragmentos) };
  const llm = {
    embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
    generar: vi.fn().mockResolvedValue({ texto: 'Para extornar...\nFuente: Caja › Extornar un recibo', tokens: 321 }),
  };
  const service = new ChatService(prisma as never, rag as never, llm as never);
  return { service, prisma, tx, rag, llm };
}

describe('ChatService.enviar', () => {
  it('con fuentes: llama al LLM, crea conversación y guarda ambos mensajes en una tx', async () => {
    const { service, tx, llm } = crear();
    const r = await service.enviar(usuario, { mensaje: '¿Cómo extorno un recibo?' });

    expect(llm.embed).toHaveBeenCalledWith(['¿Cómo extorno un recibo?'], 'consulta');
    const [sistema, mensajes] = llm.generar.mock.calls[0];
    expect(sistema).toContain('rol CAJERO');
    expect(mensajes.at(-1).contenido).toContain('Guía: Caja › Sección: Extornar un recibo');
    expect(tx.chatConversacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usuarioId: 7, titulo: '¿Cómo extorno un recibo?' }),
    });
    expect(tx.chatMensaje.create).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({
      convId: 55,
      mensaje: {
        rol: RolMensajeChat.IA,
        fuentes: [{ archivo: '08-caja.md', guia: 'Caja', seccion: 'Extornar un recibo' }],
      },
    });
    expect(tx.chatMensaje.create.mock.calls[1][0].data.tokens).toBe(321);
  });

  it('sin fragmentos relevantes: no llama al LLM y responde el mensaje honesto', async () => {
    const { service, llm } = crear({ fragmentos: [] });
    const r = await service.enviar(usuario, { mensaje: '¿Quién ganó el partido?' });
    expect(llm.generar).not.toHaveBeenCalled();
    expect(r.mensaje.contenido).toBe(RESPUESTA_SIN_INFORMACION);
    expect(r.mensaje.fuentes).toEqual([]);
  });

  it('anonimiza antes de embeber y de guardar (Ley 29733)', async () => {
    const { service, llm, tx } = crear();
    await service.enviar(usuario, { mensaje: 'deuda del DNI 45678912' });
    expect(llm.embed).toHaveBeenCalledWith(['deuda del DNI [dato omitido]'], 'consulta');
    expect(tx.chatMensaje.create.mock.calls[0][0].data.contenido).toBe('deuda del DNI [dato omitido]');
    expect(JSON.stringify(llm.generar.mock.calls)).not.toContain('45678912');
  });

  it('continúa una conversación propia enviando su historial al LLM', async () => {
    const conv = {
      id: 12,
      mensajes: [
        { rol: RolMensajeChat.IA, contenido: 'respuesta previa' },
        { rol: RolMensajeChat.USER, contenido: 'pregunta previa' },
      ], // orden desc (como lo devuelve la consulta)
    };
    const { service, prisma, tx, llm } = crear({ conv });
    const r = await service.enviar(usuario, { convId: 12, mensaje: '¿y si es de otro día?' });
    expect(prisma.chatConversacion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 12, usuarioId: 7 } }),
    );
    const mensajes = llm.generar.mock.calls[0][1];
    expect(mensajes.slice(0, 2)).toEqual([
      { rol: 'USER', contenido: 'pregunta previa' },
      { rol: 'IA', contenido: 'respuesta previa' },
    ]);
    expect(tx.chatConversacion.update).toHaveBeenCalled();
    expect(r.convId).toBe(12);
  });

  it('conversación ajena o inexistente → 404 sin llamar al LLM', async () => {
    const { service, llm } = crear({ conv: null });
    await expect(service.enviar(usuario, { convId: 99, mensaje: 'hola' })).rejects.toBeInstanceOf(NotFoundException);
    expect(llm.embed).not.toHaveBeenCalled();
  });

  it.each([
    ['SIN_KEY', /no está configurado/],
    ['RED', /conectar/],
    ['CUOTA', /límite de uso/],
    ['PROVEEDOR', /no respondió/],
  ] as const)('error %s del proveedor → 503 con mensaje claro y nada guardado', async (motivo, texto) => {
    const { service, llm, prisma } = crear();
    llm.embed.mockRejectedValue(new LlmError(motivo, 'detalle interno'));
    const error = await service.enviar(usuario, { mensaje: '¿cómo cobro?' }).catch((e) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).toMatch(texto);
    expect(error.message).not.toContain('detalle interno');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('errores no previstos (BD) se propagan tal cual', async () => {
    const { service, rag } = crear();
    rag.buscar.mockRejectedValue(new Error('db caída'));
    await expect(service.enviar(usuario, { mensaje: 'x' })).rejects.toThrow('db caída');
  });
});

describe('ChatService.obtenerConversacion', () => {
  it('devuelve mensajes con sus fuentes y 404 si no es del usuario', async () => {
    const { service, prisma } = crear();
    prisma.chatConversacion.findFirst.mockResolvedValueOnce({
      id: 3,
      titulo: 't',
      mensajes: [
        { id: 1, rol: 'USER', contenido: 'p', fragmentosJson: null, createdAt: new Date() },
        { id: 2, rol: 'IA', contenido: 'r', fragmentosJson: [{ archivo: 'a.md', guia: 'A', seccion: 'S' }], createdAt: new Date() },
      ],
    });
    const conv = await service.obtenerConversacion(7, 3);
    expect(conv.mensajes.map((m) => m.fuentes.length)).toEqual([0, 1]);
    await expect(service.obtenerConversacion(7, 4)).rejects.toBeInstanceOf(NotFoundException);
  });
});
