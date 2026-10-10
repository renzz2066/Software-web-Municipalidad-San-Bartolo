import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRolDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(50, { message: 'El nombre debe tener máximo 50 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'La descripción debe tener máximo 200 caracteres' })
  descripcion?: string;

  @IsArray({ message: 'Los niveles no son válidos' })
  @ArrayNotEmpty({ message: 'Selecciona al menos un nivel' })
  @IsInt({ each: true, message: 'Los niveles no son válidos' })
  nivelIds: number[];
}
