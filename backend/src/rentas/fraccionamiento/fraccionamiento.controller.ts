import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsInt, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';
import { FraccionamientoService } from './fraccionamiento.service.js';

export class ConvenioDto {
  @IsInt({ message: 'Indica el contribuyente' })
  contribuyenteId: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Elige al menos una deuda' })
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsInt({ each: true })
  cuentaIds: number[];

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'La cuota inicial debe ser un monto con 2 decimales' })
  @Min(0)
  cuotaInicial: number;

  @IsInt({ message: 'El número de cuotas debe ser entero' })
  @Min(1, { message: 'El número de cuotas debe ser al menos 1' })
  numCuotas: number;
}

export class AnularConvenioDto {
  @IsString({ message: 'Indica el motivo de la anulación' })
  @MaxLength(200, { message: 'El motivo debe tener máximo 200 caracteres' })
  motivo: string;
}

// Fraccionamiento de deuda (specs/rentas-valores-v1.md, V6).
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.control-recaudacion')
@Controller('rentas/convenios')
export class FraccionamientoController {
  constructor(private readonly fraccionamiento: FraccionamientoService) {}

  @Get('deudas')
  deudas(@Query('contribuyenteId', ParseIntPipe) contribuyenteId: number) {
    return this.fraccionamiento.deudas(contribuyenteId);
  }

  @Post('simular')
  @HttpCode(HttpStatus.OK)
  simular(@Body() dto: ConvenioDto) {
    return this.fraccionamiento.simular(dto);
  }

  @Post('ejecutar')
  @HttpCode(HttpStatus.OK)
  ejecutar(@Body() dto: ConvenioDto) {
    return this.fraccionamiento.ejecutar(dto);
  }

  @Get()
  listar(@Query('contribuyenteId', ParseIntPipe) contribuyenteId: number) {
    return this.fraccionamiento.listar(contribuyenteId);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.fraccionamiento.obtener(id);
  }

  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  anular(@Param('id', ParseIntPipe) id: number, @Body() dto: AnularConvenioDto) {
    return this.fraccionamiento.anular(id, dto.motivo);
  }
}
