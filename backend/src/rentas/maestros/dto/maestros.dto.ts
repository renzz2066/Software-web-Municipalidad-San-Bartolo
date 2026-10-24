import { BaseMulta, ComponenteConstruccion } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
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
import { CLASIFICACIONES, CONCEPTOS_ARBITRIO, ESTADOS_CONSERVACION, MATERIALES } from '../../catalogos-construccion.js';

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

  @IsOptional()
  @IsNumber(DOS_DECIMALES, { message: 'El derecho de emisión debe ser un monto con 2 decimales' })
  @Min(0)
  derechoEmision?: number;
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
  @IsIn(CLASIFICACIONES, { message: 'Clasificación no válida' })
  clasificacion: string;

  @IsIn(MATERIALES, { message: 'Material no válido' })
  material: string;

  @IsInt()
  @Min(0)
  antiguedadHasta: number;

  @IsIn(ESTADOS_CONSERVACION, { message: 'Estado de conservación no válido' })
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
  @IsIn(CONCEPTOS_ARBITRIO, { message: 'Concepto no válido (RESIDUOS, BARRIDO, PARQUES, SERENAZGO)' })
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

export class FeriadoDto {
  @IsDateString({}, { message: 'La fecha del feriado debe ser AAAA-MM-DD' })
  fecha: string;

  @IsString()
  @IsNotEmpty({ message: 'Describe el feriado' })
  @MaxLength(100)
  descripcion: string;
}

export class FeriadosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeriadoDto)
  items: FeriadoDto[];
}

export class ParametroFraccionamientoDto extends ConOrdenanzaDto {
  @IsNumber(DOS_DECIMALES, { message: 'La cuota inicial mínima es un porcentaje con 2 decimales' })
  @Min(0)
  @Max(100, { message: 'La cuota inicial mínima es un porcentaje (0-100)' })
  cuotaInicialMinPct: number;

  @IsInt({ message: 'El número máximo de cuotas debe ser entero' })
  @Min(1, { message: 'Debe permitirse al menos 1 cuota' })
  @Max(120, { message: 'Máximo 120 cuotas' })
  cuotasMax: number;

  @IsNumber(DOS_DECIMALES, { message: 'El monto mínimo debe ser un monto con 2 decimales' })
  @Min(0)
  montoMinimo: number;

  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El interés admite hasta 4 decimales' })
  @Min(0)
  @Max(100, { message: 'El interés es un porcentaje mensual (0-100)' })
  interesMensual: number;
}

// Fiscalización (specs/rentas-fiscalizacion-v1.md, decisiones 2 y 5).
export class FiscalizadorDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre: string;

  @IsString()
  @Matches(/^[0-9A-Za-z]{8,12}$/, { message: 'El documento debe tener de 8 a 12 caracteres (DNI o CE)' })
  dni: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  usuarioId?: number | null;
}

export class InfraccionDto {
  @IsString()
  @Matches(/^\d{3}\.\d{1,2}$/, { message: 'El código es artículo.numeral, por ejemplo 176.1' })
  codigo: string;

  @IsString()
  @IsNotEmpty({ message: 'Describe la infracción' })
  @MaxLength(250)
  descripcion: string;

  @IsEnum(BaseMulta, { message: 'La base es UIT o TRIBUTO_OMITIDO' })
  base: BaseMulta;

  @IsNumber(DOS_DECIMALES, { message: 'El % para persona natural admite 2 decimales' })
  @Min(0)
  @Max(500)
  porcentajeNatural: number;

  @IsNumber(DOS_DECIMALES, { message: 'El % para persona jurídica admite 2 decimales' })
  @Min(0)
  @Max(500)
  porcentajeJuridica: number;
}

export class InfraccionesDto extends ConOrdenanzaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InfraccionDto)
  items: InfraccionDto[];
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
