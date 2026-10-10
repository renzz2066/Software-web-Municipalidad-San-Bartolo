import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NivelesController } from './niveles.controller.js';
import { NivelesService } from './niveles.service.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [NivelesController],
  providers: [NivelesService, RolesGuard],
  exports: [NivelesService],
})
export class NivelesModule {}
