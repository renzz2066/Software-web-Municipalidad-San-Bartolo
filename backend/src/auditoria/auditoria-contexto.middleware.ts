import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { contextoAuditoria, contextoVacio } from './auditoria-contexto.js';

// IP y userAgent los toma el servidor (no el cliente). Sin `trust proxy`,
// req.ip es la IP del socket: X-Forwarded-For no se puede falsificar.
@Injectable()
export class AuditoriaContextoMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const ip = req.ip ?? req.socket.remoteAddress ?? null;
    const userAgent = req.headers['user-agent']?.slice(0, 255) ?? null;
    contextoAuditoria.run(contextoVacio(ip, userAgent), () => next());
  }
}
