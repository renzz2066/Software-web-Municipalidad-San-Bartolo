import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { NIVEL_KEY } from '../auth/decorators/nivel.decorator.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { contextoAuditoria } from './auditoria-contexto.js';

// Corre después de los guards: el usuario ya viene del JWT.
// módulo = primer código de @RequireNivel del handler o del controller.
@Injectable()
export class AuditoriaContextoInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = contextoAuditoria.getStore();
    if (ctx && context.getType() === 'http') {
      const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
      if (user) {
        ctx.usuarioId = user.id;
        ctx.usuarioNombre = user.usuario;
      }
      const niveles = this.reflector.getAllAndOverride<string[] | undefined>(NIVEL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      ctx.modulo = niveles?.[0] ?? null;
    }
    return next.handle();
  }
}
