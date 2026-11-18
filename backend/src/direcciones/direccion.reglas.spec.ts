import {
  claveDireccion,
  componerLiteral,
  errorComponentes,
  errorCoordenadas,
  errorDomicilioForaneo,
  errorUbicacion,
  lineaForanea,
  normalizarValor,
} from './direccion.reglas.js';

const BASE = { ubigeo: '150129', zonaId: 1, urbanizacionId: 2, viaId: 3 };

describe('claveDireccion (D01)', () => {
  it('el orden de los componentes no crea otra dirección', () => {
    const a = claveDireccion({ ...BASE, componentes: [{ componente: 'MZ', valor: 'A' }, { componente: 'LT', valor: '5' }] });
    const b = claveDireccion({ ...BASE, componentes: [{ componente: 'LT', valor: '5' }, { componente: 'MZ', valor: 'A' }] });
    expect(a).toBe(b);
  });

  it('es la misma que arma la migración de v1 (DPTO < LT < MZ < NUMERO)', () => {
    const c = claveDireccion({
      ...BASE,
      componentes: [
        { componente: 'NUMERO', valor: '123' },
        { componente: 'DPTO', valor: '2' },
      ],
    });
    expect(c).toBe('150129|1|2|3|DPTO=2;NUMERO=123');
    expect(claveDireccion({ ubigeo: '150129', zonaId: null, urbanizacionId: null, viaId: 3, componentes: [] })).toBe('150129|||3|');
  });

  it('otro valor u otro sector es otra dirección', () => {
    const a = claveDireccion({ ...BASE, componentes: [{ componente: 'NUMERO', valor: '123' }] });
    expect(claveDireccion({ ...BASE, componentes: [{ componente: 'NUMERO', valor: '124' }] })).not.toBe(a);
    expect(claveDireccion({ ...BASE, zonaId: 9, componentes: [{ componente: 'NUMERO', valor: '123' }] })).not.toBe(a);
  });
});

describe('componerLiteral (D04)', () => {
  it('vía, componentes en su orden, habilitación y distrito: el formato de v1', () => {
    const literal = componerLiteral({
      via: { tipoVia: 'AV', nombre: ' LOS  PINOS ' },
      componentes: [
        { abreviatura: 'N°', valor: '123' },
        { abreviatura: 'Dpto.', valor: '2' },
      ],
      habilitacion: 'URB. LOS DELFINES',
      sector: 'SECTOR PLAYA',
      distrito: 'SAN BARTOLO',
    });
    expect(literal).toBe('AV LOS PINOS N° 123 Dpto. 2 URB. LOS DELFINES, SAN BARTOLO');
  });

  it('sin vía ni habilitación usa el sector, y sin distrito no agrega la coma', () => {
    expect(componerLiteral({ via: null, componentes: [], habilitacion: null, sector: 'SECTOR PLAYA', distrito: null })).toBe('SECTOR PLAYA');
    expect(componerLiteral({ via: null, componentes: [{ abreviatura: 'Mz.', valor: 'B' }], habilitacion: 'AA.HH. SOL', sector: null, distrito: null })).toBe(
      'Mz. B AA.HH. SOL',
    );
  });
});

describe('validaciones', () => {
  it('normaliza el valor: mayúsculas y un solo espacio', () => {
    expect(normalizarValor('  b  - 2 ')).toBe('B - 2');
  });

  it('componentes repetidos, vacíos o largos', () => {
    expect(errorComponentes([{ componente: 'MZ', valor: 'A' }, { componente: 'MZ', valor: 'B' }])).toMatch(/repetido/);
    expect(errorComponentes([{ componente: 'MZ', valor: '' }])).toMatch(/vacíos/);
    expect(errorComponentes([{ componente: 'MZ', valor: 'X'.repeat(21) }])).toMatch(/máximo/);
    expect(errorComponentes([{ componente: 'MZ', valor: 'A' }, { componente: 'LT', valor: '1' }])).toBeNull();
  });

  it('se ubica por vía o por habilitación (D02)', () => {
    expect(errorUbicacion({ viaId: null, urbanizacionId: null })).not.toBeNull();
    expect(errorUbicacion({ viaId: 1, urbanizacionId: null })).toBeNull();
    expect(errorUbicacion({ viaId: null, urbanizacionId: 4 })).toBeNull();
  });

  it('coordenadas opcionales, juntas y en rango (D05)', () => {
    expect(errorCoordenadas(null, null)).toBeNull();
    expect(errorCoordenadas(-12.39, -76.78)).toBeNull();
    expect(errorCoordenadas(-12.39, null)).toMatch(/ninguna/);
    expect(errorCoordenadas(-95, -76)).toMatch(/latitud/);
    expect(errorCoordenadas(-12, 181)).toMatch(/longitud/);
  });
});

describe('domicilio foráneo (P11)', () => {
  it('texto libre en el propio distrito se rechaza; en otro distrito pasa', () => {
    expect(errorDomicilioForaneo('150129', '150129', 'AV LOS PINOS 1')).not.toBeNull();
    expect(errorDomicilioForaneo('150122', '150129', 'AV LARCO 101')).toBeNull();
    expect(errorDomicilioForaneo('150129', '150129', null)).toBeNull();
  });

  it('la línea lleva el distrito y cabe en direccionFiscal', () => {
    expect(lineaForanea('AV LARCO 101', 'MIRAFLORES')).toBe('AV LARCO 101, MIRAFLORES');
    expect(lineaForanea('X'.repeat(200), null)).toHaveLength(150);
  });
});
