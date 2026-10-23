import { describe, expect, it } from 'vitest';
import { esHabil, fechaExigible, siguienteHabil, sumarHabiles } from './plazos.js';

const sinFeriados = new Set<string>();

describe('plazos en días hábiles', () => {
  it('sábado, domingo y feriado no son hábiles', () => {
    expect(esHabil('2026-10-23', sinFeriados)).toBe(true); // viernes
    expect(esHabil('2026-10-24', sinFeriados)).toBe(false); // sábado
    expect(esHabil('2026-10-25', sinFeriados)).toBe(false); // domingo
    expect(esHabil('2026-12-25', new Set(['2026-12-25']))).toBe(false);
  });

  it('el siguiente hábil de un viernes es el lunes', () => {
    expect(siguienteHabil('2026-10-23', sinFeriados)).toBe('2026-10-26');
  });

  it('cuenta 20 hábiles desde el día siguiente saltando fines de semana', () => {
    // Notificada el lunes 2026-10-05: día 1 = martes 06, día 20 = lunes 02-nov.
    expect(sumarHabiles('2026-10-05', 20, sinFeriados)).toBe('2026-11-02');
  });

  it('un feriado dentro del plazo lo corre un día', () => {
    expect(sumarHabiles('2026-10-05', 20, new Set(['2026-10-08']))).toBe('2026-11-03');
  });

  it('OP: exigible el hábil siguiente a la notificación', () => {
    expect(fechaExigible('OP', '2026-10-23', sinFeriados)).toBe('2026-10-26');
  });

  it('RD: exigible el hábil siguiente al día 20 del plazo de reclamo', () => {
    expect(fechaExigible('RD', '2026-10-05', sinFeriados)).toBe('2026-11-03');
  });

  it('RD notificada en fin de semana: el plazo empieza el lunes', () => {
    // Sábado 2026-10-24: día 1 = lunes 26, día 20 = viernes 20-nov; exigible lunes 23-nov.
    expect(fechaExigible('RD', '2026-10-24', sinFeriados)).toBe('2026-11-23');
  });
});
