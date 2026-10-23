import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CobrosController } from './cobros.controller.js';
import { CobrosService } from './cobros.service.js';
import { ExtornosService } from './extornos.service.js';

// Caja v1 (specs/caja-v1.md): cobros en ventanilla, recibos, extornos y cierre diario.
@Module({
  imports: [AuthModule],
  controllers: [CobrosController],
  providers: [CobrosService, ExtornosService],
})
export class CajaModule {}
