// Valores con que nace cada base (specs/rentas-nucleo-v2.md, Fase 0). Los siembra prisma/seed.ts
// sin pisar lo que la muni ya editó. Son el marco nacional o la práctica común: el contenido real
// de los catálogos de Lurín está pendiente de pedir.
// `sistema`: el código depende de esa fila (validación, conversión de datos, reglas): no se desactiva.
import { GrupoCatalogo } from '@prisma/client';

export interface ItemNacional {
  codigo: string;
  nombre: string;
  abreviatura?: string;
  padre?: string; // código del padre en el grupo padre (GRUPOS[grupo].padre)
  atributos?: Record<string, string | number | boolean>;
  sistema?: boolean;
}

const G = GrupoCatalogo;
const LTM17 = 'TUO LTM art. 17';
const inafecto = (codigo: string, nombre: string): ItemNacional => ({
  codigo,
  nombre,
  atributos: { regimen: 'INAFECTACION', persona: 'JURIDICA', porcentaje: 100, baseLegal: LTM17 },
});

export const CATALOGOS_NACIONALES: Partial<Record<GrupoCatalogo, ItemNacional[]>> = {
  [G.TIPO_DOCUMENTO]: [
    { codigo: 'DNI', nombre: 'Documento Nacional de Identidad', abreviatura: 'DNI', sistema: true },
    { codigo: 'RUC', nombre: 'Registro Único de Contribuyentes', abreviatura: 'RUC', sistema: true },
    { codigo: 'CE', nombre: 'Carné de extranjería', abreviatura: 'CE', sistema: true },
    { codigo: 'PASAPORTE', nombre: 'Pasaporte', abreviatura: 'PAS', sistema: true },
    { codigo: 'CPP', nombre: 'Carné de permiso temporal de permanencia', abreviatura: 'CPP' },
    { codigo: 'SIN_DOCUMENTO', nombre: 'Sin documento', abreviatura: 'S/D', sistema: true },
  ],
  [G.TIPO_CONTACTO]: [
    { codigo: 'EMAIL', nombre: 'Correo electrónico', atributos: { formato: 'EMAIL' }, sistema: true },
    { codigo: 'TELEFONO_CASA', nombre: 'Teléfono de casa', atributos: { formato: 'TELEFONO' }, sistema: true },
    { codigo: 'TELEFONO_OFICINA', nombre: 'Teléfono de oficina', atributos: { formato: 'TELEFONO' } },
    { codigo: 'CELULAR', nombre: 'Celular', atributos: { formato: 'CELULAR' }, sistema: true },
  ],
  [G.TIPO_RELACIONADO]: [
    { codigo: 'CONYUGE', nombre: 'Cónyuge', atributos: { unico: true }, sistema: true },
    { codigo: 'REPRESENTANTE_LEGAL', nombre: 'Representante legal', sistema: true },
    { codigo: 'RESPONSABLE', nombre: 'Responsable' },
  ],
  [G.TIPO_SUCESION]: [
    { codigo: 'INDIVISA', nombre: 'Sucesión indivisa', abreviatura: 'SUC.', sistema: true },
    { codigo: 'INTESTADA', nombre: 'Sucesión intestada', abreviatura: 'SUC. INT.' },
    { codigo: 'TESTAMENTARIA', nombre: 'Sucesión testamentaria', abreviatura: 'SUC. TEST.' },
  ],
  [G.PERFIL_CUMPLIMIENTO]: [
    { codigo: 'NUEVO', nombre: 'Sin historial' },
    { codigo: 'PUNTUAL', nombre: 'Puntual' },
    { codigo: 'MOROSO', nombre: 'Moroso' },
    { codigo: 'OMISO', nombre: 'Omiso a declarar' },
  ],
  [G.PERFIL_COBRANZA]: [
    { codigo: 'ORDINARIA', nombre: 'Cobranza ordinaria' },
    { codigo: 'PERSUASIVA', nombre: 'Cobranza persuasiva' },
    { codigo: 'COACTIVA', nombre: 'Cobranza coactiva' },
  ],
  [G.CLASIFICACION_CONTRIBUYENTE]: [
    { codigo: 'PRICO', nombre: 'Principal contribuyente', abreviatura: 'PRICO' },
    { codigo: 'MECO', nombre: 'Mediano contribuyente', abreviatura: 'MECO' },
    { codigo: 'PECO', nombre: 'Pequeño contribuyente', abreviatura: 'PECO' },
  ],
  [G.BENEFICIO]: [
    inafecto('INAF_GOBIERNO', 'Gobierno central, regional o local'),
    inafecto('INAF_GOB_EXTRANJERO', 'Gobierno extranjero (con reciprocidad)'),
    inafecto('INAF_BENEFICENCIA', 'Sociedad de beneficencia'),
    inafecto('INAF_RELIGIOSA', 'Entidad religiosa (templos, conventos, monasterios, museos)'),
    inafecto('INAF_SALUD_PUBLICA', 'Entidad pública de servicios médicos asistenciales'),
    inafecto('INAF_BOMBEROS', 'Cuerpo General de Bomberos Voluntarios'),
    inafecto('INAF_COMUNIDAD', 'Comunidad campesina o nativa'),
    inafecto('INAF_EDUCACION', 'Universidad o centro educativo reconocido'),
    inafecto('INAF_OTRO_ART17', 'Otro sujeto del art. 17 (indicar en la resolución)'),
    {
      codigo: 'PENSIONISTA',
      nombre: 'Pensionista',
      atributos: { regimen: 'DEDUCCION', persona: 'NATURAL', deduccionUit: 50, baseLegal: 'TUO LTM art. 19' },
      sistema: true,
    },
    {
      codigo: 'ADULTO_MAYOR',
      nombre: 'Adulto mayor no pensionista',
      atributos: { regimen: 'DEDUCCION', persona: 'NATURAL', deduccionUit: 50, baseLegal: 'TUO LTM art. 19 (Ley 30490)' },
      sistema: true,
    },
  ],
  [G.COMPONENTE_DIRECCION]: [
    { codigo: 'NUMERO', nombre: 'Número', abreviatura: 'N°', sistema: true },
    { codigo: 'KM', nombre: 'Kilómetro', abreviatura: 'Km.' },
    { codigo: 'MZ', nombre: 'Manzana', abreviatura: 'Mz.', sistema: true },
    { codigo: 'LT', nombre: 'Lote', abreviatura: 'Lt.', sistema: true },
    { codigo: 'SUBLOTE', nombre: 'Sublote', abreviatura: 'Sublt.' },
    { codigo: 'BLOCK', nombre: 'Block', abreviatura: 'Blk.' },
    { codigo: 'TORRE', nombre: 'Torre', abreviatura: 'Torre' },
    { codigo: 'PISO', nombre: 'Piso', abreviatura: 'Piso' },
    { codigo: 'DPTO', nombre: 'Departamento', abreviatura: 'Dpto.', sistema: true },
    { codigo: 'INTERIOR', nombre: 'Interior', abreviatura: 'Int.' },
    { codigo: 'TIENDA', nombre: 'Tienda', abreviatura: 'Tda.' },
  ],
  [G.TIPO_VIA]: [
    { codigo: 'AV', nombre: 'Avenida', abreviatura: 'Av.', sistema: true },
    { codigo: 'JR', nombre: 'Jirón', abreviatura: 'Jr.', sistema: true },
    { codigo: 'CL', nombre: 'Calle', abreviatura: 'Ca.', sistema: true },
    { codigo: 'PSJE', nombre: 'Pasaje', abreviatura: 'Pje.', sistema: true },
    { codigo: 'PROL', nombre: 'Prolongación', abreviatura: 'Prol.' },
    { codigo: 'MALECON', nombre: 'Malecón', abreviatura: 'Mlc.' },
    { codigo: 'ALAMEDA', nombre: 'Alameda', abreviatura: 'Alam.' },
    { codigo: 'CARRETERA', nombre: 'Carretera', abreviatura: 'Carr.' },
  ],
  [G.TIPO_HABILITACION]: [
    { codigo: 'URB', nombre: 'Urbanización', abreviatura: 'Urb.' },
    { codigo: 'AAHH', nombre: 'Asentamiento humano', abreviatura: 'AA.HH.' },
    { codigo: 'AF', nombre: 'Agrupación familiar', abreviatura: 'A.F.' },
    { codigo: 'ASOC', nombre: 'Asociación de vivienda', abreviatura: 'Asoc.' },
    { codigo: 'COOP', nombre: 'Cooperativa de vivienda', abreviatura: 'Coop.' },
    { codigo: 'PJ', nombre: 'Pueblo joven', abreviatura: 'P.J.' },
    { codigo: 'CP', nombre: 'Centro poblado', abreviatura: 'C.P.' },
    { codigo: 'RES', nombre: 'Residencial', abreviatura: 'Res.' },
    { codigo: 'PARC', nombre: 'Parcelación', abreviatura: 'Parc.' },
  ],
  [G.FRECUENCIA_BARRIDO]: [
    { codigo: 'DIARIA', nombre: 'Diaria' },
    { codigo: 'INTERDIARIA', nombre: 'Interdiaria' },
    { codigo: 'BISEMANAL', nombre: 'Dos veces por semana' },
    { codigo: 'SEMANAL', nombre: 'Semanal' },
  ],
  [G.UBICACION_PARQUE]: [
    { codigo: 'FRENTE', nombre: 'Frente a parque' },
    { codigo: 'CERCA', nombre: 'Cerca de parque' },
    { codigo: 'LEJOS', nombre: 'Lejos de parque' },
  ],
  [G.CONDICION_PROPIEDAD]: [
    { codigo: 'PROPIETARIO_UNICO', nombre: 'Propietario único', sistema: true },
    { codigo: 'SUCESION_INDIVISA', nombre: 'Sucesión indivisa' },
    { codigo: 'POSEEDOR', nombre: 'Poseedor o tenedor' },
    { codigo: 'SOCIEDAD_CONYUGAL', nombre: 'Sociedad conyugal' },
    { codigo: 'CONDOMINIO', nombre: 'Condominio', sistema: true },
    { codigo: 'COPROPIETARIO', nombre: 'Copropietario' },
    { codigo: 'OTROS', nombre: 'Otros' },
  ],
  // Códigos de uso de hasta 10 caracteres: caben en Predio.usoPredio y TarifaArbitrio.uso de v1.
  [G.USO_PREDIO]: [
    { codigo: 'CASA', nombre: 'Casa habitación', sistema: true },
    { codigo: 'COMERCIO', nombre: 'Comercio' },
    { codigo: 'SERVICIOS', nombre: 'Servicios' },
    { codigo: 'INDUSTRIA', nombre: 'Industria' },
    { codigo: 'EDUCACION', nombre: 'Educación' },
    { codigo: 'SALUD', nombre: 'Salud' },
    { codigo: 'CULTO', nombre: 'Culto religioso' },
    { codigo: 'ESTATAL', nombre: 'Entidad pública' },
    { codigo: 'COCHERA', nombre: 'Cochera o estacionamiento' },
    { codigo: 'TERRENO', nombre: 'Terreno sin construir' },
    { codigo: 'OTROS', nombre: 'Otros usos' },
  ],
  [G.SUB_USO_PREDIO]: [
    { codigo: 'CASA_UNIFAMILIAR', nombre: 'Vivienda unifamiliar', padre: 'CASA' },
    { codigo: 'CASA_MULTIFAMILIAR', nombre: 'Vivienda multifamiliar o departamento', padre: 'CASA' },
    { codigo: 'COM_BODEGA', nombre: 'Bodega', padre: 'COMERCIO' },
    { codigo: 'COM_TIENDA', nombre: 'Tienda', padre: 'COMERCIO' },
    { codigo: 'COM_RESTAURANTE', nombre: 'Restaurante', padre: 'COMERCIO' },
    { codigo: 'COM_MERCADO', nombre: 'Puesto de mercado', padre: 'COMERCIO' },
    { codigo: 'SRV_OFICINA', nombre: 'Oficina', padre: 'SERVICIOS' },
    { codigo: 'SRV_HOSPEDAJE', nombre: 'Hospedaje u hotel', padre: 'SERVICIOS' },
    { codigo: 'IND_TALLER', nombre: 'Taller', padre: 'INDUSTRIA' },
    { codigo: 'IND_FABRICA', nombre: 'Fábrica', padre: 'INDUSTRIA' },
  ],
  // Tipo por defecto: DECLARATIVA en todo lo que crea o cambia la obligación. El manual llama
  // informativas a la inscripción, el descargo y el cambio de características; cada muni lo ajusta.
  [G.MOTIVO_DJ]: [
    { codigo: 'INSCRIPCION', nombre: 'Inscripción', atributos: { tipo: 'DECLARATIVA' }, sistema: true },
    { codigo: 'COMPRA', nombre: 'Adquisición', atributos: { tipo: 'DECLARATIVA' }, sistema: true },
    { codigo: 'VENTA', nombre: 'Descargo por transferencia', atributos: { tipo: 'DECLARATIVA' }, sistema: true },
    { codigo: 'BAJA', nombre: 'Descargo por baja del predio', atributos: { tipo: 'DECLARATIVA' }, sistema: true },
    { codigo: 'MODIFICACION', nombre: 'Cambio de características del predio', atributos: { tipo: 'DECLARATIVA' } },
    { codigo: 'RECTIFICACION', nombre: 'Rectificatoria o sustitutoria', atributos: { tipo: 'DECLARATIVA' }, sistema: true },
    { codigo: 'ANUAL', nombre: 'Declaración anual', atributos: { tipo: 'DECLARATIVA' }, sistema: true },
    { codigo: 'ACTUALIZACION_ANUAL', nombre: 'Actualización anual de valores', atributos: { tipo: 'DECLARATIVA' }, sistema: true },
    { codigo: 'FISCALIZACION', nombre: 'Resultado de fiscalización', atributos: { tipo: 'DECLARATIVA' }, sistema: true },
    { codigo: 'ACTUALIZACION_DATOS', nombre: 'Actualización de datos del contribuyente', atributos: { tipo: 'INFORMATIVA' } },
  ],
  [G.SUB_MOTIVO_DJ]: [
    { codigo: 'A_COMPRAVENTA', nombre: 'Compraventa', padre: 'COMPRA' },
    { codigo: 'A_DONACION', nombre: 'Donación', padre: 'COMPRA' },
    { codigo: 'A_ANTICIPO_LEGITIMA', nombre: 'Anticipo de legítima', padre: 'COMPRA' },
    { codigo: 'A_SUCESION', nombre: 'Sucesión (herencia)', padre: 'COMPRA' },
    { codigo: 'A_ADJUDICACION', nombre: 'Adjudicación', padre: 'COMPRA' },
    { codigo: 'A_PERMUTA', nombre: 'Permuta', padre: 'COMPRA' },
    { codigo: 'A_DACION_PAGO', nombre: 'Dación en pago', padre: 'COMPRA' },
    { codigo: 'A_PRESCRIPCION', nombre: 'Prescripción adquisitiva', padre: 'COMPRA' },
    { codigo: 'A_REMATE', nombre: 'Remate', padre: 'COMPRA' },
    { codigo: 'T_COMPRAVENTA', nombre: 'Compraventa', padre: 'VENTA' },
    { codigo: 'T_DONACION', nombre: 'Donación', padre: 'VENTA' },
    { codigo: 'T_ANTICIPO_LEGITIMA', nombre: 'Anticipo de legítima', padre: 'VENTA' },
    { codigo: 'T_PERMUTA', nombre: 'Permuta', padre: 'VENTA' },
    { codigo: 'T_DACION_PAGO', nombre: 'Dación en pago', padre: 'VENTA' },
    { codigo: 'B_DEMOLICION', nombre: 'Demolición total', padre: 'BAJA' },
    { codigo: 'B_ACUMULACION', nombre: 'Acumulación de predios', padre: 'BAJA' },
    { codigo: 'B_SUBDIVISION', nombre: 'Subdivisión o independización', padre: 'BAJA' },
    { codigo: 'C_AMPLIACION', nombre: 'Ampliación o construcción', padre: 'MODIFICACION' },
    { codigo: 'C_DEMOLICION_PARCIAL', nombre: 'Demolición parcial', padre: 'MODIFICACION' },
    { codigo: 'C_CAMBIO_USO', nombre: 'Cambio de uso', padre: 'MODIFICACION' },
    // J09 (Fase 7): la objeción a la actualización anual de valores se presenta como DJ anual.
    { codigo: 'AN_OBJECION', nombre: 'Objeción a la actualización de valores', padre: 'ANUAL', sistema: true },
  ],
  [G.TIPO_DOC_ADJUNTO]: [
    { codigo: 'ESCRITURA', nombre: 'Escritura pública' },
    { codigo: 'MINUTA', nombre: 'Minuta' },
    { codigo: 'CONTRATO', nombre: 'Contrato privado' },
    { codigo: 'PARTIDA', nombre: 'Partida registral' },
    { codigo: 'DECLARATORIA', nombre: 'Declaratoria de fábrica' },
    { codigo: 'LICENCIA', nombre: 'Licencia de edificación' },
    { codigo: 'CONFORMIDAD', nombre: 'Conformidad de obra' },
    { codigo: 'RESOLUCION', nombre: 'Resolución' },
    { codigo: 'PODER', nombre: 'Carta poder' },
    { codigo: 'COPIA_DOCUMENTO', nombre: 'Copia del documento de identidad' },
    { codigo: 'OTROS', nombre: 'Otros' },
  ],
  [G.TIPO_DOC_TRANSFERENCIA]: [
    { codigo: 'ESCRITURA', nombre: 'Escritura pública' },
    { codigo: 'MINUTA', nombre: 'Minuta' },
    { codigo: 'CONTRATO', nombre: 'Contrato privado' },
    { codigo: 'RESOLUCION_JUDICIAL', nombre: 'Resolución judicial' },
    { codigo: 'SUCESION', nombre: 'Sucesión intestada o testamento inscrito' },
    { codigo: 'ADJUDICACION', nombre: 'Acta de adjudicación' },
    { codigo: 'OTROS', nombre: 'Otros' },
  ],
};
