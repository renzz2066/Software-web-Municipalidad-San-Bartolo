import { EstadoPersona, TipoPersona } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
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
  ValidateNested,
} from 'class-validator';

// Personas v2 (specs/rentas-nucleo-v2.md, Fase 1). Los tipos (documento, contacto, relacionado,
// sucesión, perfiles) son códigos de catálogo: el servicio los valida contra la base de la muni.
// Las listas, si se envían, reemplazan a las guardadas (lo que no venga se quita).

export class DocumentoDto {
  @IsString()
  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'Tipo de documento no válido' })
  tipoDoc: string;

  @IsString()
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @MaxLength(20)
  numDoc: string;
}

export class ContactoDto {
  @IsString()
  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'Tipo de contacto no válido' })
  tipo: string;

  @IsString()
  @MaxLength(100, { message: 'El contacto tiene máximo 100 caracteres' })
  valor: string;
}

export class RelacionadoDto {
  // Para conservar el registro (y su historia) al editar; sin id es uno nuevo.
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @IsString()
  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'Tipo de relacionado no válido' })
  tipo: string;

  @IsOptional()
  @Matches(/^([A-Z0-9_]{1,20})?$/, { message: 'Tipo de documento del relacionado no válido' })
  tipoDoc?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numDoc?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del relacionado es obligatorio' })
  @MaxLength(120, { message: 'El nombre del relacionado tiene máximo 120 caracteres' })
  nombreCompleto: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'La dirección del relacionado tiene máximo 150 caracteres' })
  direccion?: string | null;

  @IsOptional()
  @IsBoolean()
  vigente?: boolean;
}

class DatosPersonaDto {
  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'El apellido paterno tiene máximo 60 caracteres' })
  apellidoPaterno?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60, { message: 'El apellido materno tiene máximo 60 caracteres' })
  apellidoMaterno?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Los nombres tienen máximo 80 caracteres' })
  nombres?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'La razón social tiene máximo 120 caracteres' })
  razonSocial?: string | null;

  @IsOptional()
  @Matches(/^([A-Z0-9_]{1,20})?$/, { message: 'Tipo de sucesión no válido' })
  tipoSucesion?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe tener formato AAAA-MM-DD' })
  fechaNacimiento?: string | null;

  @IsOptional()
  @Matches(/^(\d{8})?$/, { message: 'El DNI del causante debe tener 8 dígitos' })
  dniCausante?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DocumentoDto)
  documentos?: DocumentoDto[];

  // P08: obligatoria cuando no hay documentos.
  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'La justificación tiene máximo 250 caracteres' })
  sinDocumentoMotivo?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ContactoDto)
  contactos?: ContactoDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RelacionadoDto)
  relacionados?: RelacionadoDto[];

  @IsOptional()
  @Matches(/^([A-Z0-9_]{1,20})?$/, { message: 'Perfil de cumplimiento no válido' })
  perfilCumplimiento?: string | null;

  @IsOptional()
  @Matches(/^([A-Z0-9_]{1,20})?$/, { message: 'Perfil de cobranza no válido' })
  perfilCobranza?: string | null;

  @IsOptional()
  @Matches(/^([A-Z0-9_]{1,20})?$/, { message: 'Clasificación no válida' })
  clasificacion?: string | null;

  // Domicilio fiscal (specs/contribuyente-domicilio-representante-v1.md). Fase 2 lo lleva al
  // catálogo de direcciones únicas.
  @IsOptional()
  @Matches(/^(\d{6})$/, { message: 'El ubigeo tiene 6 dígitos' })
  ubigeo?: string | null;

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
  numero?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  interior?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  manzana?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  lote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  referencia?: string | null;
}

// Sin `documentos` (o vacío) = persona sin documento: exige sinDocumentoMotivo (P08).
export class CreateContribuyenteDto extends DatosPersonaDto {
  @IsEnum(TipoPersona, { message: 'Tipo de persona no válido' })
  tipoPersona: TipoPersona;
}

// Todos opcionales: el servicio vuelve a validar con los valores resultantes.
export class UpdateContribuyenteDto extends DatosPersonaDto {
  @IsOptional()
  @IsEnum(TipoPersona, { message: 'Tipo de persona no válido' })
  tipoPersona?: TipoPersona;
}

// P01/P02: inhabilitar (con la regla de la deuda) o habilitar (sin restricción).
export class CambiarEstadoDto {
  @IsIn([EstadoPersona.HABILITADO, EstadoPersona.INHABILITADO], { message: 'El estado debe ser HABILITADO o INHABILITADO' })
  estado: EstadoPersona;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'El motivo tiene máximo 250 caracteres' })
  motivo?: string | null;
}

// P14/P15: resolución que reconoce la inafectación o la deducción.
export class BeneficioDto {
  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'Beneficio no válido' })
  codigo: string;

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
  @MaxLength(40, { message: 'La resolución tiene máximo 40 caracteres' })
  resolucion: string;

  @IsDateString({}, { message: 'La fecha de la resolución debe tener formato AAAA-MM-DD' })
  fechaResolucion: string;

  @IsInt({ message: 'Indica desde qué año aplica' })
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

export class RevocarBeneficioDto {
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

// Consulta de identidad para autocompletar el formulario (specs/consulta-identidad-v1.md).
export class ConsultarIdentidadDto {
  @IsIn(['DNI', 'RUC'], { message: 'Solo se consultan DNI y RUC' })
  tipoDoc: string;

  @IsString()
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @MaxLength(20)
  numDoc: string;

  // Al editar, el propio registro no debe leerse como "ya inscrito".
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  excluirId?: number;
}

// P10: ¿el documento del relacionado es de una persona registrada? (para enlazar y precargar)
export class PorDocumentoDto {
  @Matches(/^[A-Z0-9_]{1,20}$/, { message: 'Tipo de documento no válido' })
  tipoDoc: string;

  @IsString()
  @IsNotEmpty({ message: 'El número de documento es obligatorio' })
  @MaxLength(20)
  numDoc: string;
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
  incluirInhabilitados?: string;

  @IsOptional()
  @IsEnum(EstadoPersona, { message: 'Estado no válido' })
  estado?: EstadoPersona;
}
