import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogosModule } from '../catalogos/catalogos.module.js';
import { DeclaracionesController } from './declaraciones.controller.js';
import { DeclaracionesService } from './declaraciones.service.js';

// DJ presentada con anexos por predio (specs/rentas-nucleo-v2.md, Fase 4).
@Module({
  imports: [AuthModule, CatalogosModule],
  controllers: [DeclaracionesController],
  providers: [DeclaracionesService],
  exports: [DeclaracionesService],
})
export class DeclaracionesModule {}
