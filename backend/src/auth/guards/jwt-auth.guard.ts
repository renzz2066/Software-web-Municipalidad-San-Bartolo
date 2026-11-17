import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { MuniService } from '../../muni/muni.service.js';
import type { JwtPayload } from '../types/jwt-payload.type.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly munis: MuniService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Token de otra muni (o emitido antes de multi-muni): se reingresa en esta.
    if (payload.muni !== this.munis.actual().slug) {
      throw new UnauthorizedException('La sesión pertenece a otra municipalidad. Vuelve a ingresar.');
    }

    (request as Request & { user: unknown }).user = {
      id: payload.sub,
      usuario: payload.usuario,
      rol: payload.rol,
      niveles: Array.isArray(payload.niveles) ? payload.niveles : [],
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
