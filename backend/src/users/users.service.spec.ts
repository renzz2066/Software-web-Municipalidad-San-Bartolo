import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service.js';

function crear(usuario: unknown, otrosAdmins = 1) {
  const prisma = {
    usuario: {
      findUnique: vi.fn().mockResolvedValue(usuario),
      count: vi.fn().mockResolvedValue(otrosAdmins),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
    },
  };
  return { service: new UsersService(prisma as any), prisma };
}

const cajero = { id: 5, activo: true, rol: { nombre: 'CAJERO' } };
const admin = { id: 5, activo: true, rol: { nombre: 'ADMIN' } };

describe('UsersService.remove — baja lógica', () => {
  it('desactiva (activo=false) y nunca borra', async () => {
    const { service, prisma } = crear(cajero);

    await service.remove(5, 1);

    expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { activo: false } });
    expect(prisma.usuario.delete).not.toHaveBeenCalled();
  });

  it('no permite desactivarse a sí mismo', async () => {
    const { service, prisma } = crear(cajero);
    await expect(service.remove(5, 5)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('no permite desactivar al último ADMIN activo', async () => {
    const { service, prisma } = crear(admin, 0);
    await expect(service.remove(5, 1)).rejects.toThrow('último ADMIN');
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('PATCH activo=false aplica las mismas reglas', async () => {
    const { service } = crear(admin, 0);
    await expect(service.update(5, { activo: false }, 1)).rejects.toThrow('último ADMIN');
  });

  it('ya inactivo: no hace nada (idempotente)', async () => {
    const { service, prisma } = crear({ ...cajero, activo: false });
    await service.remove(5, 1);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });
});
