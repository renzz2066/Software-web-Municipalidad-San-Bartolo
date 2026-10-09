import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NIVEL_KEY } from '../decorators/nivel.decorator.js';

@Injectable()
export class NivelGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requeridos = this.reflector.getAllAndOverride<string[]>(NIVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requeridos || requeridos.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.id) {
      return false;
    }

    const accesos = await this.prisma.rolNivel.findMany({
      where: { rol: { usuarios: { some: { id: user.id } } } },
      select: { nivel: { select: { codigo: true } } },
    });
    const codigos = new Set(accesos.map((a) => a.nivel.codigo));
    return requeridos.every((codigo) => codigos.has(codigo));
  }
}
