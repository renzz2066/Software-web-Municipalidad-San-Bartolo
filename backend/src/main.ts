import { ValidationPipe } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { NestFactory } from '@nestjs/core';
import type { Request } from 'express';
import { AppModule } from './app.module.js';
import { hostsPermitidos } from './muni/muni.registro.js';
import { MuniService } from './muni/muni.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Orígenes = hosts de las munis activas + FRONTEND_URL (specs/multi-muni-v1.md).
  // Excepción: GET /muni/config es público, así un subdominio desconocido puede leer
  // su 404 y mostrar "Municipalidad no encontrada" en vez de un error de conexión.
  const permitidos = hostsPermitidos(app.get(MuniService).registro);
  const origenPermitido = (origen: string) => {
    try {
      return permitidos.has(new URL(origen).hostname);
    } catch {
      return false;
    }
  };
  app.enableCors((req: Request, listo: (err: Error | null, opciones: CorsOptions) => void) => {
    const origen = req.header('origin');
    const publico = req.path === '/muni/config';
    listo(null, {
      origin: !origen || origenPermitido(origen) || publico,
      credentials: !publico,
    });
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
