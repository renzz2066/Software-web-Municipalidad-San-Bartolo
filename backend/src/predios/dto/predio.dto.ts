import { TipoPredio } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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

// Predio maestro (specs/rentas-nucleo-v2.md, Fase 3). Identificación y arbitrios (R01, R02, R05):
// todo opcional, lo que no viene se conserva. Ubicación, área y construcción van por la DJ.

const DOS_DECIMALES = { maxDecimalPlaces: 2 };
const CODIGO = /^([A-Z0-9_]{1,20})?$/;

export class CondicionTitularDto {
  @IsInt()
  @Min(1)
  contribuyenteId: number;

  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'Condición de propiedad no válida' })
  condicion: string;
}

export class MaestroPredioDto {
  @IsOptional()
  @IsEnum(TipoPredio, { message: 'El tipo de predio es URBANO o RUSTICO' })
  tipo?: TipoPredio;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'El nombre del predio tiene máximo 120 caracteres' })
  nombre?: string | null;

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

  @IsOptional()
  @IsNumber(DOS_DECIMALES, { message: 'Los metros del lindero tienen máximo 2 decimales' })
  linderoFrenteMetros?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  linderoFrenteColindante?: string | null;

  @IsOptional()
  @IsNumber(DOS_DECIMALES, { message: 'Los metros del lindero tienen máximo 2 decimales' })
  linderoDerechaMetros?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  linderoDerechaColindante?: string | null;

  @IsOptional()
  @IsNumber(DOS_DECIMALES, { message: 'Los metros del lindero tienen máximo 2 decimales' })
  linderoIzquierdaMetros?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  linderoIzquierdaColindante?: string | null;

  @IsOptional()
  @IsNumber(DOS_DECIMALES, { message: 'Los metros del lindero tienen máximo 2 decimales' })
  linderoFondoMetros?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  linderoFondoColindante?: string | null;

  @IsOptional()
  @Matches(CODIGO, { message: 'Frecuencia de barrido no válida' })
  frecuenciaBarrido?: string | null;

  @IsOptional()
  @Matches(CODIGO, { message: 'Ubicación respecto a parques no válida' })
  ubicacionParque?: string | null;

  @IsOptional()
  @IsNumber(DOS_DECIMALES, { message: 'El frontis tiene máximo 2 decimales' })
  @Min(0, { message: 'El frontis no puede ser negativo' })
  frontis?: number | null;

  // R05: condición de propiedad de los titulares vigentes.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CondicionTitularDto)
  titulares?: CondicionTitularDto[];
}

// R06: resolución de inafectación o exoneración del predio.
export class PredioBeneficioDto {
  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'Beneficio no válido' })
  codigo: string;

  @IsOptional()
  @IsNumber(DOS_DECIMALES, { message: 'El porcentaje tiene máximo 2 decimales' })
  @Min(0.01)
  @Max(100)
  porcentaje?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'La base legal tiene máximo 150 caracteres' })
  baseLegal?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El expediente tiene máximo 30 caracteres' })
  expediente?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'El número de resolución es obligatorio' })
  @MaxLength(40)
  resolucion: string;

  @IsDateString({}, { message: 'La fecha de la resolución no es válida' })
  fechaResolucion: string;

  @IsInt({ message: 'El año inicial no es válido' })
  @Min(2000)
  @Max(2100)
  anioDesde: number;

  @IsOptional()
  @IsInt({ message: 'El año final no es válido' })
  @Min(2000)
  @Max(2100)
  anioHasta?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observacion?: string | null;
}

export class RevocarPredioBeneficioDto {
  @IsOptional()
  @IsInt({ message: 'El año final no es válido' })
  @Min(2000)
  @Max(2100)
  anioHasta?: number | null;

  @IsString()
  @IsNotEmpty({ message: 'Indica por qué se revoca' })
  @MaxLength(250)
  observacion: string;
}

export class PersonasAnioDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El año no es válido' })
  @Min(1950)
  @Max(2100)
  anio?: number;
}
