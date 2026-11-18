// Direcciones únicas (specs/rentas-nucleo-v2.md, Fase 2; reglas D01–D05). Lógica pura: cómo se
// arma la literal, qué identifica a una dirección y qué se valida antes de escribir.

export const MAX_COMPONENTES = 12;
export const LARGO_VALOR = 20;
export const LARGO_LITERAL = 250;
// direccionFiscal de contribuyentes (la leen caja, valores y estado de cuenta) es VarChar(150).
export const LARGO_DIRECCION_FISCAL = 150;

export interface Componente {
  componente: string; // código del catálogo COMPONENTE_DIRECCION
  valor: string;
}

export interface PartesDireccion {
  ubigeo: string;
  zonaId: number | null;
  urbanizacionId: number | null;
  viaId: number | null;
  componentes: Componente[];
}

export interface PiezasLiteral {
  via: { tipoVia: string; nombre: string } | null;
  componentes: { abreviatura: string; valor: string }[]; // ya en orden
  habilitacion: string | null; // urbanización, AA.HH., A.F.
  sector: string | null; // solo si no hay nada más que mostrar
  distrito: string | null;
}

const espacios = (v: string) => v.trim().replace(/\s+/g, ' ');

// Lo que se guarda: sin espacios de más y en mayúsculas (igual que la migración de v1).
export const normalizarValor = (v: string) => espacios(v).toUpperCase();

// D01: dos registros con la misma clave son la misma dirección. Los componentes van ordenados
// por código para que "Mz. A Lt. 5" y "Lt. 5 Mz. A" no se dupliquen. La referencia y las
// coordenadas no cuentan: describen la dirección, no la identifican.
// La migración 20261117140000_rentas_v2_direcciones arma la misma clave en SQL.
export function claveDireccion(p: PartesDireccion): string {
  const componentes = [...p.componentes]
    .sort((a, b) => (a.componente < b.componente ? -1 : a.componente > b.componente ? 1 : 0))
    .map((c) => `${c.componente}=${c.valor}`)
    .join(';');
  return [p.ubigeo, p.zonaId ?? '', p.urbanizacionId ?? '', p.viaId ?? '', componentes].join('|');
}

// D04: vía, componentes en su orden, habilitación y distrito. Mismo formato que v1
// ("AV LOS PINOS N° 123 Dpto. 2 URB. X, SAN BARTOLO"), para que los recibos no cambien.
export function componerLiteral(p: PiezasLiteral): string {
  const partes: string[] = [];
  if (p.via) partes.push(espacios(`${p.via.tipoVia} ${p.via.nombre}`));
  for (const c of p.componentes) partes.push(`${c.abreviatura} ${c.valor}`);
  if (p.habilitacion) partes.push(p.habilitacion);
  if (partes.length === 0 && p.sector) partes.push(p.sector);
  const linea = partes.join(' ');
  if (!linea) return p.distrito ?? '';
  return p.distrito ? `${linea}, ${p.distrito}` : linea;
}

// Componentes ya normalizados: cada código una sola vez, con valor, y no más de los que caben.
export function errorComponentes(lista: Componente[]): string | null {
  if (lista.length > MAX_COMPONENTES) return `Una dirección lleva como máximo ${MAX_COMPONENTES} componentes`;
  const vistos = new Set<string>();
  for (const c of lista) {
    if (!c.valor) return 'Completa o quita los componentes vacíos';
    if (c.valor.length > LARGO_VALOR) return `Cada componente tiene máximo ${LARGO_VALOR} caracteres`;
    if (vistos.has(c.componente)) return `El componente ${c.componente} está repetido`;
    vistos.add(c.componente);
  }
  return null;
}

// Una dirección del distrito se ubica al menos por su vía o por su habilitación urbana (D02).
export function errorUbicacion(p: Pick<PartesDireccion, 'viaId' | 'urbanizacionId'>): string | null {
  return p.viaId || p.urbanizacionId ? null : 'Indica al menos la vía o la habilitación urbana';
}

// D05: las coordenadas son opcionales, pero van juntas y dentro de rango.
export function errorCoordenadas(latitud: number | null, longitud: number | null): string | null {
  if ((latitud === null) !== (longitud === null)) return 'Indica latitud y longitud, o ninguna';
  if (latitud === null || longitud === null) return null;
  if (!Number.isFinite(latitud) || latitud < -90 || latitud > 90) return 'La latitud debe estar entre -90 y 90';
  if (!Number.isFinite(longitud) || longitud < -180 || longitud > 180) return 'La longitud debe estar entre -180 y 180';
  return null;
}

// P11: un domicilio en el propio distrito se elige del catálogo; foráneo es ubigeo + texto.
export function errorDomicilioForaneo(ubigeo: string, ubigeoMuni: string, texto: string | null): string | null {
  if (!texto) return null;
  if (ubigeo === ubigeoMuni) return 'El domicilio está en el distrito: elígelo del catálogo de direcciones (o regístralo ahí)';
  return null;
}

// Línea de domicilio foráneo que se copia en direccionFiscal.
export function lineaForanea(texto: string, distrito: string | null): string {
  return (distrito ? `${texto}, ${distrito}` : texto).slice(0, LARGO_DIRECCION_FISCAL);
}
