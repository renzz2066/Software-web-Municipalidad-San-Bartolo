import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';
import { EstadoCuentaService } from './estado-cuenta.service.js';

// Mismo endpoint para Rentas, Caja y Coactiva (specs/rentas-nucleo-v1.md, C6).
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.registro-tributario', 'caja', 'coactivo')
@Controller('contribuyentes')
export class EstadoCuentaController {
  constructor(private readonly estadoCuenta: EstadoCuentaService) {}

  @Get(':id/estado-cuenta')
  generar(@Param('id', ParseIntPipe) id: number, @Query('fecha') fecha?: string) {
    return this.estadoCuenta.generar(id, fecha);
  }
}
