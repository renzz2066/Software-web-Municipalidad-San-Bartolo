import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';

const PASSWORD = 'Secreta#2026';

function crear(usuario: unknown) {
  const usersService = {
    findByUsuario: vi.fn().mockResolvedValue(usuario),
    accesosDeUsuario: vi.fn().mockResolvedValue(['accesibilidad']),
  };
  const jwtService = { signAsync: vi.fn().mockResolvedValue('token') };
  const auditoria = { registrarSesion: vi.fn().mockResolvedValue(undefined) };
  const service = new AuthService(usersService as any, jwtService as any, auditoria as any);
  return { service, auditoria };
}

async function usuarioBase(cambios: Record<string, unknown> = {}) {
  return {
    id: 7,
    usuario: 'jperez',
    nombres: 'Juan',
    apellidos: 'Pérez',
    password: await bcrypt.hash(PASSWORD, 4),
    activo: true,
    rol: { nombre: 'CAJERO', activo: true },
    ...cambios,
  };
}

// Ningún argumento enviado a auditoría contiene la contraseña ni su hash
function sinPassword(auditoria: { registrarSesion: ReturnType<typeof vi.fn> }, hash?: string) {
  const enviado = JSON.stringify(auditoria.registrarSesion.mock.calls);
  expect(enviado).not.toContain(PASSWORD);
  if (hash) expect(enviado).not.toContain(hash);
}

describe('AuthService.login — auditoría', () => {
  it('login exitoso registra LOGIN con el usuario', async () => {
    const usuario = await usuarioBase();
    const { service, auditoria } = crear(usuario);

    const res = await service.login('jperez', PASSWORD);

    expect(res.accessToken).toBe('token');
    expect(auditoria.registrarSesion).toHaveBeenCalledWith({
      accion: 'LOGIN',
      usuarioId: 7,
      usuarioNombre: 'jperez',
      registroId: 7,
    });
    sinPassword(auditoria, usuario.password);
  });

  it('contraseña incorrecta registra LOGIN_FALLIDO sin actor ni contraseña', async () => {
    const usuario = await usuarioBase();
    const { service, auditoria } = crear(usuario);

    await expect(service.login('jperez', 'otra-clave')).rejects.toBeInstanceOf(UnauthorizedException);

    expect(auditoria.registrarSesion).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'LOGIN_FALLIDO', usuarioId: null, usuarioNombre: 'jperez', registroId: 7, motivo: 'PASSWORD' }),
    );
    expect(JSON.stringify(auditoria.registrarSesion.mock.calls)).not.toContain('otra-clave');
    sinPassword(auditoria, usuario.password);
  });

  it('usuario inexistente registra el usuario intentado', async () => {
    const { service, auditoria } = crear(null);

    await expect(service.login('noexiste', PASSWORD)).rejects.toBeInstanceOf(UnauthorizedException);

    expect(auditoria.registrarSesion).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'LOGIN_FALLIDO', usuarioNombre: 'noexiste', registroId: null, motivo: 'NO_EXISTE' }),
    );
    sinPassword(auditoria);
  });

  it.each([
    ['usuario inactivo', { activo: false }],
    ['rol inactivo', { rol: { nombre: 'CAJERO', activo: false } }],
  ])('%s: 401 y LOGIN_FALLIDO motivo INACTIVO, aun con contraseña correcta', async (_caso, cambios) => {
    const { service, auditoria } = crear(await usuarioBase(cambios));

    await expect(service.login('jperez', PASSWORD)).rejects.toThrow('Usuario o contraseña incorrectos');

    expect(auditoria.registrarSesion).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'LOGIN_FALLIDO', motivo: 'INACTIVO' }),
    );
    expect(auditoria.registrarSesion).not.toHaveBeenCalledWith(expect.objectContaining({ accion: 'LOGIN' }));
  });

  it('logout registra LOGOUT', async () => {
    const { service, auditoria } = crear(null);

    await service.logout({ id: 7, usuario: 'jperez', rol: 'CAJERO', niveles: [] });

    expect(auditoria.registrarSesion).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'LOGOUT', usuarioId: 7, usuarioNombre: 'jperez' }),
    );
  });
});
