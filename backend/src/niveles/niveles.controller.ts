import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { NivelesService } from './niveles.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';

@UseGuards(JwtAuthGuard)
@Controller('niveles')
export class NivelesController {
  constructor(private readonly nivelesService: NivelesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.nivelesService.findAll(user.rol);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('sincronizar')
  @HttpCode(HttpStatus.OK)
  sincronizar() {
    return this.nivelesService.sincronizar();
  }
}
