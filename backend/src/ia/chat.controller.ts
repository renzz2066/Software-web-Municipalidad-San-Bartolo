import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { ChatService } from './chat.service.js';
import { EnviarMensajeDto } from './dto/chat.dto.js';

@Controller('ia/chat')
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('ayuda.chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  @HttpCode(200)
  enviar(@CurrentUser() usuario: AuthenticatedUser, @Body() dto: EnviarMensajeDto) {
    return this.chat.enviar(usuario, dto);
  }

  @Get('conversaciones')
  listar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.chat.listarConversaciones(usuario.id);
  }

  @Get('conversaciones/:id')
  obtener(@CurrentUser() usuario: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.chat.obtenerConversacion(usuario.id, id);
  }
}
