import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// specs/multi-muni-v1.md criterio 3: un token solo vale en la muni que lo emitió.
function crear(payload: Record<string, unknown> | Error, muniActual = 'sanbartolo') {
  const jwtService = {
    verifyAsync: payload instanceof Error ? vi.fn().mockRejectedValue(payload) : vi.fn().mockResolvedValue(payload),
  };
  const munis = { actual: () => ({ slug: muniActual }) };
  const guard = new JwtAuthGuard(jwtService as any, munis as any);
  const request: Record<string, any> = { headers: { authorization: 'Bearer abc' } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
  return { guard, context, request };
}

const base = { sub: 1, usuario: 'admin', rol: 'ADMIN', niveles: ['accesibilidad'] };

describe('JwtAuthGuard — multi-muni', () => {
  it('acepta el token de la misma muni y fija el usuario', async () => {
    const { guard, context, request } = crear({ ...base, muni: 'sanbartolo' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 1, usuario: 'admin', rol: 'ADMIN', niveles: ['accesibilidad'] });
  });

  it('rechaza con 401 un token emitido en otra muni', async () => {
    const { guard, context, request } = crear({ ...base, muni: 'demo' });

    await expect(guard.canActivate(context)).rejects.toThrow('otra municipalidad');
    expect(request.user).toBeUndefined();
  });

  it('rechaza con 401 un token anterior a multi-muni (sin muni)', async () => {
    const { guard, context } = crear(base);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token inválido sigue respondiendo 401 genérico', async () => {
    const { guard, context } = crear(new Error('jwt malformed'));

    await expect(guard.canActivate(context)).rejects.toThrow('Token inválido o expirado');
  });
});
