import {
  anioAfectacionPorDefecto,
  errorAnexo,
  errorAnular,
  errorEditar,
  errorInscripcionRepetida,
  errorNiveles,
  errorObjecion,
  errorPorcentajes,
  errorReabrir,
  fechaArbitriosPorDefecto,
  indicePredominante,
  numeroDj,
  type AnexoDj,
} from './dj.reglas.js';

const ANEXO: AnexoDj = {
  porcentaje: 100,
  fechaAdquisicion: '2023-05-10',
  anioAfectacion: 2024,
  areaTerreno: 120,
  niveles: [],
  obras: [],
  usos: [{ uso: 'CASA', area: 120 }],
  rusticos: [],
  adquirientes: [],
};
const CTX = { motivo: 'COMPRA', fechaPresentacion: '2023-06-01', rustico: false, anioActual: 2026 };

describe('número y afectación (J02, J10, J11)', () => {
  it('correlativo AA-NNNNNNN', () => {
    expect(numeroDj(2026, 42)).toBe('26-0000042');
  });

  it('J10: una compra en el año N afecta desde N+1', () => {
    expect(anioAfectacionPorDefecto('2023-05-10', '2023-06-01')).toBe(2024);
    expect(anioAfectacionPorDefecto(null, '2026-03-01')).toBe(2026);
  });

  it('J11: arbitrios desde el mes del hecho o el siguiente', () => {
    expect(fechaArbitriosPorDefecto('2023-05-10', 'MES_SIGUIENTE')).toBe('2023-06-01');
    expect(fechaArbitriosPorDefecto('2023-12-20', 'MES_SIGUIENTE')).toBe('2024-01-01');
    expect(fechaArbitriosPorDefecto('2023-05-10', 'MES_DEL_HECHO')).toBe('2023-05-01');
  });
});

describe('cabecera (J06)', () => {
  it('la inscripción va una sola vez por persona', () => {
    expect(errorInscripcionRepetida('INSCRIPCION', ['24-0000001'])).toMatch(/24-0000001/);
    expect(errorInscripcionRepetida('INSCRIPCION', [])).toBeNull();
    expect(errorInscripcionRepetida('COMPRA', ['24-0000001'])).toBeNull();
  });
});

describe('anexo (R03, R04, J12, V04, V07)', () => {
  it('una adquisición válida pasa', () => {
    expect(errorAnexo(ANEXO, CTX, 'Anexo 1')).toBeNull();
  });

  it('adquisición sin fecha y fechas posteriores a la presentación', () => {
    expect(errorAnexo({ ...ANEXO, fechaAdquisicion: null }, CTX, 'Anexo 1')).toMatch(/fecha de adquisición/);
    expect(errorAnexo({ ...ANEXO, fechaAdquisicion: '2023-07-01' }, CTX, 'Anexo 1')).toMatch(/posterior a la presentación/);
  });

  it('J12: un descargo por transferencia necesita fecha y adquiriente; no necesita características', () => {
    const venta = { ...CTX, motivo: 'VENTA' };
    const base = { ...ANEXO, fechaAdquisicion: null, areaTerreno: 0, usos: [] };
    expect(errorAnexo(base, venta, 'Anexo 1')).toMatch(/fecha de descargo/);
    expect(errorAnexo({ ...base, fechaDescargo: '2023-05-20' }, venta, 'Anexo 1')).toMatch(/quién adquiere/);
    expect(errorAnexo({ ...base, fechaDescargo: '2023-05-20', adquirientes: [{ rol: 'ADQUIRIENTE' }] }, venta, 'Anexo 1')).toBeNull();
    expect(errorAnexo({ ...ANEXO, fechaDescargo: '2023-05-20' }, CTX, 'Anexo 1')).toMatch(/solo va en un descargo/);
  });

  it('R03: al menos un uso y un solo predominante; si no se marca, el de mayor área', () => {
    expect(errorAnexo({ ...ANEXO, usos: [] }, CTX, 'Anexo 1')).toMatch(/al menos un uso/);
    const dos = [
      { uso: 'CASA', area: 80, predominante: true },
      { uso: 'COMERCIO', area: 40, predominante: true },
    ];
    expect(errorAnexo({ ...ANEXO, usos: dos }, CTX, 'Anexo 1')).toMatch(/predominante/);
    expect(indicePredominante([{ uso: 'CASA', area: 30 }, { uso: 'COMERCIO', area: 90 }])).toBe(1);
  });

  it('V07: aranceles rústicos solo en un predio rústico, y el rústico los necesita', () => {
    expect(errorAnexo({ ...ANEXO, rusticos: [{ hectareas: 2 }] }, CTX, 'Anexo 1')).toMatch(/solo van en un predio rústico/);
    expect(errorAnexo({ ...ANEXO, areaTerreno: 0 }, { ...CTX, rustico: true }, 'Anexo 1')).toMatch(/hectáreas/);
    expect(errorAnexo({ ...ANEXO, areaTerreno: 0, rusticos: [{ hectareas: 2 }] }, { ...CTX, rustico: true }, 'Anexo 1')).toBeNull();
  });

  it('niveles: repetidos, categorías y área común con su participación (V04)', () => {
    const nivel = { nivel: '1', clasificacion: 'CASA_HABITACION', material: 'LADRILLO', estadoConservacion: 'BUENO', categorias: 'CCDDEEF', areaPropia: 90 };
    expect(errorNiveles([nivel, { ...nivel }], 2026)).toMatch(/repetido/);
    expect(errorNiveles([{ ...nivel, categorias: 'XX' }], 2026)).toMatch(/7 letras/);
    expect(errorNiveles([{ ...nivel, areaComun: 20 }], 2026)).toMatch(/participación/);
    expect(errorNiveles([{ ...nivel, areaComun: 20, participacion: 25 }], 2026)).toBeNull();
  });

  it('R04: los % declarados por cada condómino en su DJ no pasan de 100', () => {
    expect(errorPorcentajes('Anexo 1', 50, [{ nombre: 'ROSA', porcentaje: 50 }])).toBeNull();
    expect(errorPorcentajes('Anexo 1', 60, [{ nombre: 'ROSA', porcentaje: 50 }])).toMatch(/110\.00%/);
  });
});

