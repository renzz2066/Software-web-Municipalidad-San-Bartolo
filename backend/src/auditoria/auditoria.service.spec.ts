import { contextoAuditoria, contextoVacio } from './auditoria-contexto.js';
import { AuditoriaService, construirFiltro } from './auditoria.service.js';
import { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto.js';

function crear() {
  const prisma = {
    auditoria: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([{ id: 12n, accion: 'LOGIN' }]),
      count: vi.fn().mockResolvedValue(1),
    },
  };
  return { service: new AuditoriaService(prisma as any), prisma };
}

const filtro = (valores: Partial<FiltroAuditoriaDto>) => Object.assign(new FiltroAuditoriaDto(), valores);

describe('AuditoriaService.registrarSesion', () => {
  it('toma ip y userAgent del contexto del servidor y recorta el usuario a 50', async () => {
    const { service, prisma } = crear();

    await contextoAuditoria.run(contextoVacio('10.0.0.5', 'Mozilla/5.0'), () =>
      service.registrarSesion({ accion: 'LOGIN_FALLIDO', usuarioId: null, usuarioNombre: ` ${'x'.repeat(80)} `, motivo: 'NO_EXISTE' }),
    );

    const { data } = prisma.auditoria.create.mock.calls[0][0];
    expect(data).toMatchObject({ ip: '10.0.0.5', userAgent: 'Mozilla/5.0', tabla: 'usuarios', modulo: 'auth', registroId: null });
    expect(data.usuarioNombre).toHaveLength(50);
    expect(data.detalle).toEqual({ motivo: 'NO_EXISTE' });
    expect(data).not.toHaveProperty('createdAt'); // la fecha la pone PostgreSQL
  });

  it('fail-open: si la BD falla no lanza (el login no se cae)', async () => {
    const { service, prisma } = crear();
    prisma.auditoria.create.mockRejectedValueOnce(new Error('BD caída'));
    vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

    await expect(
      service.registrarSesion({ accion: 'LOGIN', usuarioId: 1, usuarioNombre: 'admin' }),
    ).resolves.toBeUndefined();
  });
});

describe('AuditoriaService.listar', () => {
  it('pagina y devuelve el id BigInt como string', async () => {
    const { service, prisma } = crear();

    const res = await service.listar(filtro({ page: 3, pageSize: 10, accion: 'LOGIN' }));

    expect(prisma.auditoria.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    expect(res).toEqual({ items: [{ id: '12', accion: 'LOGIN' }], total: 1, page: 3, pageSize: 10 });
    expect(() => JSON.stringify(res)).not.toThrow();
  });
});

describe('construirFiltro', () => {
  it('fechas solas cubren el día completo en hora de Lima', () => {
    const where = construirFiltro(filtro({ desde: '2026-10-01', hasta: '2026-10-19' }));
    expect(where.createdAt).toEqual({
      gte: new Date('2026-10-01T05:00:00.000Z'),
      lt: new Date('2026-10-20T05:00:00.000Z'),
    });
  });

  it('sin fechas no filtra por createdAt y pasa los demás filtros', () => {
    const where = construirFiltro(filtro({ usuarioId: 3, tabla: 'usuarios', registroId: '9' }));
    expect(where).toEqual({ usuarioId: 3, tabla: 'usuarios', accion: undefined, registroId: '9' });
  });
});
