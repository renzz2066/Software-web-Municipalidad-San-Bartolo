import { describe, expect, it } from 'vitest';
import { GrupoCatalogo } from '@prisma/client';
import { CATALOGOS_NACIONALES } from './catalogos.nacional.js';
import { GRUPOS, REGLAS_MUNI, errorCuotas, errorValorRegla, validarAtributos } from './catalogos.reglas.js';

describe('validarAtributos', () => {
  it('exige el tipo de un motivo de DJ (J07)', () => {
    expect(validarAtributos(GrupoCatalogo.MOTIVO_DJ, {})).toEqual({ error: 'Falta "Tipo"' });
    expect(validarAtributos(GrupoCatalogo.MOTIVO_DJ, { tipo: 'OTRA' })).toHaveProperty('error');
    expect(validarAtributos(GrupoCatalogo.MOTIVO_DJ, { tipo: 'INFORMATIVA' })).toEqual({ atributos: { tipo: 'INFORMATIVA' } });
  });

  it('rechaza claves ajenas al grupo y tipos equivocados', () => {
    expect(validarAtributos(GrupoCatalogo.USO_PREDIO, { tipo: 'X' })).toHaveProperty('error');
    expect(validarAtributos(GrupoCatalogo.TIPO_RELACIONADO, { unico: 'si' })).toHaveProperty('error');
    expect(validarAtributos(GrupoCatalogo.BENEFICIO, { regimen: 'DEDUCCION', persona: 'NATURAL', porcentaje: 120 })).toHaveProperty('error');
    expect(validarAtributos(GrupoCatalogo.USO_PREDIO, ['a'])).toHaveProperty('error');
  });

  it('sin atributos devuelve null y descarta vacíos opcionales', () => {
    expect(validarAtributos(GrupoCatalogo.USO_PREDIO, null)).toEqual({ atributos: null });
    expect(validarAtributos(GrupoCatalogo.TIPO_RELACIONADO, { unico: null })).toEqual({ atributos: null });
  });
});

describe('errorCuotas (L07)', () => {
  it('acepta 4 trimestrales, 12 mensuales y 1 anual', () => {
    expect(errorCuotas(REGLAS_MUNI['arbitrios.cuotas'].defecto)).toBeNull();
    expect(errorCuotas(Array.from({ length: 12 }, (_, i) => [i + 1]))).toBeNull();
    expect(errorCuotas([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]])).toBeNull();
  });

  it('rechaza meses repetidos, desordenados, faltantes o cuotas vacías', () => {
    expect(errorCuotas([[1, 2, 3], [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]])).not.toBeNull();
    expect(errorCuotas([[2, 1], [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]])).not.toBeNull();
    expect(errorCuotas([[1, 2, 3]])).toBe('Las cuotas deben cubrir los 12 meses');
    expect(errorCuotas([[], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]])).not.toBeNull();
    expect(errorCuotas('4')).not.toBeNull();
    expect(errorCuotas([])).not.toBeNull();
  });
});

describe('errorValorRegla', () => {
  it('valida cada regla por su forma', () => {
    expect(errorValorRegla('dj.motivosReabribles', ['INSCRIPCION'])).toBeNull();
    expect(errorValorRegla('dj.motivosReabribles', ['A', 'A'])).toBe('Hay códigos repetidos');
    expect(errorValorRegla('dj.motivosReabribles', 'INSCRIPCION')).not.toBeNull();
    expect(errorValorRegla('arbitrios.inicioAfectacion', 'MES_SIGUIENTE')).toBeNull();
    expect(errorValorRegla('arbitrios.inicioAfectacion', 'ENERO')).not.toBeNull();
    expect(errorValorRegla('dj.prorrogaPresentacion', 'true')).not.toBeNull();
    expect(errorValorRegla('no.existe', 1)).toBe('Regla no válida');
  });

  it('los valores por defecto son válidos', () => {
    for (const [clave, def] of Object.entries(REGLAS_MUNI)) {
      expect(errorValorRegla(clave, def.defecto), clave).toBeNull();
    }
  });
});

describe('seed nacional', () => {
  it('cumple las reglas de su grupo: atributos, abreviatura, padre y códigos únicos', () => {
    for (const [grupo, items] of Object.entries(CATALOGOS_NACIONALES) as [GrupoCatalogo, typeof CATALOGOS_NACIONALES.MOTIVO_DJ][]) {
      const def = GRUPOS[grupo];
      const codigos = items!.map((i) => i.codigo);
      expect(new Set(codigos).size, grupo).toBe(codigos.length);
      for (const item of items!) {
        expect(item.codigo, grupo).toMatch(/^[A-Z0-9_]{1,20}$/);
        expect(validarAtributos(grupo, item.atributos ?? null), `${grupo}.${item.codigo}`).not.toHaveProperty('error');
        if (def.abreviatura === 'requerida') expect(item.abreviatura, `${grupo}.${item.codigo}`).toBeTruthy();
        if (def.padre) {
          expect(CATALOGOS_NACIONALES[def.padre]?.some((p) => p.codigo === item.padre), `${grupo}.${item.codigo}`).toBe(true);
        } else {
          expect(item.padre, `${grupo}.${item.codigo}`).toBeUndefined();
        }
      }
    }
  });

  it('los motivos reabribles por defecto existen en el catálogo de motivos (J05)', () => {
    const motivos = CATALOGOS_NACIONALES.MOTIVO_DJ!.map((m) => m.codigo);
    for (const c of REGLAS_MUNI['dj.motivosReabribles'].defecto as string[]) expect(motivos).toContain(c);
  });

  it('los usos caben en los campos de uso de v1 (10 caracteres)', () => {
    for (const u of CATALOGOS_NACIONALES.USO_PREDIO!) expect(u.codigo.length).toBeLessThanOrEqual(10);
  });
});
