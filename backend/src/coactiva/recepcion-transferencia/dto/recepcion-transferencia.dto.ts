import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Solo se listan valores recibibles (COACTIVO transferidos por Rentas): no hay filtro de estado.
export class FiltroValoresDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  anio?: number;

  @IsOptional()
  @IsString()
  @IsIn(['OP', 'RD', 'RM'])
  tipo?: string;

  @IsOptional()
  @IsString()
  contribuyente?: string;

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
  @Max(100)
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
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
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
