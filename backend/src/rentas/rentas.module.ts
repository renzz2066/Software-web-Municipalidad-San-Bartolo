import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CalculoController } from './calculo/calculo.controller.js';
import { CalculoService } from './calculo/calculo.service.js';
import { EstadoCuentaController } from './estado-cuenta/estado-cuenta.controller.js';
import { EstadoCuentaService } from './estado-cuenta/estado-cuenta.service.js';
import { MaestrosController } from './maestros/maestros.controller.js';
import { MaestrosService } from './maestros/maestros.service.js';

// Rentas núcleo v1 (specs/rentas-nucleo-v1.md): maestros (A), cálculo (D) y estado de cuenta (E).
@Module({
  imports: [AuthModule],
  controllers: [MaestrosController, CalculoController, EstadoCuentaController],
  providers: [MaestrosService, CalculoService, EstadoCuentaService],
  exports: [MaestrosService, EstadoCuentaService],
})
export class RentasModule {}
