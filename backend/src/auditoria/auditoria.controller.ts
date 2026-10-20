import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AuditoriaService } from './auditoria.service.js';
import { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto.js';

// Solo lectura: la auditoría no se edita ni se borra (tampoco en BD).
// Exige rol ADMIN Y el nivel (specs/auditoria-pantalla-v1.md, D1).
@UseGuards(JwtAuthGuard, RolesGuard, NivelGuard)
@Roles('ADMIN')
@RequireNivel('accesibilidad.auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  listar(@Query() filtro: FiltroAuditoriaDto) {
    return this.auditoriaService.listar(filtro);
  }
}
