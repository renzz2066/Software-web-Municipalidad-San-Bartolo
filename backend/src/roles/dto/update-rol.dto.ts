import { IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRolDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'El nombre debe tener máximo 50 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La descripción debe tener máximo 200 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsArray({ message: 'Los niveles no son válidos' })
  @IsInt({ each: true, message: 'Los niveles no son válidos' })
  nivelIds?: number[];
}
