import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { TipoValor } from '@prisma/client';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';
import { TransferenciasService } from './transferencias.service.js';

export class TransferenciaDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([TipoValor.OP, TipoValor.RD], { each: true, message: 'Tipo de valor no válido (OP o RD)' })
  tipos?: TipoValor[];

  // Valores elegidos de la simulación; sin lista se transfieren todos los exigibles.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ArrayUnique()
  @IsInt({ each: true })
  valorIds?: number[];
}

// Transferencia de valores a Cobranza Coactiva (specs/rentas-valores-v1.md, V7).
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.control-recaudacion')
@Controller('rentas/transferencias')
export class TransferenciasController {
  constructor(private readonly transferencias: TransferenciasService) {}

  @Post('simular')
  @HttpCode(HttpStatus.OK)
  simular(@Body() dto: TransferenciaDto) {
    return this.transferencias.simular(dto);
  }

  @Post('ejecutar')
  @HttpCode(HttpStatus.OK)
  ejecutar(@Body() dto: TransferenciaDto) {
    return this.transferencias.ejecutar(dto);
  }

  @Get()
  listar() {
    return this.transferencias.listar();
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.transferencias.obtener(id);
  }
}
