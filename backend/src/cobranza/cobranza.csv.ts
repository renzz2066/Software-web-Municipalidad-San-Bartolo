import type { GrupoCobranza } from '@prisma/client';

// Lectura de puntajes_AAAA.csv, la salida de modelo3grupos/05_puntajes.py
// (specs/prediccion-cobranza-v1.md, P2). Lógica pura: se prueba sin BD.

export const COLUMNAS_CSV = [
  'anio',
  'prioridad',
  'tramo',
  'CODCLI',
  'grupo_pred',
  'p_puntual',
  'p_tardio',
  'p_incobrable',
  'deuda_anio',
  'deuda_pendiente',
  'deuda_esperada',
  'accion',
] as const;

export interface FilaPuntaje {
  anio: number;
  prioridad: number;
  tramo: 'A' | 'B' | 'C';
  codigoLegacy: string;
  grupo: GrupoCobranza;
  pPuntual: number;
  pTardio: number;
  pIncobrable: number;
  deudaAnio: number;
  deudaPendiente: number;
  deudaEsperada: number;
  accion: string;
}

export class ErrorCsv extends Error {}

const GRUPOS: Record<string, GrupoCobranza> = {
  puntual: 'PUNTUAL',
  tardio: 'TARDIO',
  incobrable: 'INCOBRABLE',
};
const TOLERANCIA_SUMA = 0.002; // las probabilidades vienen redondeadas a 4 decimales
const MAX_ERRORES = 5;

/** Separa un CSV (coma, comillas dobles al estilo pandas/Excel) en filas de celdas. */
export function separarCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  const t = texto.replace(/^﻿/, ''); // BOM de utf-8-sig

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"' && t[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
    } else {
      celda += c;
    }
  }
  if (entreComillas) throw new ErrorCsv('El archivo tiene comillas sin cerrar.');
  if (celda !== '' || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.filter((f) => !(f.length === 1 && f[0].trim() === ''));
}

function sinTildes(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Convierte el CSV en filas validadas. Junta hasta 5 errores con su número de fila
 * (la cabecera es la fila 1, como en Excel) para que se corrija todo de una vez.
 */
export function leerPuntajesCsv(texto: string): FilaPuntaje[] {
  const filas = separarCsv(texto);
  if (filas.length < 2) throw new ErrorCsv('El archivo está vacío o solo tiene la cabecera.');

  const cabecera = filas[0].map((c) => c.trim());
  const faltan = COLUMNAS_CSV.filter((c) => !cabecera.includes(c));
  if (faltan.length > 0) {
    throw new ErrorCsv(
      `Faltan columnas: ${faltan.join(', ')}. Usa el puntajes_AAAA.csv que genera 05_puntajes.py.`,
    );
  }
  const idx = Object.fromEntries(COLUMNAS_CSV.map((c) => [c, cabecera.indexOf(c)])) as Record<
    (typeof COLUMNAS_CSV)[number],
    number
  >;

  const errores: string[] = [];
  const resultado: FilaPuntaje[] = [];
  const codigos = new Set<string>();
  const prioridades = new Set<number>();

  for (let i = 1; i < filas.length && errores.length < MAX_ERRORES; i++) {
    const f = filas[i];
    const nFila = i + 1;
    const celda = (c: (typeof COLUMNAS_CSV)[number]) => (f[idx[c]] ?? '').trim();
    const numero = (c: (typeof COLUMNAS_CSV)[number]) => {
      const v = celda(c);
      const n = v === '' ? NaN : Number(v);
      if (!Number.isFinite(n)) errores.push(`Fila ${nFila}: "${c}" no es un número (${v || 'vacío'}).`);
      return n;
    };

    const anio = numero('anio');
    const prioridad = numero('prioridad');
    const pPuntual = numero('p_puntual');
    const pTardio = numero('p_tardio');
    const pIncobrable = numero('p_incobrable');
    const deudaAnio = numero('deuda_anio');
    const deudaPendiente = numero('deuda_pendiente');
    const deudaEsperada = numero('deuda_esperada');
    const tramo = celda('tramo').toUpperCase();
    const codigo = celda('CODCLI');
    const grupo = GRUPOS[sinTildes(celda('grupo_pred'))];
    const accion = celda('accion');
    const antes = errores.length;

    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) errores.push(`Fila ${nFila}: año inválido.`);
    if (!Number.isInteger(prioridad) || prioridad < 1) errores.push(`Fila ${nFila}: prioridad inválida.`);
    else if (prioridades.has(prioridad)) errores.push(`Fila ${nFila}: prioridad ${prioridad} repetida.`);
    if (!['A', 'B', 'C'].includes(tramo)) errores.push(`Fila ${nFila}: el tramo debe ser A, B o C.`);
    if (!/^\d{7}$/.test(codigo)) errores.push(`Fila ${nFila}: el CODCLI debe tener 7 dígitos (${codigo || 'vacío'}).`);
    else if (codigos.has(codigo)) errores.push(`Fila ${nFila}: el CODCLI ${codigo} está repetido.`);
    if (!grupo) errores.push(`Fila ${nFila}: grupo desconocido (${celda('grupo_pred') || 'vacío'}).`);
    if (!accion) errores.push(`Fila ${nFila}: falta la acción sugerida.`);
    for (const p of [pPuntual, pTardio, pIncobrable]) {
      if (p < 0 || p > 1) {
        errores.push(`Fila ${nFila}: las probabilidades deben estar entre 0 y 1.`);
        break;
      }
    }
    if (Math.abs(pPuntual + pTardio + pIncobrable - 1) > TOLERANCIA_SUMA) {
      errores.push(`Fila ${nFila}: las tres probabilidades no suman 1.`);
    }
    if (deudaEsperada < 0) errores.push(`Fila ${nFila}: la deuda esperada no puede ser negativa.`);

    if (errores.length > antes) continue;
    codigos.add(codigo);
    prioridades.add(prioridad);
    resultado.push({
      anio,
      prioridad,
      tramo: tramo as FilaPuntaje['tramo'],
      codigoLegacy: codigo,
      grupo,
      pPuntual,
      pTardio,
      pIncobrable,
      deudaAnio,
      deudaPendiente,
      deudaEsperada,
      accion: accion.slice(0, 60),
    });
  }

  if (errores.length > 0) throw new ErrorCsv(errores.slice(0, MAX_ERRORES).join(' '));
  const anios = new Set(resultado.map((r) => r.anio));
  if (anios.size > 1) throw new ErrorCsv('El archivo mezcla varios años: importa un año por archivo.');
  return resultado;
}
