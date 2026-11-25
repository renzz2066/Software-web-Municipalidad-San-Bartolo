import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogosModule } from '../catalogos/catalogos.module.js';
import { RentasModule } from '../rentas/rentas.module.js';
import { DeclaracionesController } from './declaraciones.controller.js';
import { DeclaracionesService } from './declaraciones.service.js';
import { ProrrogasService } from './prorrogas.service.js';

// DJ presentada con anexos por predio (specs/rentas-nucleo-v2.md, Fase 4); RentasModule: determinar,
// liquidar y multa 176.1 (Fase 5); prórrogas de presentación (Fase 7, J16).
@Module({
  imports: [AuthModule, CatalogosModule, RentasModule],
  controllers: [DeclaracionesController],
  providers: [DeclaracionesService, ProrrogasService],
  exports: [DeclaracionesService],
})
export class DeclaracionesModule {}
