import { MOTIVOS_DJ, type Motivo } from '../declaracion.reglas.js';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
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
import { CLASIFICACIONES, ESTADOS_CONSERVACION, MATERIALES, REGEX_CATEGORIAS } from '../../rentas/catalogos-construccion.js';

const DOS_DECIMALES = { maxDecimalPlaces: 2 };

export class DatosPredioDto {
  @IsOptional()
  @IsInt()
  zonaId?: number | null;

  @IsOptional()
  @IsInt()
  urbanizacionId?: number | null;

  @IsInt({ message: 'Selecciona la vía del predio' })
  viaId: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  numero?: string;

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
  @MaxLength(20)
  codigoCatastro?: string;

  @IsNumber(DOS_DECIMALES, { message: 'El área de terreno debe tener máximo 2 decimales' })
  @Min(0.01, { message: 'El área de terreno debe ser mayor que 0' })
  areaTerreno: number;

  @IsString()
  @IsNotEmpty({ message: 'Indica el uso del predio' })
  @MaxLength(10)
  usoPredio: string;
}

export class PisoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  nivel: string;

  @IsOptional()
  @IsInt()
  anioConstruccion?: number | null;

  @IsIn(CLASIFICACIONES, { message: 'Clasificación no válida' })
  clasificacion: string;

  @IsIn(MATERIALES, { message: 'Material no válido' })
  material: string;

  @IsIn(ESTADOS_CONSERVACION, { message: 'Estado de conservación no válido' })
  estadoConservacion: string;

  @Matches(REGEX_CATEGORIAS, { message: 'Las categorías son 7 letras de A a I (o "-")' })
  categorias: string;

  @IsNumber(DOS_DECIMALES)
  @Min(0.01)
  areaConstruida: number;
}

export class OtraInstalacionDto {
  @IsString()
  @IsNotEmpty({ message: 'Describe la instalación' })
  @MaxLength(150)
  descripcion: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unidad?: string;

  @IsOptional()
  @IsNumber(DOS_DECIMALES)
  @Min(0)
  cantidad?: number;

  @IsOptional()
  @IsNumber(DOS_DECIMALES)
  @Min(0)
  valor?: number;
}

export class CondominoDto {
  @IsInt()
  contribuyenteId: number;

  @IsNumber(DOS_DECIMALES)
  @Min(0.01)
  @Max(100)
  porcentaje: number;
}

export class DeclaracionDto {
  // FISCALIZACION no: esa DJ la genera la resolución del expediente (specs/rentas-fiscalizacion-v1.md, F5).
  @IsIn(MOTIVOS_DJ, { message: 'Motivo no válido' })
  motivo: Motivo;

  @IsInt()
  anio: number;

  @IsDateString({}, { message: 'La fecha debe tener formato AAAA-MM-DD' })
  fecha: string;

  // Inscripción o compra: fecha de adquisición; con ella se evalúa si la DJ es extemporánea (F7).
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de adquisición debe tener formato AAAA-MM-DD' })
  fechaHecho?: string;

  @IsInt({ message: 'Indica el declarante' })
  declaranteId: number;

  @IsOptional()
  @IsInt()
  predioId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observacion?: string;

  // Obligatorios salvo en BAJA (lo valida el servicio).
  @IsOptional()
  @ValidateNested()
  @Type(() => DatosPredioDto)
  predio?: DatosPredioDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PisoDto)
  pisos: PisoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OtraInstalacionDto)
  otrasInstalaciones: OtraInstalacionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CondominoDto)
  condominos: CondominoDto[];
}
