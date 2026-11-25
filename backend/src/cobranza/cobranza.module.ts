import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CobranzaController } from './cobranza.controller.js';
import { CobranzaService } from './cobranza.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CobranzaController],
  providers: [CobranzaService],
})
export class CobranzaModule {}
