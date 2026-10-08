import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [RolesController],
  providers: [RolesService, RolesGuard],
  exports: [RolesService],
})
export class RolesModule {}
