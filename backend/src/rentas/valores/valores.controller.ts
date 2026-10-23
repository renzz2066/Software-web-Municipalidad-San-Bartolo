import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { TipoValor } from '@prisma/client';
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';
import { ValoresService } from './valores.service.js';

export class EmisionDto {
  @IsInt({ message: 'Indica el año fiscal' })
  anio: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([TipoValor.OP, TipoValor.RD], { each: true, message: 'Tipo de valor no válido (OP o RD)' })
  tipos?: TipoValor[];

  // Sin contribuyente = emisión masiva.
  @IsOptional()
  @IsInt()
  contribuyenteId?: number;

  @IsOptional()
  @IsInt()
  zonaId?: number;

  @IsOptional()
  @IsBoolean()
  soloVencidas?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto mínimo debe ser un monto con 2 decimales' })
  @Min(0)
  montoMinimo?: number;
}

// Emisión de OP/RD (specs/rentas-valores-v1.md, V1-V3 y V9).
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.control-recaudacion')
@Controller('rentas/valores')
export class ValoresController {
  constructor(private readonly valores: ValoresService) {}

  @Post('simular')
  @HttpCode(HttpStatus.OK)
  simular(@Body() dto: EmisionDto) {
    return this.valores.simular(dto);
  }

  @Post('ejecutar')
  @HttpCode(HttpStatus.OK)
  ejecutar(@Body() dto: EmisionDto) {
    return this.valores.ejecutar(dto);
  }

  @Get()
  listar(@Query('contribuyenteId', ParseIntPipe) contribuyenteId: number) {
    return this.valores.listar(contribuyenteId);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.valores.obtener(id);
  }
}
