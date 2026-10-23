import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { MedioPago } from '@prisma/client';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { MAX_CUOTAS_POR_RECIBO } from './caja.reglas.js';
import { CobrosService } from './cobros.service.js';

export class SeleccionCobroDto {
  @IsInt({ message: 'Indica el contribuyente' })
  contribuyenteId: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Elige al menos una cuota' })
  @ArrayMaxSize(MAX_CUOTAS_POR_RECIBO, { message: `Un recibo admite hasta ${MAX_CUOTAS_POR_RECIBO} cuotas` })
  @ArrayUnique({ message: 'Hay cuotas repetidas en el cobro' })
  @IsInt({ each: true })
  cuentaIds: number[];
}

export class CobroDto extends SeleccionCobroDto {
  @IsEnum(MedioPago, { message: 'Medio de pago no válido' })
  medioPago: MedioPago;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El n.° de operación debe tener máximo 30 caracteres' })
  numOperacion?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El total debe ser un monto con 2 decimales' })
  @Min(0)
  totalEsperado: number;
}

// Cobro en ventanilla y recibo (specs/caja-v1.md, K1–K3).
@UseGuards(JwtAuthGuard, NivelGuard)
@Controller('caja')
export class CobrosController {
  constructor(private readonly cobros: CobrosService) {}

  @Post('cobros/liquidar')
  @HttpCode(HttpStatus.OK)
  @RequireNivel('caja.cancelaciones')
  liquidar(@Body() dto: SeleccionCobroDto) {
    return this.cobros.liquidar(dto);
  }

  @Post('cobros')
  @RequireNivel('caja.cancelaciones')
  cobrar(@Body() dto: CobroDto, @CurrentUser() usuario: AuthenticatedUser) {
    return this.cobros.cobrar(dto, usuario);
  }

  @Get('recibos/:id')
  @RequireNivel('caja.cancelaciones', 'caja.extornos', 'caja.reportes')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.cobros.obtener(id);
  }
}
