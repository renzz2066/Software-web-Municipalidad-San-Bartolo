import { describe, expect, it } from 'vitest';
import { formatearCorrelativo, rangoCorrelativos } from './correlativos.js';

describe('correlativos', () => {
  it('rellena con ceros a 6 dígitos', () => {
    expect(formatearCorrelativo(123)).toBe('000123');
    expect(formatearCorrelativo(1234567)).toBe('1234567');
  });

  it('el primer número de una serie nueva es 000001', () => {
    expect(rangoCorrelativos(1, 1)).toEqual(['000001']);
  });

  it('reservar varios devuelve el rango que termina en el último', () => {
    expect(rangoCorrelativos(13, 3)).toEqual(['000011', '000012', '000013']);
  });
});
