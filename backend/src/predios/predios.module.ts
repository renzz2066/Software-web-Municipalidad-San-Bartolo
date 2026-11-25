import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogosModule } from '../catalogos/catalogos.module.js';
import { DireccionesModule } from '../direcciones/direcciones.module.js';
import { PrediosController } from './predios.controller.js';
import { PrediosService } from './predios.service.js';

// DireccionesModule: la ubicación del predio es una dirección única (D01). CatalogosModule: R02, R05, R06.
@Module({
  imports: [AuthModule, CatalogosModule, DireccionesModule],
  controllers: [PrediosController],
  providers: [PrediosService],
  exports: [PrediosService],
})
export class PrediosModule {}