describe('estados (J04, J05)', () => {
  it('solo se edita una DJ pendiente', () => {
    expect(errorEditar('PENDIENTE')).toBeNull();
    expect(errorEditar('LIQUIDADA')).not.toBeNull();
  });

  it('se anula una pendiente; una liquidada espera a la liquidación (extorno)', () => {
    expect(errorAnular('PENDIENTE')).toBeNull();
    expect(errorAnular('LIQUIDADA')).toBeNull(); // se anula extornando su cuenta (Fase 5)
    expect(errorAnular('RECHAZADA')).toMatch(/rechazada/);
    expect(errorAnular('ANULADA')).toMatch(/anulada/);
  });

  it('J05: solo se reabre una liquidada de un motivo reabrible', () => {
    expect(errorReabrir('LIQUIDADA', 'COMPRA', ['COMPRA'])).toBeNull();
    expect(errorReabrir('LIQUIDADA', 'VENTA', ['COMPRA'])).toMatch(/no se reabre/);
    expect(errorReabrir('PENDIENTE', 'COMPRA', ['COMPRA'])).toMatch(/liquidada/);
  });
});

describe('Fase 7', () => {
  it('V05: una obra con código necesita año, material y conservación', () => {
    const obra = { codigo: 'C01', descripcion: 'CERCO', cantidad: 10, anioConstruccion: 2020, material: 'CONCRETO', estadoConservacion: 'BUENO' };
    expect(errorAnexo({ ...ANEXO, obras: [obra] }, CTX, 'Anexo 1')).toBeNull();
    expect(errorAnexo({ ...ANEXO, obras: [{ ...obra, material: null }] }, CTX, 'Anexo 1')).toMatch(/material/);
    expect(errorAnexo({ ...ANEXO, obras: [{ ...obra, anioConstruccion: null }] }, CTX, 'Anexo 1')).toMatch(/año/);
    expect(errorAnexo({ ...ANEXO, obras: [{ ...obra, estadoConservacion: 'NUEVO' }] }, CTX, 'Anexo 1')).toMatch(/conservación/);
    // Sin código basta la descripción y la cantidad (valor declarado, como v1).
    expect(errorAnexo({ ...ANEXO, obras: [{ descripcion: 'TANQUE', cantidad: 1 }] }, CTX, 'Anexo 1')).toBeNull();
  });

  it('J09: la objeción va hasta el pago al contado, sobre un año actualizado y rige desde ese año', () => {
    const ok = { fechaPresentacion: '2026-02-10', venceContado: '2026-02-27', actualizado: true, aniosAfectacion: [2026] };
    expect(errorObjecion(ok)).toBeNull();
    expect(errorObjecion({ ...ok, fechaPresentacion: '2026-02-27' })).toBeNull(); // el último día vale
    expect(errorObjecion({ ...ok, fechaPresentacion: '2026-03-02' })).toMatch(/hasta el 2026-02-27/);
    expect(errorObjecion({ ...ok, actualizado: false })).toMatch(/no hay actualización/);
    expect(errorObjecion({ ...ok, aniosAfectacion: [2026, 2027] })).toMatch(/rigen desde 2026/);
  });
});
