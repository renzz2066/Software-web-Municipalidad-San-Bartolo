import { AccionAuditoria } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class FiltroAuditoriaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El usuario no es válido' })
  @Min(1)
  usuarioId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tabla?: string;

  @IsOptional()
  @IsEnum(AccionAuditoria, { message: 'La acción no es válida' })
  accion?: AccionAuditoria;

  // AAAA-MM-DD (día completo en hora de Lima) o fecha-hora ISO
  @IsOptional()
  @IsDateString({}, { message: 'La fecha desde no es válida' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha hasta no es válida' })
  hasta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registroId?: string;

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
