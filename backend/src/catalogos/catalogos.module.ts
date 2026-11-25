import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogosController } from './catalogos.controller.js';
import { CatalogosService } from './catalogos.service.js';

// Catálogos con código + ReglaMuni (specs/rentas-nucleo-v2.md, Fase 0).
@Module({
  imports: [AuthModule],
  controllers: [CatalogosController],
  providers: [CatalogosService],
  exports: [CatalogosService],
})
export class CatalogosModule {}
