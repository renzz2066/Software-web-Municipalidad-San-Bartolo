import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CalculoController } from './calculo/calculo.controller.js';
import { CalculoService } from './calculo/calculo.service.js';
import { EstadoCuentaController } from './estado-cuenta/estado-cuenta.controller.js';
import { EstadoCuentaService } from './estado-cuenta/estado-cuenta.service.js';
import { FraccionamientoController } from './fraccionamiento/fraccionamiento.controller.js';
import { FraccionamientoService } from './fraccionamiento/fraccionamiento.service.js';
import { MaestrosController } from './maestros/maestros.controller.js';
import { MaestrosService } from './maestros/maestros.service.js';
import { TransferenciasController } from './transferencias/transferencias.controller.js';
import { TransferenciasService } from './transferencias/transferencias.service.js';
import { ValoresController } from './valores/valores.controller.js';
import { ValoresService } from './valores/valores.service.js';

// Rentas núcleo v1 (specs/rentas-nucleo-v1.md): maestros (A), cálculo (D) y estado de cuenta (E).
// Valores v1 (specs/rentas-valores-v1.md): emisión de OP/RD, fraccionamiento y transferencia a coactivo.
@Module({
  imports: [AuthModule],
  controllers: [MaestrosController, CalculoController, EstadoCuentaController, ValoresController, FraccionamientoController, TransferenciasController],
  providers: [MaestrosService, CalculoService, EstadoCuentaService, ValoresService, FraccionamientoService, TransferenciasService],
  exports: [MaestrosService, EstadoCuentaService],
})
export class RentasModule {}
