// Triggers de auditoría contra PostgreSQL real (specs/auditoria-v1.md, D1).
// Todo corre dentro de una transacción que se revierte: no deja datos.
import { existsSync } from 'node:fs';
import { contextoAuditoria, type ContextoAuditoria } from '../src/auditoria/auditoria-contexto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

if (!process.env.DATABASE_URL && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const ROLLBACK = new Error('rollback');
const HASH = '$2b$10$hashDePruebaQueNoDebeAparecer';

interface FilaAuditoria {
  usuarioId: number | null;
  usuarioNombre: string | null;
  accion: string;
  registroId: string | null;
  modulo: string | null;
  ip: string | null;
  datosAntes: Record<string, unknown> | null;
  datosDespues: Record<string, unknown> | null;
  detalle: Record<string, unknown> | null;
}

describe('Auditoría por triggers (e2e)', () => {
  const prisma = new PrismaService();
  let admin: { id: number; rolId: number };

  beforeAll(async () => {
    await prisma.$connect();
    admin = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'admin' }, select: { id: true, rolId: true } });
  });

  afterAll(() => prisma.$disconnect());

  // Ejecuta fn en una tx del PrismaService (con su contexto) y la revierte
  async function enTxRevertida(ctx: ContextoAuditoria | null, fn: (tx: any) => Promise<void>) {
    const ejecutar = () =>
      prisma.$transaction(async (tx) => {
        await fn(tx);
        throw ROLLBACK;
      });
    await expect(ctx ? contextoAuditoria.run(ctx, ejecutar) : ejecutar()).rejects.toBe(ROLLBACK);
  }

  const filas = (tx: any, registroId: string): Promise<FilaAuditoria[]> =>
    tx.auditoria.findMany({
      where: { tabla: 'usuarios', registroId },
      orderBy: { id: 'asc' },
      omit: { id: true }, // BigInt no serializa a JSON
    });

  it('registra CREATE y UPDATE con solo los campos cambiados, sin password ni hash', async () => {
    const ctx: ContextoAuditoria = {
      usuarioId: admin.id,
      usuarioNombre: 'admin',
      modulo: 'accesibilidad.usuarios',
      ip: '10.0.0.5',
      userAgent: 'vitest',
    };
    await enTxRevertida(ctx, async (tx) => {
      const nuevo = await tx.usuario.create({
        data: { nombres: 'E2E', apellidos: 'Prueba', usuario: 'e2e_tmp', password: HASH, rolId: admin.rolId, creadoPorId: null },
      });
      await tx.usuario.update({ where: { id: nuevo.id }, data: { nombres: 'E2E2', password: `${HASH}x` } });
      await tx.usuario.update({ where: { id: nuevo.id }, data: { nombres: 'E2E2' } }); // sin cambios reales

      const [crear, editar, ...resto] = await filas(tx, String(nuevo.id));
      expect(resto).toHaveLength(0);
      expect(crear).toMatchObject({ accion: 'CREATE', usuarioId: admin.id, modulo: 'accesibilidad.usuarios', ip: '10.0.0.5' });
      expect(crear.datosDespues).not.toHaveProperty('password');
      expect(editar).toMatchObject({
        accion: 'UPDATE',
        datosAntes: { nombres: 'E2E' },
        datosDespues: { nombres: 'E2E2', password: '[CAMBIADO]' },
      });
      expect(JSON.stringify([crear, editar])).not.toContain('$2b$');

      // creadoPorId lo decide el servidor, no el dato enviado
      const fila = await tx.usuario.findUniqueOrThrow({ where: { id: nuevo.id } });
      expect(fila).toMatchObject({ creadoPorId: admin.id, modificadoPorId: admin.id });
    });
  });

  it('sin contexto (script/SQL directo) registra usuarioId null y el usuario de BD', async () => {
    await enTxRevertida(null, async (tx) => {
      await tx.$executeRaw`UPDATE usuarios SET apellidos = apellidos || ' (e2e)' WHERE id = ${admin.id}`;
      const ultima = (await filas(tx, String(admin.id))).at(-1);
      expect(ultima).toMatchObject({ accion: 'UPDATE', usuarioId: null });
      expect(ultima?.detalle).toHaveProperty('dbUsuario');
    });
  });

  // Si el trigger faltara, el ROLLBACK final igual evita perder datos
  it.each([
    ['UPDATE', `UPDATE auditoria SET tabla = 'x' WHERE id = (SELECT max(id) FROM auditoria)`],
    ['DELETE', `DELETE FROM auditoria WHERE id = (SELECT max(id) FROM auditoria)`],
    ['TRUNCATE', `TRUNCATE auditoria`],
  ])('bloquea %s sobre auditoria', async (_op, sql) => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.auditoria.create({ data: { accion: 'LOGIN', tabla: 'usuarios', usuarioNombre: 'e2e' } });
        await tx.$executeRawUnsafe(sql);
        throw ROLLBACK;
      }),
    ).rejects.toThrow(/solo de insercion/);
  });

  it('rechaza $transaction en forma batch (no puede fijar contexto)', () => {
    expect(() => prisma.$transaction([prisma.usuario.count()])).toThrow(/forma batch/);
  });
});
