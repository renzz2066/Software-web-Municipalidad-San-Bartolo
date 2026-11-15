import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { contextoMuni } from './muni.registro.js';

// Códigos de Prisma que significan "la base no responde" con el cliente ya conectado:
// sin servidor, timeout, base inexistente o conexión cerrada (pris.ly/d/error-reference).
const CODIGOS_CONEXION = new Set(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017']);

export function esBaseNoDisponible(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return error instanceof Prisma.PrismaClientKnownRequestError && CODIGOS_CONEXION.has(error.code);
}

// La base de UNA muni caída responde 503 en esa muni; las demás siguen atendiendo.
// Cubre la caída al primer uso (InitializationError) y la caída en pleno uso (P1xxx).
// Cualquier otro error de Prisma (P2002, etc.) sigue el manejo normal de Nest.
@Catch(Prisma.PrismaClientInitializationError, Prisma.PrismaClientKnownRequestError)
export class BaseNoDisponibleFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(BaseNoDisponibleFilter.name);

  catch(error: Prisma.PrismaClientInitializationError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (!esBaseNoDisponible(error)) return super.catch(error, host);

    const muni = contextoMuni.getStore();
    const codigo = 'code' in error ? error.code : error.errorCode;
    this.logger.error(`Base de "${muni?.slug ?? '?'}" no disponible (${codigo ?? 'sin código'}): ${error.message}`);
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
