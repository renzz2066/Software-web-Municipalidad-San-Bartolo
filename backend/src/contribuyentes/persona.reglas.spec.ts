import { EstadoPersona, TipoPersona } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { documentoFicticio } from './documento.js';
import {
  componerNombre,
  errorContacto,
  errorDocumentos,
  errorNombre,
  errorRelacionados,
  estadoAlHabilitar,
  estadoCalculado,
  mensajeDeuda,
  pendientesDe,
  seSolapan,
} from './persona.reglas.js';

// RUC con dígito verificador (módulo 11, misma fórmula que documento.ts).
function ruc(prefijo: string, cuerpo: string): string {
  const base = prefijo + cuerpo;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(base[i]), 0);
  return base + String((11 - (suma % 11)) % 10);
}
const RUC_SUNAT = '20131312955';
const RUC_NATURAL = ruc('10', '45678912');

describe('componerNombre (P05)', () => {
  it('natural: paterno + materno + nombres, en mayúsculas y sin espacios dobles', () => {
    expect(componerNombre({ tipoPersona: TipoPersona.NATURAL, apellidoPaterno: 'pérez ', apellidoMaterno: 'ramos', nombres: 'juan  carlos' })).toBe(
      'PÉREZ RAMOS JUAN CARLOS',
    );
    expect(componerNombre({ tipoPersona: TipoPersona.NATURAL, apellidoPaterno: 'Lee', nombres: 'Ana' })).toBe('LEE ANA');
  });

  it('sucesión: abreviatura del tipo + apellidos del causante', () => {
    expect(
      componerNombre({ tipoPersona: TipoPersona.SUCESION, abreviaturaSucesion: 'SUC.', apellidoPaterno: 'Quispe', apellidoMaterno: 'Mamani' }),
    ).toBe('SUC. QUISPE MAMANI');
  });

  it('jurídica: razón social, aunque lleguen apellidos', () => {
    expect(componerNombre({ tipoPersona: TipoPersona.JURIDICA, razonSocial: 'Inversiones Sol SAC', apellidoPaterno: 'X' })).toBe('INVERSIONES SOL SAC');
  });

  it('nunca pasa de 120 caracteres', () => {
    expect(componerNombre({ tipoPersona: TipoPersona.JURIDICA, razonSocial: 'A'.repeat(200) })).toHaveLength(120);
  });
});

describe('errorNombre', () => {
  it('exige lo que cada tipo de persona necesita', () => {
    expect(errorNombre({ tipoPersona: TipoPersona.NATURAL, apellidoPaterno: 'PEREZ' })).toMatch(/nombres/);
    expect(errorNombre({ tipoPersona: TipoPersona.NATURAL, nombres: 'JUAN' })).toMatch(/paterno/);
    expect(errorNombre({ tipoPersona: TipoPersona.JURIDICA, razonSocial: '  ' })).toMatch(/razón social/);
    expect(errorNombre({ tipoPersona: TipoPersona.SUCESION, apellidoPaterno: 'QUISPE' })).toMatch(/tipo de sucesión/);
    expect(errorNombre({ tipoPersona: TipoPersona.SUCESION, apellidoPaterno: 'QUISPE', tipoSucesion: 'INDIVISA' })).toBeNull();
  });
});

describe('documentoFicticio (P17)', () => {
  it('detecta dígitos iguales y escaleras', () => {
    for (const n of ['00000000', '11111111', '12345678', '87654321', '23456789']) expect(documentoFicticio('DNI', n), n).toBe(true);
    expect(documentoFicticio('RUC', ruc('10', '12345678'))).toBe(true);
  });

  it('deja pasar documentos plausibles', () => {
    for (const n of ['45678912', '07263514', '10293847']) expect(documentoFicticio('DNI', n), n).toBe(false);
    expect(documentoFicticio('RUC', RUC_SUNAT)).toBe(false);
    expect(documentoFicticio('PASAPORTE', 'AB123456')).toBe(false);
  });
});

