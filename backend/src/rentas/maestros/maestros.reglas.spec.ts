import { describe, expect, it } from 'vitest';
import { anioValido, indiceDuplicado, validarEscala } from './maestros.reglas.js';

// Escala vigente del D.L. 776: hasta 15 UIT 0.2%, 15-60 UIT 0.6%, más de 60 UIT 1.0%.
const escalaLegal = [
  { tramo: 1, desdeUit: 0, hastaUit: 15, tasa: 0.2 },
  { tramo: 2, desdeUit: 15, hastaUit: 60, tasa: 0.6 },
  { tramo: 3, desdeUit: 60, hastaUit: null, tasa: 1 },
];

describe('validarEscala', () => {
  it('acepta la escala legal aunque llegue desordenada', () => {
    expect(validarEscala([escalaLegal[2], escalaLegal[0], escalaLegal[1]])).toBeNull();
  });

  it('rechaza una escala vacía', () => {
    expect(validarEscala([])).toMatch(/al menos un tramo/);
  });

  it('rechaza un hueco entre tramos', () => {
    const conHueco = [escalaLegal[0], { ...escalaLegal[1], desdeUit: 16 }, escalaLegal[2]];
    expect(validarEscala(conHueco)).toMatch(/tramo 2 debe empezar/);
  });

  it('rechaza que el tramo 1 no empiece en 0', () => {
    expect(validarEscala([{ ...escalaLegal[0], desdeUit: 1 }, escalaLegal[1], escalaLegal[2]])).toMatch(/0 UIT/);
  });

  it('rechaza tope en el último tramo y falta de tope en uno intermedio', () => {
    expect(validarEscala([escalaLegal[0], escalaLegal[1], { ...escalaLegal[2], hastaUit: 100 }])).toMatch(/último/);
    expect(validarEscala([{ ...escalaLegal[0], hastaUit: null }, escalaLegal[1], escalaLegal[2]])).toMatch(/tope/);
  });

  it('rechaza numeración con saltos y "hasta" menor o igual que "desde"', () => {
    expect(validarEscala([escalaLegal[0], { ...escalaLegal[1], tramo: 3 }])).toMatch(/sin saltos/);
    expect(validarEscala([{ tramo: 1, desdeUit: 0, hastaUit: 0, tasa: 0.2 }, { tramo: 2, desdeUit: 0, hastaUit: null, tasa: 1 }])).toMatch(
      /mayor que/,
    );
  });
});

describe('indiceDuplicado', () => {
  const clave = (t: { concepto: string; zonaId?: number | null }) => `${t.concepto}|${t.zonaId ?? '*'}`;

  it('detecta duplicados contando null como "todas las zonas"', () => {
    expect(indiceDuplicado([{ concepto: 'BARRIDO' }, { concepto: 'BARRIDO', zonaId: null }], clave)).toBe(1);
  });

  it('no confunde una zona concreta con "todas"', () => {
    expect(indiceDuplicado([{ concepto: 'BARRIDO' }, { concepto: 'BARRIDO', zonaId: 1 }], clave)).toBe(-1);
  });
});

describe('anioValido', () => {
  it('acepta años razonables y rechaza el resto', () => {
    expect(anioValido(2026)).toBe(true);
    expect(anioValido(1999)).toBe(false);
    expect(anioValido(2026.5)).toBe(false);
  });
});
