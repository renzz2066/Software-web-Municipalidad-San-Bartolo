import { IsInt, IsOptional, IsString, Min, IsIn, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class FiltroValoresDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anio?: number;

  @IsOptional()
  @IsString()
  @IsIn(['OP', 'RD'])
  tipo?: string;

  @IsOptional()
  @IsString()
  contribuyente?: string;

  @IsOptional()
  @IsString()
  @IsIn(['EMITIDO', 'NOTIFICADO', 'COACTIVO', 'CANCELADO', 'ANULADO'])
  estado?: string;

  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  memorandumId?: number;
}

export class TransferenciaIndividualDto {
  @IsInt()
  ejecutorId: number;

  @IsInt()
  auxiliarId: number;

  @IsOptional()
  @IsInt()
  tipoGestionId?: number;
}

export class TransferenciaMasivaDto {
  @IsInt({ each: true })
  valorIds: number[];

  @IsInt()
  ejecutorId: number;

  @IsInt()
  auxiliarId: number;

  @IsOptional()
  @IsInt()
  tipoGestionId?: number;
}