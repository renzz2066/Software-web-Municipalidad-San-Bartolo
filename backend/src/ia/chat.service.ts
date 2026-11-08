import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, RolMensajeChat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { EnviarMensajeDto } from './dto/chat.dto.js';
import { LlmError, LlmProvider, MensajeLlm, MotivoLlm } from './llm/llm.provider.js';
import { RagService } from './rag.service.js';
import {
  Fuente,
  RESPUESTA_SIN_INFORMACION,
  anonimizar,
  construirMensajeUsuario,
  construirSistema,
  fuentesDe,
  sinInformacion,
  tituloConversacion,
} from './prompt.js';

const HISTORIAL_LLM = 6; // últimos mensajes que se envían como contexto

const MENSAJES_ERROR: Record<MotivoLlm, string> = {
  SIN_KEY: 'El asistente no está configurado todavía. Avisa al administrador del sistema.',
  RED: 'No se pudo conectar con el servicio de IA. Revisa la conexión e inténtalo de nuevo.',
  CUOTA: 'El asistente alcanzó su límite de uso por ahora. Inténtalo en unos minutos.',
  PROVEEDOR: 'El servicio de IA no respondió correctamente. Inténtalo de nuevo.',
};

export interface MensajeChat {
  id: number;
  rol: RolMensajeChat;
  contenido: string;
  fuentes: Fuente[];
  createdAt: Date;
}

// Orquesta: anonimizar → embed → RAG → LLM → persistir (la IA solo escribe sus tablas de chat).
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
    private readonly llm: LlmProvider,
  ) {}

  async enviar(usuario: AuthenticatedUser, dto: EnviarMensajeDto) {
    const pregunta = anonimizar(dto.mensaje);
    if (!pregunta) {
      throw new BadRequestException('El mensaje está vacío');
    }
    const historial = dto.convId ? await this.historial(usuario.id, dto.convId) : [];

    let contenido = RESPUESTA_SIN_INFORMACION;
    let fuentes: Fuente[] = [];
    let tokens: number | null = null;
    try {
      const [embedding] = await this.llm.embed([pregunta], 'consulta');
      const fragmentos = await this.rag.buscar(embedding);
      if (fragmentos.length > 0) {
        const respuesta = await this.llm.generar(construirSistema(usuario.rol), [
          ...historial,
          { rol: 'USER', contenido: construirMensajeUsuario(pregunta, fragmentos) },
        ]);
        contenido = respuesta.texto;
        tokens = respuesta.tokens;
        // Si el LLM concluye que las guías no lo cubren, no se muestran fuentes engañosas.
        fuentes = sinInformacion(respuesta.texto) ? [] : fuentesDe(fragmentos);
      }
    } catch (e) {
      if (e instanceof LlmError) {
        this.logger.warn(`IA no disponible (${e.motivo}): ${e.message}`);
        throw new ServiceUnavailableException(MENSAJES_ERROR[e.motivo]);
      }
      throw e;
    }

    const ahora = new Date();
    return this.prisma.$transaction(async (tx) => {
      const conv = dto.convId
        ? await tx.chatConversacion.update({ where: { id: dto.convId }, data: { ultimoMensajeEn: ahora } })
        : await tx.chatConversacion.create({
            data: { usuarioId: usuario.id, titulo: tituloConversacion(pregunta), ultimoMensajeEn: ahora },
          });
      await tx.chatMensaje.create({
        data: { conversacionId: conv.id, rol: RolMensajeChat.USER, contenido: pregunta },
      });
      const ia = await tx.chatMensaje.create({
        data: {
          conversacionId: conv.id,
          rol: RolMensajeChat.IA,
          contenido,
          fragmentosJson: fuentes as unknown as Prisma.InputJsonValue,
          tokens,
        },
      });
      return { convId: conv.id, mensaje: aMensaje(ia) };
    });
  }

  listarConversaciones(usuarioId: number) {
    return this.prisma.chatConversacion.findMany({
      where: { usuarioId },
      orderBy: { ultimoMensajeEn: 'desc' },
      take: 30,
      select: { id: true, titulo: true, creadoEn: true, ultimoMensajeEn: true },
    });
  }

  async obtenerConversacion(usuarioId: number, id: number) {
    const conv = await this.prisma.chatConversacion.findFirst({
      where: { id, usuarioId },
      include: { mensajes: { orderBy: { id: 'asc' } } },
    });
    if (!conv) {
      throw new NotFoundException('Conversación no encontrada');
    }
    const { mensajes, ...datos } = conv;
    return { ...datos, mensajes: mensajes.map(aMensaje) };
  }

  // Solo conversaciones propias: una ajena responde 404 (no revela que existe).
  private async historial(usuarioId: number, convId: number): Promise<MensajeLlm[]> {
    const conv = await this.prisma.chatConversacion.findFirst({
      where: { id: convId, usuarioId },
      include: { mensajes: { orderBy: { id: 'desc' }, take: HISTORIAL_LLM } },
    });
    if (!conv) {
      throw new NotFoundException('Conversación no encontrada');
    }
    return conv.mensajes.reverse().map((m) => ({ rol: m.rol, contenido: m.contenido }));
  }
}

function aMensaje(m: {
  id: number;
  rol: RolMensajeChat;
  contenido: string;
  fragmentosJson: Prisma.JsonValue;
  createdAt: Date;
}): MensajeChat {
  const fuentes = Array.isArray(m.fragmentosJson) ? (m.fragmentosJson as unknown as Fuente[]) : [];
  return { id: m.id, rol: m.rol, contenido: m.contenido, fuentes, createdAt: m.createdAt };
}
