import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { AuditoriaContextoInterceptor } from './auditoria-contexto.interceptor.js';
import { AuditoriaController } from './auditoria.controller.js';
import { AuditoriaService } from './auditoria.service.js';

// Global: AuthService usa AuditoriaService sin importar este módulo (evita ciclo).
@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, { provide: APP_INTERCEPTOR, useClass: AuditoriaContextoInterceptor }],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
