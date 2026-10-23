import { describe, expect, it } from 'vitest';
import { validarCondominos, validarDeclaracion, type DeclaracionDJ } from './declaracion.reglas.js';

const ctx = { hoy: '2026-10-21', titularesActuales: [1] };
const base: DeclaracionDJ = {
  motivo: 'RECTIFICACION',
  anio: 2026,
  fecha: '2026-10-01',
  declaranteId: 1,
  predioId: 10,
  condominos: [{ contribuyenteId: 1, porcentaje: 100 }],
  pisos: [{ nivel: '01', anioConstruccion: 2000, areaConstruida: 80 }],
};

describe('validarCondominos', () => {
  it('acepta condominio 50/50 y 33.33+33.33+33.34', () => {
    expect(validarCondominos([{ contribuyenteId: 1, porcentaje: 50 }, { contribuyenteId: 2, porcentaje: 50 }])).toBeNull();
    expect(
      validarCondominos([
        { contribuyenteId: 1, porcentaje: 33.33 },
        { contribuyenteId: 2, porcentaje: 33.33 },
        { contribuyenteId: 3, porcentaje: 33.34 },
      ]),
    ).toBeNull();
  });

  it('rechaza suma distinta de 100, vacío, duplicados y porcentaje 0', () => {
    expect(validarCondominos([{ contribuyenteId: 1, porcentaje: 60 }])).toMatch(/suman 60.00/);
    expect(validarCondominos([])).toMatch(/al menos un titular/);
    expect(validarCondominos([{ contribuyenteId: 1, porcentaje: 50 }, { contribuyenteId: 1, porcentaje: 50 }])).toMatch(/dos veces/);
    expect(validarCondominos([{ contribuyenteId: 1, porcentaje: 0 }, { contribuyenteId: 2, porcentaje: 100 }])).toMatch(/entre 0 y 100/);
  });
});

describe('validarDeclaracion', () => {
  it('acepta una rectificación válida', () => {
    expect(validarDeclaracion(base, ctx)).toBeNull();
  });

  it('exige predio salvo en inscripción, y lo prohíbe en inscripción', () => {
    expect(validarDeclaracion({ ...base, predioId: null }, ctx)).toMatch(/Indica el predio/);
    expect(validarDeclaracion({ ...base, motivo: 'INSCRIPCION' }, { ...ctx, titularesActuales: [] })).toMatch(/no indiques predio/);
    expect(validarDeclaracion({ ...base, motivo: 'INSCRIPCION', predioId: null }, { ...ctx, titularesActuales: [] })).toBeNull();
  });

  it('rechaza fecha futura y declarante que no es titular (salvo compra)', () => {
    expect(validarDeclaracion({ ...base, fecha: '2026-12-01' }, ctx)).toMatch(/futura/);
    expect(validarDeclaracion({ ...base, declaranteId: 9, condominos: [{ contribuyenteId: 9, porcentaje: 100 }] }, ctx)).toMatch(
      /no es titular/,
    );
    expect(
      validarDeclaracion({ ...base, motivo: 'COMPRA', declaranteId: 9, condominos: [{ contribuyenteId: 9, porcentaje: 100 }] }, ctx),
    ).toBeNull();
  });

  it('en venta el declarante sale de los condóminos', () => {
    expect(validarDeclaracion({ ...base, motivo: 'VENTA' }, ctx)).toMatch(/deja de ser titular/);
    expect(validarDeclaracion({ ...base, motivo: 'VENTA', condominos: [{ contribuyenteId: 2, porcentaje: 100 }] }, ctx)).toBeNull();
  });

  it('valida pisos: nivel repetido, área 0 y año fuera de rango', () => {
    const p = base.pisos[0];
    expect(validarDeclaracion({ ...base, pisos: [p, { ...p, nivel: '01 ' }] }, ctx)).toMatch(/repetido/);
    expect(validarDeclaracion({ ...base, pisos: [{ ...p, areaConstruida: 0 }] }, ctx)).toMatch(/mayor que 0/);
    expect(validarDeclaracion({ ...base, pisos: [{ ...p, anioConstruccion: 2027 }] }, ctx)).toMatch(/entre 1900 y 2026/);
  });

  it('la baja solo exige que el declarante sea titular', () => {
    expect(validarDeclaracion({ ...base, motivo: 'BAJA', condominos: [], pisos: [] }, ctx)).toBeNull();
  });
});
