import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'El usuario debe tener máximo 50 caracteres' })
  usuario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Los nombres deben tener máximo 100 caracteres' })
  nombres?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Los apellidos deben tener máximo 100 caracteres' })
  apellidos?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password?: string;

  @IsOptional()
  @IsString()
  confirmPassword?: string;

  @IsOptional()
  @IsInt({ message: 'El rol no es válido' })
  rolId?: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado no es válido' })
  activo?: boolean;
}
