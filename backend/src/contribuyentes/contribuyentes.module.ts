import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContribuyentesController } from './contribuyentes.controller.js';
import { ContribuyentesService } from './contribuyentes.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ContribuyentesController],
  providers: [ContribuyentesService],
  exports: [ContribuyentesService],
})
export class ContribuyentesModule {}
