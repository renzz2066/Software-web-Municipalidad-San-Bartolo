import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ArrayUnique, IsArray, IsIn, IsInt, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload.type.js';
import { DeterminacionMasivaService } from './masiva.service.js';
import type { Tributo } from './reliquidacion.reglas.js';

export class CalculoDto {
  @IsInt({ message: 'Indica el año fiscal' })
  anio: number;

  // Sin contribuyente = masivo (exige nivel rentas.calculo-masivo).
  @IsOptional()
  @IsInt()
  contribuyenteId?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(['PREDIAL', 'ARBITRIOS'], { each: true, message: 'Tributo no válido' })
  tributos?: Tributo[];
}

// Determinación anual (specs/rentas-nucleo-v2.md, Fase 6; J09). Simular no escribe nada; ejecutar
// liquida el año y es idempotente. Sin contribuyente es la masiva (nivel rentas.calculo-masivo).
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.registro-tributario', 'rentas.calculo-masivo')
@Controller('rentas/calculo')
export class CalculoController {
  constructor(private readonly calculo: DeterminacionMasivaService) {}

  @Post('simular')
  @HttpCode(HttpStatus.OK)
  simular(@Body() dto: CalculoDto, @CurrentUser() usuario: AuthenticatedUser) {
    return this.calculo.simular(dto, usuario);
  }

  @Post('ejecutar')
  @HttpCode(HttpStatus.OK)
  ejecutar(@Body() dto: CalculoDto, @CurrentUser() usuario: AuthenticatedUser) {
    return this.calculo.ejecutar(dto, usuario);
  }
}
