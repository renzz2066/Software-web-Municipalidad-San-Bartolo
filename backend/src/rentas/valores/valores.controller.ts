import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ModalidadNotificacion, TipoValor } from '@prisma/client';
import type { TipoValorEmision } from './valores.reglas.js';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
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
  tipos?: TipoValorEmision[];

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

export class NotificacionDto {
  @IsDateString({}, { message: 'La fecha de notificación debe ser AAAA-MM-DD' })
  fecha: string;

  @IsEnum(ModalidadNotificacion, { message: 'Modalidad no válida (PERSONAL, NEGATIVA, CEDULON, PUBLICACION)' })
  modalidad: ModalidadNotificacion;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  dni?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;
}

export class AnulacionDto {
  @IsString({ message: 'Indica el motivo de la anulación' })
  @MaxLength(200, { message: 'El motivo debe tener máximo 200 caracteres' })
  motivo: string;
}

// Emisión de OP/RD, notificación y anulación (specs/rentas-valores-v1.md, V1-V5 y V9).
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

  // También lo abre Fiscalización: sus RD de fiscalización (specs/rentas-fiscalizacion-v1.md, decisión 4).
  @Get(':id')
  @RequireNivel('rentas.control-recaudacion', 'rentas.fiscalizacion')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.valores.obtener(id);
  }

  @Patch(':id/notificacion')
  notificar(@Param('id', ParseIntPipe) id: number, @Body() dto: NotificacionDto) {
    return this.valores.notificar(id, dto);
  }

  @Post(':id/anular')
  @HttpCode(HttpStatus.OK)
  anular(@Param('id', ParseIntPipe) id: number, @Body() dto: AnulacionDto) {
    return this.valores.anular(id, dto.motivo);
  }
}
