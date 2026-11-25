import { EstadoGestionCobranza, GrupoCobranza } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class ImportarLoteDto {
  @IsString()
  @MaxLength(120)
  archivo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  modelo?: string;
}

export class AnioDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El año no es válido' })
  @Min(2000)
  @Max(2100)
  anio?: number;
}

export class FiltroPuntajesDto extends AnioDto {
  @IsOptional()
  @IsIn(['A', 'B', 'C'], { message: 'El tramo debe ser A, B o C' })
  tramo?: 'A' | 'B' | 'C';

  @IsOptional()
  @IsEnum(GrupoCobranza, { message: 'El grupo no es válido' })
  grupo?: GrupoCobranza;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  accion?: string;

  @IsOptional()
  @IsEnum(EstadoGestionCobranza, { message: 'El estado de gestión no es válido' })
  estado?: EstadoGestionCobranza;

  // Código SIMUN, DNI/RUC o parte del nombre
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'Máximo 100 registros por página' })
  pageSize: number = 20;
}

export class HistorialGestionDto {
  @Type(() => Number)
  @IsInt({ message: 'El año no es válido' })
  anio!: number;

  @Matches(/^\d{7}$/, { message: 'El código SIMUN debe tener 7 dígitos' })
  codigo!: string;
}

export class CrearGestionDto extends HistorialGestionDto {
  @IsEnum(EstadoGestionCobranza, { message: 'El estado de gestión no es válido' })
  estado!: EstadoGestionCobranza;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La observación admite hasta 500 caracteres' })
  observacion?: string;
}
