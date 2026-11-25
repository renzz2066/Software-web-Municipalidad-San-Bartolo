import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LARGO_VALOR, MAX_COMPONENTES } from '../direccion.reglas.js';

// Direcciones únicas (specs/rentas-nucleo-v2.md, Fase 2). El componente es un código del catálogo
// COMPONENTE_DIRECCION: el servicio lo valida contra la base de la muni.

export class ComponenteDto {
  @IsString()
  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'Componente de dirección no válido' })
  componente: string;

  @IsString()
  @IsNotEmpty({ message: 'Cada componente necesita su valor' })
  @MaxLength(LARGO_VALOR, { message: `Cada componente tiene máximo ${LARGO_VALOR} caracteres` })
  valor: string;
}

// Al editar todo es opcional: lo que no viene se conserva. componentes, si viene, reemplaza la lista.
class DatosDireccionDto {
  @IsOptional()
  @IsInt({ message: 'El sector no es válido' })
  @Min(1)
  zonaId?: number | null;

  @IsOptional()
  @IsInt({ message: 'La habilitación urbana no es válida' })
  @Min(1)
  urbanizacionId?: number | null;

  @IsOptional()
  @IsInt({ message: 'La vía no es válida' })
  @Min(1)
  viaId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'La referencia tiene máximo 250 caracteres' })
  referencia?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'La latitud no es válida (hasta 6 decimales)' })
  @Min(-90)
  @Max(90)
  latitud?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'La longitud no es válida (hasta 6 decimales)' })
  @Min(-180)
  @Max(180)
  longitud?: number | null;
}

export class CrearDireccionDto extends DatosDireccionDto {
  @IsArray()
  @ArrayMaxSize(MAX_COMPONENTES, { message: `Una dirección lleva como máximo ${MAX_COMPONENTES} componentes` })
  @ValidateNested({ each: true })
  @Type(() => ComponenteDto)
  componentes: ComponenteDto[];
}

export class ActualizarDireccionDto extends DatosDireccionDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_COMPONENTES, { message: `Una dirección lleva como máximo ${MAX_COMPONENTES} componentes` })
  @ValidateNested({ each: true })
  @Type(() => ComponenteDto)
  componentes?: ComponenteDto[];
}

export class EstadoDireccionDto {
  @IsBoolean({ message: 'Indica si la dirección queda activa' })
  activo: boolean;
}

export class BuscarDireccionesDto {
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
  incluirInactivas?: string;
}
