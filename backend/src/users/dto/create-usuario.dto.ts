import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'El usuario es obligatorio' })
  @MaxLength(50, { message: 'El usuario debe tener máximo 50 caracteres' })
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'Los nombres son obligatorios' })
  @MaxLength(100, { message: 'Los nombres deben tener máximo 100 caracteres' })
  nombres: string;

  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son obligatorios' })
  @MaxLength(100, { message: 'Los apellidos deben tener máximo 100 caracteres' })
  apellidos: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Debe verificar la contraseña' })
  confirmPassword: string;

  @IsInt({ message: 'El rol no es válido' })
  rolId: number;

  @IsOptional()
  @IsBoolean({ message: 'El estado no es válido' })
  activo?: boolean;
}
