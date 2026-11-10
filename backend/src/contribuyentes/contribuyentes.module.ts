import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { ContribuyentesController } from './contribuyentes.controller.js';
import { ContribuyentesService } from './contribuyentes.service.js';
import { IdentidadService } from './identidad/identidad.service.js';
import { IdentidadProvider } from './identidad/identidad.provider.js';

@Module({
  imports: [AuthModule],
  controllers: [ContribuyentesController],
  providers: [
    ContribuyentesService,
    IdentidadService,
    {
      provide: IdentidadProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new IdentidadProvider({
          baseUrl: config.get<string>('IDENTIDAD_API_BASE'),
          apiKey: config.get<string>('IDENTIDAD_API_KEY'),
          timeoutMs: Number(config.get('IDENTIDAD_TIMEOUT_MS') ?? 6000),
        }),
    },
  ],
  exports: [ContribuyentesService],
})
export class ContribuyentesModule {}
