import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MaestrosController } from './maestros/maestros.controller.js';
import { MaestrosService } from './maestros/maestros.service.js';

// Rentas núcleo v1 (specs/rentas-nucleo-v1.md). Fase A: maestros.
@Module({
  imports: [AuthModule],
  controllers: [MaestrosController],
  providers: [MaestrosService],
  exports: [MaestrosService],
})
export class RentasModule {}
