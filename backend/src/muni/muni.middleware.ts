import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { contextoMuni, resolverMuni } from './muni.registro.js';
import { MuniService } from './muni.service.js';

// Corre antes que todo: fija la muni de la petición para PrismaService y el JwtAuthGuard.
@Injectable()
export class MuniMiddleware implements NestMiddleware {
  constructor(private readonly munis: MuniService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const cabecera = req.headers['x-muni'];
    const muni = resolverMuni(this.munis.registro, Array.isArray(cabecera) ? cabecera[0] : cabecera);
    if (!muni) throw new NotFoundException('Municipalidad no encontrada');
    contextoMuni.run(muni, () => next());
  }
}
