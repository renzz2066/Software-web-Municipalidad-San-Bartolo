import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { contextoMuni } from './muni.registro.js';

// La base de UNA muni caída responde 503 en esa muni; las demás siguen atendiendo.
@Catch(Prisma.PrismaClientInitializationError)
export class BaseNoDisponibleFilter implements ExceptionFilter {
  private readonly logger = new Logger(BaseNoDisponibleFilter.name);

  catch(error: Prisma.PrismaClientInitializationError, host: ArgumentsHost) {
    const muni = contextoMuni.getStore();
    this.logger.error(`Base de "${muni?.slug ?? '?'}" no disponible: ${error.message}`);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.SERVICE_UNAVAILABLE)
      .json({
        message: `No se pudo conectar con la base de datos de ${muni?.nombreCorto ?? 'la municipalidad'}. Intenta en unos minutos.`,
        error: 'Service Unavailable',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      });
  }
}
