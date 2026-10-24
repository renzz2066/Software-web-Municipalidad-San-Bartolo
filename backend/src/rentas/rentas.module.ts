import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrediosModule } from '../predios/predios.module.js';
import { CalculoController } from './calculo/calculo.controller.js';
import { CalculoService } from './calculo/calculo.service.js';
import { EstadoCuentaController } from './estado-cuenta/estado-cuenta.controller.js';
import { EstadoCuentaService } from './estado-cuenta/estado-cuenta.service.js';
import { FiscalizacionController } from './fiscalizacion/fiscalizacion.controller.js';
import { FiscalizacionService } from './fiscalizacion/fiscalizacion.service.js';
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
// Fiscalización v1 (specs/rentas-fiscalizacion-v1.md): expedientes, fichas, RD por diferencias y multas.
@Module({
  imports: [AuthModule, PrediosModule],
  controllers: [MaestrosController, CalculoController, EstadoCuentaController, ValoresController, FraccionamientoController, TransferenciasController, FiscalizacionController],
  providers: [MaestrosService, CalculoService, EstadoCuentaService, ValoresService, FraccionamientoService, TransferenciasService, FiscalizacionService],
  exports: [MaestrosService, EstadoCuentaService],
})
export class RentasModule {}
