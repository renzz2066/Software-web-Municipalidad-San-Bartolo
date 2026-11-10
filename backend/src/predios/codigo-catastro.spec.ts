import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { asegurarCodigoCatastroUnico } from './predios.service.js';

// Simula la BD con un predio que ya ocupa el código (id 8, como en los datos de prueba).
function txCon(ocupante: { id: number; codigoCatastro: string }) {
  const findFirst = vi.fn((args: { where: { codigoCatastro: string; NOT?: { id: number } } }) => {
    const ajeno = args.where.NOT?.id !== ocupante.id;
    return Promise.resolve(ocupante.codigoCatastro === args.where.codigoCatastro && ajeno ? { id: ocupante.id } : null);
  });
  return { tx: { predio: { findFirst } } as never, findFirst };
}

describe('asegurarCodigoCatastroUnico', () => {
  it('inscripción con un código ya usado: responde 409 con el código y el predio ocupante', async () => {
    const { tx } = txCon({ id: 8, codigoCatastro: '123456' });
    const e = await asegurarCodigoCatastroUnico(tx, '123456', null).catch((err: unknown) => err);
    expect(e).toBeInstanceOf(ConflictException);
    expect((e as ConflictException).message).toContain('123456');
    expect((e as ConflictException).message).toContain('predio #8');
  });

  it('al actualizar, el predio puede conservar su propio código (excluye su id en la búsqueda)', async () => {
    const { tx, findFirst } = txCon({ id: 8, codigoCatastro: '123456' });
    await expect(asegurarCodigoCatastroUnico(tx, '123456', 8)).resolves.toBeUndefined();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ NOT: { id: 8 } }) }));
  });

  it('al actualizar con un código de otro predio: responde 409', async () => {
    const { tx } = txCon({ id: 8, codigoCatastro: '123456' });
    await expect(asegurarCodigoCatastroUnico(tx, '123456', 9)).rejects.toBeInstanceOf(ConflictException);
  });

  it('sin código catastral no consulta la base', async () => {
    const { tx, findFirst } = txCon({ id: 8, codigoCatastro: '123456' });
    await expect(asegurarCodigoCatastroUnico(tx, null, null)).resolves.toBeUndefined();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('código libre: no lanza', async () => {
    const { tx } = txCon({ id: 8, codigoCatastro: '123456' });
    await expect(asegurarCodigoCatastroUnico(tx, '999AAA', null)).resolves.toBeUndefined();
  });
});
