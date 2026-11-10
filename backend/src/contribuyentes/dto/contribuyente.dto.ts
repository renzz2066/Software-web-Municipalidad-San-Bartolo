import { EstadoRegistro, TipoPersona } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TIPOS_DOC } from '../documento.js';

// Domicilio fiscal y representante legal (specs/contribuyente-domicilio-representante-v1.md).
// En SIMUN solo el código postal, el tipo de persona y el nombre son obligativos; el resto, no.

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

  // Opcional: sin código se usa el de San Bartolo (150129), como en el alta de SIMUN.
  @IsOptional()
  @Matches(/^(\d{6})$/, { message: 'El ubigeo tiene 6 dígitos' })
  ubigeo?: string | null;

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
  @IsInt({ message: 'La zona no es válida' })
  @Min(1)
  zonaId?: number | null;

  @IsOptional()
  @IsInt({ message: 'La urbanización no es válida' })
  @Min(1)
  urbanizacionId?: number | null;

  @IsOptional()
  @IsInt({ message: 'La vía no es válida' })
  @Min(1)
  viaId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  interior?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  manzana?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  lote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  conyugeNombre?: string;

  @IsOptional()
  @Matches(/^(\d{8})?$/, { message: 'El DNI del cónyuge debe tener 8 dígitos' })
  conyugeNumDoc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  representanteNombre?: string;

  @IsOptional()
  @Matches(/^(\d{8})?$/, { message: 'El DNI del representante legal debe tener 8 dígitos' })
  representanteNumDoc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  representanteDireccion?: string;
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
  @Matches(/^(\d{6})$/, { message: 'El ubigeo tiene 6 dígitos' })
  ubigeo?: string | null;

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
  @IsInt({ message: 'La zona no es válida' })
  @Min(1)
  zonaId?: number | null;

  @IsOptional()
  @IsInt({ message: 'La urbanización no es válida' })
  @Min(1)
  urbanizacionId?: number | null;

  @IsOptional()
  @IsInt({ message: 'La vía no es válida' })
  @Min(1)
  viaId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  interior?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  manzana?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  lote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  conyugeNombre?: string;

  @IsOptional()
  @Matches(/^(\d{8})?$/, { message: 'El DNI del cónyuge debe tener 8 dígitos' })
  conyugeNumDoc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  representanteNombre?: string;

  @IsOptional()
  @Matches(/^(\d{8})?$/, { message: 'El DNI del representante legal debe tener 8 dígitos' })
  representanteNumDoc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  representanteDireccion?: string;

  @IsOptional()
  @IsEnum(EstadoRegistro, { message: 'Estado no válido' })
  estado?: EstadoRegistro;
}

export class BuscarUbigeosDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
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
