import { TipoPersona } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { normalizarDocumento, rucValido, validarDocumento } from './documento.js';

describe('rucValido', () => {
  it('acepta RUC con dígito verificador correcto', () => {
    expect(rucValido('20131312955')).toBe(true); // SUNAT
    expect(rucValido('20100047218')).toBe(true); // BCP
  });

  it('rechaza dígito verificador, prefijo o longitud incorrectos', () => {
    expect(rucValido('20131312956')).toBe(false);
    expect(rucValido('30131312955')).toBe(false);
    expect(rucValido('2013131295')).toBe(false);
    expect(rucValido('2013131295A')).toBe(false);
  });
});

describe('validarDocumento', () => {
  it('valida DNI de 8 dígitos', () => {
    expect(validarDocumento('DNI', '12345678', TipoPersona.NATURAL)).toBeNull();
    expect(validarDocumento('DNI', '1234567', TipoPersona.NATURAL)).toMatch(/8 dígitos/);
    expect(validarDocumento('DNI', "1234567'", TipoPersona.NATURAL)).toMatch(/8 dígitos/);
  });

  it('exige RUC 20 para persona jurídica y lo rechaza para natural', () => {
    expect(validarDocumento('RUC', '20131312955', TipoPersona.JURIDICA)).toBeNull();
    expect(validarDocumento('DNI', '12345678', TipoPersona.JURIDICA)).toMatch(/jurídica/);
    expect(validarDocumento('RUC', '20131312955', TipoPersona.NATURAL)).toMatch(/jurídica/);
  });

  it('valida CE y pasaporte alfanuméricos y rechaza tipos desconocidos', () => {
    expect(validarDocumento('CE', '001234567', TipoPersona.NATURAL)).toBeNull();
    expect(validarDocumento('PASAPORTE', 'AB12', TipoPersona.NATURAL)).toMatch(/6 a 12/);
    expect(validarDocumento('LIBRETA', '123', TipoPersona.NATURAL)).toMatch(/no válido/);
  });
});

describe('normalizarDocumento', () => {
  it('quita espacios y pasa a mayúsculas', () => {
    expect(normalizarDocumento(' ab 12 34 56 ')).toBe('AB123456');
  });
});
