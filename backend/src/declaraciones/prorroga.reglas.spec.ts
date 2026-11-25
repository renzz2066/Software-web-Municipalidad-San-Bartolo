import { describe, expect, it } from 'vitest';
import { errorAnularProrroga, errorRegistrarProrroga, errorResolverProrroga } from './prorroga.reglas.js';

const HOY = '2026-02-20';
const BASE = { general: false, anio: 2026, fechaLimite: '2026-03-31', fechaSolicitud: '2026-02-15' };

describe('J16: registrar una prórroga', () => {
  it('individual la registra cualquiera con el nivel; general solo un supervisor', () => {
    expect(errorRegistrarProrroga(BASE, 'CAJERO', HOY, true)).toBeNull();
    expect(errorRegistrarProrroga({ ...BASE, general: true }, 'CAJERO', HOY, true)).toMatch(/supervisor/);
    expect(errorRegistrarProrroga({ ...BASE, general: true }, 'SUPERVISOR', HOY, true)).toBeNull();
  });

  it('respeta la regla de la muni y las fechas', () => {
    expect(errorRegistrarProrroga(BASE, 'ADMIN', HOY, false)).toMatch(/dj.prorrogaPresentacion/);
    expect(errorRegistrarProrroga({ ...BASE, fechaSolicitud: '2026-02-21' }, 'ADMIN', HOY, true)).toMatch(/futura/);
    expect(errorRegistrarProrroga({ ...BASE, fechaLimite: '2026-02-15' }, 'ADMIN', HOY, true)).toMatch(/posterior/);
    expect(errorRegistrarProrroga({ ...BASE, fechaLimite: '2028-01-10' }, 'ADMIN', HOY, true)).toMatch(/2026 o 2027/);
  });
});

describe('J16/J17: resolver y anular', () => {
  const sup = { id: 2, rol: 'SUPERVISOR' };

  it('la resuelve un supervisor distinto de quien la registró, con justificación', () => {
    expect(errorResolverProrroga({ estado: 'SOLICITADA', creadoPorId: 1 }, sup, 'Sustento verificado en mesa de partes')).toBeNull();
    expect(errorResolverProrroga({ estado: 'SOLICITADA', creadoPorId: 2 }, sup, 'Sustento verificado en mesa de partes')).toMatch(/otro supervisor/);
    expect(errorResolverProrroga({ estado: 'SOLICITADA', creadoPorId: 1 }, { id: 3, rol: 'CAJERO' }, 'Sustento verificado')).toMatch(/supervisor/);
    expect(errorResolverProrroga({ estado: 'APROBADA', creadoPorId: 1 }, sup, 'Sustento verificado en mesa de partes')).toMatch(/solicitada/);
    expect(errorResolverProrroga({ estado: 'SOLICITADA', creadoPorId: 1 }, sup, 'corta')).toMatch(/mínimo/);
  });

  it('se anula con motivo; una rechazada o anulada no', () => {
    expect(errorAnularProrroga('APROBADA', 'ADMIN', 'Ordenanza derogada por el concejo')).toBeNull();
    expect(errorAnularProrroga('RECHAZADA', 'ADMIN', 'Ordenanza derogada por el concejo')).toMatch(/rechazada/);
    expect(errorAnularProrroga('ANULADA', 'ADMIN', 'Ordenanza derogada por el concejo')).toMatch(/ya está anulada/);
    expect(errorAnularProrroga('APROBADA', 'CAJERO', 'Ordenanza derogada por el concejo')).toMatch(/supervisor/);
  });
});
