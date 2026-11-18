import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogosModule } from '../catalogos/catalogos.module.js';
import { DireccionesController } from './direcciones.controller.js';
import { DireccionesService } from './direcciones.service.js';

// Direcciones únicas (specs/rentas-nucleo-v2.md, Fase 2). Lo usa el domicilio de las personas.
@Module({
  imports: [AuthModule, CatalogosModule],
  controllers: [DireccionesController],
  providers: [DireccionesService],
  exports: [DireccionesService],
})
export class DireccionesModule {}
