import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrediosController } from './predios.controller.js';
import { PrediosService } from './predios.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PrediosController],
  providers: [PrediosService],
  exports: [PrediosService],
})
export class PrediosModule {}
