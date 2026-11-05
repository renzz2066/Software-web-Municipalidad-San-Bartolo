import { EstadoValor } from '@prisma/client';
import { idsUnicos, motivoNoAsignable, motivoNoRecibible, siguienteExpediente } from './coactiva.reglas.js';

const transferido = { estado: EstadoValor.COACTIVO, transferenciaId: 7, expedientes: 0, cuotasCoactivo: 2 };

describe('motivoNoRecibible — solo valores transferidos por Rentas', () => {
  it('acepta COACTIVO con transferenciaId, sin expediente y con cuotas en coactiva', () => {
    expect(motivoNoRecibible(transferido)).toBeNull();
  });

  it.each([EstadoValor.CANCELADO, EstadoValor.ANULADO, EstadoValor.EMITIDO, EstadoValor.NOTIFICADO])(
    'rechaza %s (nunca se manda a coactiva deuda pagada, anulada o no transferida)',
    (estado) => {
      expect(motivoNoRecibible({ ...transferido, estado })).toBe('noTransferido');
    },
  );

  it('rechaza COACTIVO sin transferenciaId (no pasó por el memorándum de Rentas)', () => {
    expect(motivoNoRecibible({ ...transferido, transferenciaId: null })).toBe('noTransferido');
  });

  it('rechaza el valor que ya tiene expediente, aunque haya cambiado de estado', () => {
    expect(motivoNoRecibible({ ...transferido, expedientes: 1 })).toBe('yaRecibido');
    expect(motivoNoRecibible({ ...transferido, estado: EstadoValor.CANCELADO, expedientes: 1 })).toBe('yaRecibido');
  });

  it('rechaza el valor sin cuotas en coactiva (pagadas o fraccionadas tras la transferencia)', () => {
    expect(motivoNoRecibible({ ...transferido, cuotasCoactivo: 0 })).toBe('sinDeudaCoactiva');
  });
});

describe('motivoNoAsignable', () => {
  it('acepta un valor recibido y aún en coactiva', () => {
    expect(motivoNoAsignable({ estado: EstadoValor.COACTIVO, expedientes: 1 })).toBeNull();
  });

  it('rechaza inexistente, no recibido o que ya salió de coactiva', () => {
    expect(motivoNoAsignable(null)).toMatch(/no encontrado/);
    expect(motivoNoAsignable({ estado: EstadoValor.COACTIVO, expedientes: 0 })).toMatch(/no fue recibido/);
    expect(motivoNoAsignable({ estado: EstadoValor.CANCELADO, expedientes: 1 })).toMatch(/ya no está/);
  });
});

describe('siguienteExpediente', () => {
  it('empieza en 000001 y continúa el último número del año', () => {
    expect(siguienteExpediente(null)).toBe('000001');
    expect(siguienteExpediente(undefined)).toBe('000001');
    expect(siguienteExpediente('000041')).toBe('000042');
    expect(siguienteExpediente('999999')).toBe('1000000');
  });

  it('un número no numérico no rompe la secuencia', () => {
    expect(siguienteExpediente('ABC')).toBe('000001');
  });
});

describe('idsUnicos', () => {
  it('quita repetidos y conserva el orden', () => {
    expect(idsUnicos([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
    expect(idsUnicos([])).toEqual([]);
  });
});
