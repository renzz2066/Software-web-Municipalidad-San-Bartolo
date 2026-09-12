import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'El usuario es obligatorio' })
  usuario: string;

  @IsString()
  @MinLength(4, { message: 'La contraseña debe tener al menos 4 caracteres' })
  password: string;
}
