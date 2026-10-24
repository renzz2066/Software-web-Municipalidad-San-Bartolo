import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { EstadoFiscalizacion, ModalidadNotificacion, TipoFiscalizacion } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { DatosPredioDto, OtraInstalacionDto, PisoDto } from '../../predios/dto/declaracion.dto.js';
import { FiscalizacionService } from './fiscalizacion.service.js';

export class AperturaDto {
  @IsEnum(TipoFiscalizacion, { message: 'Tipo no válido (ORDINARIA o A_SOLICITUD)' })
  tipo: TipoFiscalizacion;

  @IsInt({ message: 'Indica el contribuyente' })
  contribuyenteId: number;

  @IsInt({ message: 'Elige el fiscalizador' })
  fiscalizadorId: number;

  @IsInt()
  anioDesde: number;

  @IsInt()
  anioHasta: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Elige al menos un predio a fiscalizar' })
  @ArrayMaxSize(50)
  @ArrayUnique({ message: 'Hay predios repetidos en el expediente' })
  @IsInt({ each: true })
  predioIds: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class NotificacionRequerimientoDto {
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

export class RequerimientoDto {
  @IsDateString({}, { message: 'La fecha de inspección debe ser AAAA-MM-DD' })
  fechaInspeccion: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora de inspección debe ser HH:MM' })
  horaInspeccion: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificacionRequerimientoDto)
  notificacion?: NotificacionRequerimientoDto | null;
}

// Mismos datos que la DJ (la ficha se aplicará al predio como DJ de motivo FISCALIZACION).
export class FichaDto {
  @ValidateNested()
  @Type(() => DatosPredioDto)
  predio: DatosPredioDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PisoDto)
  pisos: PisoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OtraInstalacionDto)
  otrasInstalaciones: OtraInstalacionDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class AnularExpedienteDto {
  @IsString({ message: 'Indica el motivo de la anulación' })
  @MaxLength(200, { message: 'El motivo debe tener máximo 200 caracteres' })
  motivo: string;
}

export class FiltrosExpedientesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  contribuyenteId?: number;

  @IsOptional()
  @IsEnum(EstadoFiscalizacion)
  estado?: EstadoFiscalizacion;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  anio?: number;
}

// Expedientes de fiscalización (specs/rentas-fiscalizacion-v1.md, F1–F3, F8).
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.fiscalizacion')
@Controller('rentas/fiscalizacion')
export class FiscalizacionController {
  constructor(private readonly fiscalizacion: FiscalizacionService) {}

  @Get('opciones')
  opciones(@Query('contribuyenteId', ParseIntPipe) contribuyenteId: number) {
    return this.fiscalizacion.opciones(contribuyenteId);
  }

  @Get('expedientes')
  listar(@Query() filtros: FiltrosExpedientesDto) {
    return this.fiscalizacion.listar(filtros);
  }

  @Post('expedientes')
  abrir(@Body() dto: AperturaDto) {
    return this.fiscalizacion.abrir(dto);
  }

  @Get('expedientes/:id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.fiscalizacion.obtener(id);
  }

  @Patch('expedientes/:id/requerimiento')
  requerimiento(@Param('id', ParseIntPipe) id: number, @Body() dto: RequerimientoDto) {
    return this.fiscalizacion.requerimiento(id, dto);
  }

  @Put('expedientes/:id/fichas/:predioId')
  guardarFicha(@Param('id', ParseIntPipe) id: number, @Param('predioId', ParseIntPipe) predioId: number, @Body() dto: FichaDto) {
    return this.fiscalizacion.guardarFicha(id, predioId, dto);
  }

  @Post('expedientes/:id/anular')
  @HttpCode(HttpStatus.OK)
  anular(@Param('id', ParseIntPipe) id: number, @Body() dto: AnularExpedienteDto) {
    return this.fiscalizacion.anular(id, dto.motivo);
  }
}
