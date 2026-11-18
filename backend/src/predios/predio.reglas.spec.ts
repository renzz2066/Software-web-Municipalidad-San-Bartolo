import { asociacionEnAnio, condicionPorDefecto, cubre, errorBeneficioPredio, errorLinderos } from './predio.reglas.js';

describe('asociacionEnAnio (C4, J10)', () => {
  const compra = { contribuyenteId: 1, fechaAdquisicion: '2023-05-10', fechaFin: null, estado: 'ACTIVO' as const };

  it('una compra en el año N afecta desde N+1: en N está asociado, pero no es el contribuyente', () => {
    expect(asociacionEnAnio(compra, 2023)).toEqual({ asociado: true, contribuyenteDelAnio: false, finDesconocido: false });
    expect(asociacionEnAnio(compra, 2024)).toMatchObject({ asociado: true, contribuyenteDelAnio: true });
    expect(asociacionEnAnio(compra, 2022).asociado).toBe(false);
  });

  it('quien vende en N sigue siendo el contribuyente de N y deja de estar asociado en N+1', () => {
    const vendio = { contribuyenteId: 3, fechaAdquisicion: '2019-01-15', fechaFin: '2023-05-10', estado: 'BAJA' as const };
    expect(asociacionEnAnio(vendio, 2023)).toMatchObject({ asociado: true, contribuyenteDelAnio: true });
    expect(asociacionEnAnio(vendio, 2024).asociado).toBe(false);
  });

  it('una baja convertida de v1 sin fecha se muestra marcada y no cuenta como contribuyente', () => {
    const sinFecha = { contribuyenteId: 3, fechaAdquisicion: '2019-01-15', fechaFin: null, estado: 'BAJA' as const };
    expect(asociacionEnAnio(sinFecha, 2026)).toEqual({ asociado: true, contribuyenteDelAnio: false, finDesconocido: true });
  });

  it('sin fecha de adquisición (heredado) cuenta desde siempre', () => {
    expect(asociacionEnAnio({ ...compra, fechaAdquisicion: null }, 2000)).toMatchObject({ asociado: true, contribuyenteDelAnio: true });
  });
});

describe('beneficio del predio (R06)', () => {
  const INAF = { regimen: 'INAFECTACION', porcentaje: 100, nombre: 'Entidad religiosa', anioDesde: 2025, anioHasta: null };

  it('un predio inafecto exige que todos sus titulares sean inafectos en esos años', () => {
    const titulares = [
      { nombre: 'PARROQUIA X', inafectaciones: [{ anioDesde: 2020, anioHasta: null }] },
      { nombre: 'JUAN PEREZ', inafectaciones: [] },
    ];
    expect(errorBeneficioPredio(INAF, titulares)).toMatch(/JUAN PEREZ/);
    expect(errorBeneficioPredio(INAF, titulares.slice(0, 1))).toBeNull();
  });

  it('la inafectación del titular debe cubrir todo el periodo del predio', () => {
    const corta = [{ nombre: 'PARROQUIA X', inafectaciones: [{ anioDesde: 2020, anioHasta: 2026 }] }];
    expect(errorBeneficioPredio(INAF, corta)).not.toBeNull();
    expect(errorBeneficioPredio({ ...INAF, anioHasta: 2026 }, corta)).toBeNull();
    expect(cubre({ anioDesde: 2026, anioHasta: null }, { anioDesde: 2025, anioHasta: null })).toBe(false);
  });

  it('la exoneración lleva su %, y la deducción no es del predio', () => {
    expect(errorBeneficioPredio({ ...INAF, regimen: 'EXONERACION', porcentaje: 50 }, [])).toBeNull();
    expect(errorBeneficioPredio({ ...INAF, regimen: 'INAFECTACION', porcentaje: 50 }, [])).toMatch(/100%/);
    expect(errorBeneficioPredio({ ...INAF, regimen: 'DEDUCCION' }, [])).toMatch(/no es una inafectación/);
  });
});

describe('maestro (R01, R05)', () => {
  it('linderos: metros mayores que 0', () => {
    expect(errorLinderos([{ lado: 'Frente', metros: 0, colindante: null }])).toMatch(/frente/);
    expect(errorLinderos([{ lado: 'Fondo', metros: 12.5, colindante: 'LOTE 8' }, { lado: 'Derecha', metros: null, colindante: 'CALLE' }])).toBeNull();
  });

  it('condición por defecto: único, condominio o sucesión', () => {
    expect(condicionPorDefecto(1, false)).toBe('PROPIETARIO_UNICO');
    expect(condicionPorDefecto(2, false)).toBe('CONDOMINIO');
    expect(condicionPorDefecto(1, true)).toBe('SUCESION_INDIVISA');
  });
});
