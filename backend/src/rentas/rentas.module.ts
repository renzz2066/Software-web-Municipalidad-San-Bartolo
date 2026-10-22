import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CalculoController } from './calculo/calculo.controller.js';
import { CalculoService } from './calculo/calculo.service.js';
import { MaestrosController } from './maestros/maestros.controller.js';
import { MaestrosService } from './maestros/maestros.service.js';

// Rentas núcleo v1 (specs/rentas-nucleo-v1.md): maestros (Fase A) y cálculo (Fase D).
@Module({
  imports: [AuthModule],
  controllers: [MaestrosController, CalculoController],
  providers: [MaestrosService, CalculoService],
  exports: [MaestrosService],
})
export class RentasModule {}
