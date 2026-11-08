import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class EnviarMensajeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  convId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  mensaje: string;
}
