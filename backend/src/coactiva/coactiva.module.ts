import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RecepcionTransferenciaController } from './recepcion-transferencia/recepcion-transferencia.controller.js';
import { RecepcionTransferenciaService } from './recepcion-transferencia/recepcion-transferencia.service.js';
import { AsignarValoresController } from './asignar-valores/asignar-valores.controller.js';
import { AsignarValoresService } from './asignar-valores/asignar-valores.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RecepcionTransferenciaController, AsignarValoresController],
  providers: [RecepcionTransferenciaService, AsignarValoresService],
  exports: [RecepcionTransferenciaService, AsignarValoresService],
})
export class CoactivaModule {}