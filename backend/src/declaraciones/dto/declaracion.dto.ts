import { TipoPersona, TipoPredio } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
import { EstadoDj } from '@prisma/client';

// DJ presentada (specs/rentas-nucleo-v2.md, Fase 4). Motivo, condición, usos y documentos son
// códigos de catálogo: el servicio los valida contra la base de la muni. Las listas se envían completas.

const DOS = { maxDecimalPlaces: 2 };
const CODIGO = /^[A-Z0-9_]{1,20}$/;
const CODIGO_OPCIONAL = /^([A-Z0-9_]{1,20})?$/;

export class NivelDjDto {
  @IsString()
  @IsNotEmpty({ message: 'Cada nivel lleva su nombre' })
  @MaxLength(10)
  nivel: string;

  @IsOptional()
  @IsInt()
  anioConstruccion?: number | null;

  @IsOptional()
  @IsInt()
  mesConstruccion?: number | null;

  @IsString()
  @MaxLength(30)
  clasificacion: string;

  @IsString()
  @MaxLength(20)
  material: string;

  @IsString()
  @MaxLength(20)
  estadoConservacion: string;

  @IsString()
  @MaxLength(7)
  categorias: string;

  @IsNumber(DOS, { message: 'El área tiene máximo 2 decimales' })
  areaPropia: number;

  @IsOptional()
  @IsNumber(DOS)
  areaComun?: number | null;

  @IsOptional()
  @IsNumber(DOS)
  participacion?: number | null;
}

export class ObraDjDto {
  @IsString()
  @MaxLength(120)
  descripcion: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unidad?: string | null;

  @IsNumber(DOS, { message: 'La cantidad tiene máximo 2 decimales' })
  cantidad: number;

  @IsOptional()
  @IsNumber(DOS)
  largo?: number | null;

  @IsOptional()
  @IsNumber(DOS)
  ancho?: number | null;

  @IsOptional()
  @IsNumber(DOS)
  alto?: number | null;

  @IsOptional()
  @IsInt()
  anioConstruccion?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  material?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  estadoConservacion?: string | null;

  @IsOptional()
  @IsNumber(DOS)
  @Min(0)
  valorDeclarado?: number | null;
}

export class UsoDjDto {
  @Matches(/^[A-Z0-9_]{1,10}$/, { message: 'Uso no válido' })
  uso: string;

  @IsOptional()
  @Matches(CODIGO_OPCIONAL, { message: 'Sub-uso no válido' })
  subUso?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  inquilino?: string | null;

  @IsNumber(DOS, { message: 'El área del uso tiene máximo 2 decimales' })
  area: number;

  @IsOptional()
  @IsNumber(DOS)
  @Min(0)
  frontis?: number | null;

  @IsOptional()
  @IsNumber(DOS)
  @Min(0)
  @Max(100)
  participacion?: number | null;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string | null;

  @IsOptional()
  @IsDateString()
  fechaFin?: string | null;

  @IsOptional()
  @IsBoolean()
  predominante?: boolean;
}

export class RusticoDjDto {
  @IsString()
  @IsNotEmpty({ message: 'Indica la categoría del terreno rústico' })
  @MaxLength(20)
  categoria: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  clasificacion?: string | null;

  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'Las hectáreas tienen máximo 4 decimales' })
  hectareas: number;
}

export class AdquirienteDjDto {
  @IsIn(['ADQUIRIENTE', 'TRANSFERENTE'], { message: 'El rol es ADQUIRIENTE o TRANSFERENTE' })
  rol: string;

  @IsOptional()
  @IsEnum(TipoPersona)
  tipoPersona?: TipoPersona;

  @IsOptional()
  @Matches(CODIGO_OPCIONAL, { message: 'Tipo de documento no válido' })
  tipoDoc?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numDoc?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Indica el nombre del adquiriente o transferente' })
  @MaxLength(120)
  nombreCompleto: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string | null;

  @IsOptional()
  @Matches(CODIGO_OPCIONAL, { message: 'Tipo de documento de transferencia no válido' })
  documentoTransferencia?: string | null;
}

// Predio que aún no está en el padrón (inscripción o adquisición): se crea INACTIVO hasta liquidar.
export class PredioNuevoDto {
  @IsOptional()
  @IsEnum(TipoPredio)
  tipo?: TipoPredio;

  @IsInt({ message: 'Elige la dirección del predio' })
  @Min(1)
  direccionId: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoCatastro?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string | null;
}

export class AnexoDjDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  predioId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PredioNuevoDto)
  predioNuevo?: PredioNuevoDto;

  @IsOptional()
  @Matches(CODIGO_OPCIONAL, { message: 'Sub-motivo no válido' })
  subMotivo?: string | null;

  @Matches(CODIGO, { message: 'Condición de propiedad no válida' })
  condicion: string;

  @IsNumber(DOS, { message: 'El porcentaje tiene máximo 2 decimales' })
  porcentaje: number;

  @IsOptional()
  @IsDateString()
  fechaAdquisicion?: string | null;

  @IsOptional()
  @IsDateString()
  fechaDocumento?: string | null;

  @IsOptional()
  @IsDateString()
  fechaDescargo?: string | null;

  // Si no viene, se calcula (J10).
  @IsOptional()
  @IsInt()
  anioAfectacion?: number | null;

  // Si no viene, se calcula (J11).
  @IsOptional()
  @IsDateString()
  fechaAfectacionArbitrios?: string | null;

  @IsOptional()
  @IsNumber(DOS)
  @Min(0)
  valorTransferencia?: number | null;

  @IsOptional()
  @IsString()
  moneda?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  partidaRegistral?: string | null;

  @IsNumber(DOS, { message: 'El área de terreno tiene máximo 2 decimales' })
  areaTerreno: number;

  @IsOptional()
  @IsNumber(DOS)
  areaComun?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  numeroPisos?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observacion?: string | null;

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => NivelDjDto)
  niveles: NivelDjDto[];

  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ObraDjDto)
  obras: ObraDjDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => UsoDjDto)
  usos: UsoDjDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RusticoDjDto)
  rusticos: RusticoDjDto[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AdquirienteDjDto)
  adquirientes: AdquirienteDjDto[];
}

export class DocumentoDjDto {
  @Matches(CODIGO, { message: 'Tipo de documento adjunto no válido' })
  tipo: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  numero?: string | null;

  @IsOptional()
  @IsDateString()
  fecha?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observacion?: string | null;
}

export class DeclaracionDjDto {
  @IsInt({ message: 'Elige el contribuyente que declara' })
  @Min(1)
  contribuyenteId: number;

  @Matches(CODIGO, { message: 'Motivo no válido' })
  motivo: string;

  @IsOptional()
  @Matches(CODIGO_OPCIONAL, { message: 'Sub-motivo no válido' })
  subMotivo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroFormulario?: string | null;

  @IsOptional()
  @IsInt()
  @Max(9999)
  folios?: number | null;

  @IsDateString({}, { message: 'La fecha de presentación no es válida' })
  fechaPresentacion: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  djPrevioId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observacion?: string | null;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DocumentoDjDto)
  documentos: DocumentoDjDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'La DJ lleva al menos un anexo (un predio)' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnexoDjDto)
  anexos: AnexoDjDto[];
}

export class AnularDjDto {
  @IsString()
  @IsNotEmpty({ message: 'Indica el motivo de la anulación' })
  @MaxLength(250)
  motivo: string;
}

export class BuscarDjDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contribuyenteId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  predioId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio?: number;

  @IsOptional()
  @IsEnum(EstadoDj)
  estado?: EstadoDj;

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
}
