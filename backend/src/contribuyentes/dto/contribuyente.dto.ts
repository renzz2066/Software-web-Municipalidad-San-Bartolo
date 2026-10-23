import { EstadoRegistro, TipoPersona } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { TIPOS_DOC } from '../documento.js';

export class CreateContribuyenteDto {
  @IsEnum(TipoPersona, { message: 'Tipo de persona no válido' })
  tipoPersona: TipoPersona;

  @IsIn(TIPOS_DOC, { message: 'Tipo de documento no válido' })
  tipoDoc: string;

  @IsString()
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @MaxLength(20)
  numDoc: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre o razón social es obligatorio' })
  @MaxLength(120, { message: 'El nombre debe tener máximo 120 caracteres' })
  nombreCompleto: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  direccionFiscal?: string;

  @IsOptional()
  @Matches(/^(\d{6})?$/, { message: 'El ubigeo tiene 6 dígitos' })
  ubigeo?: string;

  @IsOptional()
  @Matches(/^([0-9+\-\s]{6,15})?$/, { message: 'Teléfono no válido' })
  telefono?: string;

  @IsOptional()
  @Matches(/^(9\d{8})?$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular?: string;

  @IsOptional()
  @Matches(/^([^\s@]+@[^\s@]+\.[^\s@]+)?$/, { message: 'Correo no válido' })
  @MaxLength(100)
  email?: string;
}

// Todos opcionales; el servicio vuelve a validar documento con los valores resultantes.
export class UpdateContribuyenteDto {
  @IsOptional()
  @IsEnum(TipoPersona, { message: 'Tipo de persona no válido' })
  tipoPersona?: TipoPersona;

  @IsOptional()
  @IsIn(TIPOS_DOC, { message: 'Tipo de documento no válido' })
  tipoDoc?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @MaxLength(20)
  numDoc?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre o razón social es obligatorio' })
  @MaxLength(120, { message: 'El nombre debe tener máximo 120 caracteres' })
  nombreCompleto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  direccionFiscal?: string;

  @IsOptional()
  @Matches(/^(\d{6})?$/, { message: 'El ubigeo tiene 6 dígitos' })
  ubigeo?: string;

  @IsOptional()
  @Matches(/^([0-9+\-\s]{6,15})?$/, { message: 'Teléfono no válido' })
  telefono?: string;

  @IsOptional()
  @Matches(/^(9\d{8})?$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular?: string;

  @IsOptional()
  @Matches(/^([^\s@]+@[^\s@]+\.[^\s@]+)?$/, { message: 'Correo no válido' })
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsEnum(EstadoRegistro, { message: 'Estado no válido' })
  estado?: EstadoRegistro;
}

export class BuscarContribuyentesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  incluirBaja?: string;
}
