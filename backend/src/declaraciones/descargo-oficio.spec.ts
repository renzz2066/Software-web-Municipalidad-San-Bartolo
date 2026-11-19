import { describe, expect, it, vi } from 'vitest';
import { afectacionDescargo, necesitaDescargo, subMotivoDescargo } from './descargo-oficio.js';

describe('descargo de oficio del transferente (Fase 7)', () => {
  it('el sub-motivo sigue al de la adquisición si existe', () => {
    const t = new Set(['T_COMPRAVENTA', 'T_DONACION']);
    expect(subMotivoDescargo('A_COMPRAVENTA', t)).toBe('T_COMPRAVENTA');
    expect(subMotivoDescargo('A_REMATE', t)).toBeNull();
    expect(subMotivoDescargo(null, t)).toBeNull();
  });

  it('J10/J11: deja de pagar el predial desde el año siguiente y los arbitrios según la regla', () => {
    expect(afectacionDescargo('2023-05-10', '2026-11-18', 'MES_SIGUIENTE')).toEqual({ anioAfectacion: 2024, fechaArbitrios: '2023-06-01' });
    expect(afectacionDescargo('2023-12-20', '2026-11-18', 'MES_SIGUIENTE')).toEqual({ anioAfectacion: 2024, fechaArbitrios: '2024-01-01' });
  });

  const tx = (propio: number, determinaciones: number, arbitrios: number) =>
    ({
      djAnexo: { count: vi.fn().mockResolvedValue(propio) },
      determinacion: { count: vi.fn().mockResolvedValue(determinaciones) },
      cuentaCorriente: { count: vi.fn().mockResolvedValue(arbitrios) },
    }) as never;

  it('solo si tiene cuenta posterior del predio y no presentó su propio descargo', async () => {
    expect(await necesitaDescargo(tx(0, 2, 0), 7, 1, '2023-05-10')).toBe(true);
    expect(await necesitaDescargo(tx(0, 0, 3), 7, 1, '2023-05-10')).toBe(true);
    expect(await necesitaDescargo(tx(0, 0, 0), 7, 1, '2023-05-10')).toBe(false);
    expect(await necesitaDescargo(tx(1, 2, 3), 7, 1, '2023-05-10')).toBe(false);
  });
});
