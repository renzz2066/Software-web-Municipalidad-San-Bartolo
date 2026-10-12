import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NIVEL_KEY } from '../decorators/nivel.decorator.js';

// Sin BD: lee los accesos del claim `niveles` del JWT (fijados en el login).
// Si cambian los accesos del rol, el usuario debe reingresar.
@Injectable()
export class NivelGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[]>(NIVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const niveles: unknown = user?.niveles;
    if (!Array.isArray(niveles)) {
      return false;
    }

    // Basta con UNO de los códigos (los listados aceptan su nivel o accesos-por-rol)
    return requeridos.some((codigo) => (niveles as string[]).includes(codigo));
  }
}