describe('errorDocumentos (P06, P07, P08, P17, P18)', () => {
  it('rechaza 00000000 y 12345678 con un mensaje que dice cómo corregir', () => {
    expect(errorDocumentos(TipoPersona.NATURAL, [{ tipoDoc: 'DNI', numDoc: '00000000' }])).toMatch(/inventado.*sin documento/);
    expect(errorDocumentos(TipoPersona.NATURAL, [{ tipoDoc: 'DNI', numDoc: '12345678' }])).toMatch(/inventado/);
  });

  it('natural: varios documentos de distinto tipo; no dos del mismo tipo', () => {
    expect(errorDocumentos(TipoPersona.NATURAL, [{ tipoDoc: 'DNI', numDoc: '45678912' }, { tipoDoc: 'RUC', numDoc: RUC_NATURAL }])).toBeNull();
    expect(errorDocumentos(TipoPersona.NATURAL, [{ tipoDoc: 'DNI', numDoc: '45678912' }, { tipoDoc: 'DNI', numDoc: '45678913' }])).toMatch(
      /dos documentos/,
    );
    expect(errorDocumentos(TipoPersona.NATURAL, [{ tipoDoc: 'RUC', numDoc: RUC_SUNAT }])).toMatch(/jurídica/);
  });

  it('la lista vacía es una persona sin documento; SIN_DOCUMENTO no va como documento (P08)', () => {
    expect(errorDocumentos(TipoPersona.NATURAL, [])).toBeNull();
    expect(errorDocumentos(TipoPersona.NATURAL, [{ tipoDoc: 'SIN_DOCUMENTO', numDoc: 'X' }])).toMatch(/lista vacía/);
  });

  it('jurídica: solo su RUC 20', () => {
    expect(errorDocumentos(TipoPersona.JURIDICA, [{ tipoDoc: 'RUC', numDoc: RUC_SUNAT }])).toBeNull();
    expect(errorDocumentos(TipoPersona.JURIDICA, [])).toMatch(/RUC/);
    expect(errorDocumentos(TipoPersona.JURIDICA, [{ tipoDoc: 'DNI', numDoc: '45678912' }])).toMatch(/RUC/);
  });

  it('sucesión: RUC o ninguno; el DNI del causante va aparte (P18)', () => {
    expect(errorDocumentos(TipoPersona.SUCESION, [])).toBeNull();
    expect(errorDocumentos(TipoPersona.SUCESION, [{ tipoDoc: 'DNI', numDoc: '45678912' }])).toMatch(/causante/);
  });

  it('tipos agregados por la muni: alfanumérico de 4 a 15', () => {
    expect(errorDocumentos(TipoPersona.NATURAL, [{ tipoDoc: 'CPP', numDoc: 'A1B2C3' }])).toBeNull();
    expect(errorDocumentos(TipoPersona.NATURAL, [{ tipoDoc: 'CPP', numDoc: 'A1' }])).toMatch(/4 a 15/);
  });
});

describe('estados (P02, P08, P16)', () => {
  const base = { numDoc: '45678912', excepcionAprobadaAt: null, nombreRevisado: true };

  it('sin documento queda PENDIENTE hasta que un supervisor apruebe la excepción', () => {
    const sinDoc = { ...base, numDoc: null };
    expect(estadoCalculado(null, pendientesDe(sinDoc))).toBe(EstadoPersona.PENDIENTE);
    expect(estadoCalculado(null, pendientesDe({ ...sinDoc, excepcionAprobadaAt: new Date() }))).toBe(EstadoPersona.HABILITADO);
  });

  it('el nombre convertido sin revisar deja PENDIENTE', () => {
    expect(pendientesDe({ ...base, nombreRevisado: false })).toHaveLength(1);
    expect(estadoCalculado(EstadoPersona.HABILITADO, pendientesDe({ ...base, nombreRevisado: false }))).toBe(EstadoPersona.PENDIENTE);
  });

  it('INHABILITADO no cambia al editar; al habilitar vuelve según sus pendientes', () => {
    expect(estadoCalculado(EstadoPersona.INHABILITADO, [])).toBe(EstadoPersona.INHABILITADO);
    expect(estadoAlHabilitar([])).toBe(EstadoPersona.HABILITADO);
    expect(estadoAlHabilitar(['falta algo'])).toBe(EstadoPersona.PENDIENTE);
  });
});

describe('errorContacto (P09)', () => {
  it('valida según el formato del tipo', () => {
    expect(errorContacto('Correo', 'EMAIL', 'ana@muni.gob.pe')).toBeNull();
    expect(errorContacto('Correo', 'EMAIL', 'ana@')).toMatch(/correo/);
    expect(errorContacto('Celular', 'CELULAR', '912345678')).toBeNull();
    expect(errorContacto('Celular', 'CELULAR', '812345678')).toMatch(/9 dígitos/);
    expect(errorContacto('Teléfono', 'TELEFONO', '(01) 430-1234')).toBeNull();
    expect(errorContacto('Teléfono', 'TELEFONO', '')).toMatch(/Completa/);
  });
});

describe('errorRelacionados (P10)', () => {
  it('solo un cónyuge vigente; los no vigentes no cuentan', () => {
    const unicos = new Map([['CONYUGE', 'Cónyuge']]);
    expect(errorRelacionados([{ tipo: 'CONYUGE', vigente: true }, { tipo: 'CONYUGE', vigente: false }], unicos)).toBeNull();
    expect(errorRelacionados([{ tipo: 'CONYUGE', vigente: true }, { tipo: 'CONYUGE', vigente: true }], unicos)).toMatch(/un cónyuge/);
    expect(errorRelacionados([{ tipo: 'RESPONSABLE', vigente: true }, { tipo: 'RESPONSABLE', vigente: true }], unicos)).toBeNull();
  });
});

describe('mensajeDeuda (P01)', () => {
  it('dice el monto con formato peruano', () => {
    expect(mensajeDeuda('1234.5')).toBe('El contribuyente mantiene una deuda de S/ 1,234.50 y no puede ser inhabilitado');
  });
});

describe('seSolapan (P14, P15)', () => {
  it('compara periodos con fin abierto', () => {
    expect(seSolapan({ anioDesde: 2024, anioHasta: null }, { anioDesde: 2026, anioHasta: 2026 })).toBe(true);
    expect(seSolapan({ anioDesde: 2020, anioHasta: 2023 }, { anioDesde: 2024, anioHasta: null })).toBe(false);
  });
});
