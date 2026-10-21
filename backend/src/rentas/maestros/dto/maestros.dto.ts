import { ComponenteConstruccion } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
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

// Montos en soles con 2 decimales; porcentajes 0-100.
const DOS_DECIMALES = { maxDecimalPlaces: 2 };

class ConOrdenanzaDto {
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'La ordenanza debe tener máximo 60 caracteres' })
  ordenanza?: string;
}

export class UitDto extends ConOrdenanzaDto {
  @IsNumber(DOS_DECIMALES, { message: 'La UIT debe ser un monto con 2 decimales' })
  @Min(0.01, { message: 'La UIT debe ser mayor que 0' })
  valor: number;
}

export class TramoDto {
  @IsInt({ message: 'El tramo debe ser un número entero' })
  @Min(1)
  tramo: number;

  @IsNumber(DOS_DECIMALES)
  @Min(0)
  desdeUit: number;

  @IsOptional()
  @IsNumber(DOS_DECIMALES)
  @Min(0)
  hastaUit?: number | null;

  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'La tasa admite hasta 4 decimales' })
  @Min(0)
  @Max(100, { message: 'La tasa es un porcentaje (0-100)' })
  tasa: number;
}

export class EscalaDto extends ConOrdenanzaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TramoDto)
  items: TramoDto[];
}

export class ArancelDto {
  @IsInt({ message: 'Selecciona una vía' })
  viaId: number;

  @IsOptional()
  @IsInt()
  urbanizacionId?: number | null;

  @IsNumber(DOS_DECIMALES, { message: 'El arancel debe ser un monto con 2 decimales' })
  @Min(0)
  valorM2: number;
}

export class ArancelesDto extends ConOrdenanzaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArancelDto)
  items: ArancelDto[];
}

export class ValorUnitarioDto {
  @IsEnum(ComponenteConstruccion, { message: 'Componente no válido' })
  componente: ComponenteConstruccion;

  @Matches(/^[A-I]$/, { message: 'La categoría va de A a I' })
  categoria: string;

  @IsNumber(DOS_DECIMALES)
  @Min(0)
  valor: number;
}

export class ValoresUnitariosDto extends ConOrdenanzaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValorUnitarioDto)
  items: ValorUnitarioDto[];
}

export class DepreciacionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  clasificacion: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  material: string;

  @IsInt()
  @Min(0)
  antiguedadHasta: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  estadoConservacion: string;

  @IsNumber(DOS_DECIMALES)
  @Min(0)
  @Max(100, { message: 'La depreciación es un porcentaje (0-100)' })
  porcentaje: number;
}

export class DepreciacionesDto extends ConOrdenanzaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepreciacionDto)
  items: DepreciacionDto[];
}

export class TarifaArbitrioDto {
  @IsString()
  @IsNotEmpty({ message: 'El concepto es obligatorio' })
  @MaxLength(30)
  concepto: string;

  @IsOptional()
  @IsInt()
  zonaId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  uso?: string | null;

  @IsNumber(DOS_DECIMALES, { message: 'La tarifa debe ser un monto con 2 decimales' })
  @Min(0)
  tasa: number;
}

export class TarifasArbitriosDto extends ConOrdenanzaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TarifaArbitrioDto)
  items: TarifaArbitrioDto[];
}

export class TasaMoraDto {
  @IsDateString({}, { message: 'La vigencia debe ser una fecha (AAAA-MM-DD)' })
  vigenciaDesde: string;

  @IsNumber({ maxDecimalPlaces: 5 })
  @Min(0)
  valor: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ordenanza?: string;
}

export class TasasMoraDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TasaMoraDto)
  items: TasaMoraDto[];
}

export class AbrirAnioDto {
  @IsInt()
  desde: number;

  @IsInt()
  hacia: number;
}

export class ZonaDto {
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MaxLength(5)
  codigo: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;
}

export class UrbanizacionDto {
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @MaxLength(10)
  codigo: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;
}

export class ViaDto {
  @IsString()
  @IsNotEmpty({ message: 'El tipo de vía es obligatorio' })
  @MaxLength(10)
  tipoVia: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;
}
