import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { CierresService } from './cierres.service.js';

export class CierreDto {
  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El efectivo contado debe ser un monto con 2 decimales' })
  @Min(0)
  @Max(9_999_999)
  efectivoDeclarado?: number;
}

// Cierre diario por cajero y consulta de cierres (specs/caja-v1.md, K5–K7).
@UseGuards(JwtAuthGuard, NivelGuard)
@Controller('caja')
export class CierresController {
  constructor(private readonly cierres: CierresService) {}

  @Get('cierre')
  @RequireNivel('caja.cancelaciones', 'caja.extornos')
  resumen(@Query('fecha') fecha: string | undefined, @CurrentUser() usuario: AuthenticatedUser) {
    return this.cierres.resumen(fecha, usuario);
  }

  @Post('cierre')
  @RequireNivel('caja.cancelaciones', 'caja.extornos')
  cerrar(@Body() dto: CierreDto, @CurrentUser() usuario: AuthenticatedUser) {
    return this.cierres.cerrar(dto.fecha, dto.efectivoDeclarado, usuario);
  }

  @Get('cierres')
  @RequireNivel('caja.reportes')
  listar(@Query('fecha') fecha?: string) {
    return this.cierres.listar(fecha);
  }

  @Get('cierres/:id')
  @RequireNivel('caja.cancelaciones', 'caja.extornos', 'caja.reportes')
  obtener(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: AuthenticatedUser) {
    return this.cierres.obtener(id, usuario);
  }
}
