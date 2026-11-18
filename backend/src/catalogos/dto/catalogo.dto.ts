import { GrupoCatalogo } from '@prisma/client';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// El código no se edita: otros registros lo guardan como texto.
export class CrearCatalogoDto {
  @IsEnum(GrupoCatalogo, { message: 'Catálogo no válido' })
  grupo: GrupoCatalogo;

  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'El código tiene hasta 20 caracteres: mayúsculas, números o _' })
  codigo: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120, { message: 'El nombre tiene máximo 120 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'La abreviatura tiene máximo 20 caracteres' })
  abreviatura?: string | null;

  @IsOptional()
  @IsInt({ message: 'El padre no es válido' })
  @Min(1)
  padreId?: number | null;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0)
  @Max(9999)
  orden?: number;

  @IsOptional()
  @IsObject({ message: 'Los atributos deben ser un objeto' })
  atributos?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'La ordenanza tiene máximo 60 caracteres' })
  ordenanza?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarCatalogoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120, { message: 'El nombre tiene máximo 120 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'La abreviatura tiene máximo 20 caracteres' })
  abreviatura?: string | null;

  @IsOptional()
  @IsInt({ message: 'El padre no es válido' })
  @Min(1)
  padreId?: number | null;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(0)
  @Max(9999)
  orden?: number;

  @IsOptional()
  @IsObject({ message: 'Los atributos deben ser un objeto' })
  atributos?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'La ordenanza tiene máximo 60 caracteres' })
  ordenanza?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ListarCatalogoDto {
  @IsOptional()
  @IsEnum(GrupoCatalogo, { message: 'Catálogo no válido' })
  grupo?: GrupoCatalogo;

  @IsOptional()
  @IsIn(['true', 'false'])
  incluirInactivos?: string;
}

export class GuardarReglaDto {
  @IsDefined({ message: 'Indica el valor de la regla' })
  valor: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'La ordenanza tiene máximo 60 caracteres' })
  ordenanza?: string | null;
}
