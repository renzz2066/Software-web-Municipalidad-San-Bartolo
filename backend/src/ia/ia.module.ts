import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { RagService } from './rag.service.js';
import { LlmProvider } from './llm/llm.provider.js';
import { GeminiProvider } from './llm/gemini.provider.js';

// Chat San Bartolo (specs/ia-chat-v1.md).
@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    RagService,
    {
      provide: LlmProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new GeminiProvider({
          apiKey: config.get<string>('GEMINI_API_KEY'),
          model: config.get<string>('GEMINI_MODEL'),
          fallbackModel: config.get<string>('GEMINI_MODEL_RESPALDO'),
          embedModel: config.get<string>('GEMINI_EMBED_MODEL'),
          timeoutMs: Number(config.get('GEMINI_TIMEOUT_MS') ?? 30000),
        }),
    },
  ],
})
export class IaModule {}
