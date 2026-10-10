import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { NIVELES_CATALOGO } from '../src/niveles/niveles.catalogo.js';

const prisma = new PrismaClient();

const ROLES_BASE = [
  { nombre: 'ADMIN', descripcion: 'Acceso total al sistema' },
  { nombre: 'SUPERVISOR', descripcion: 'Supervisión y consulta de operaciones' },
  { nombre: 'CAJERO', descripcion: 'Operación de caja y cobros' },
];

async function main() {
  for (const rol of ROLES_BASE) {
    await prisma.rol.upsert({
      where: { nombre: rol.nombre },
      update: { descripcion: rol.descripcion },
      create: rol,
    });
  }

  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.usuario.upsert({
    where: { usuario: 'admin' },
    update: {},
    create: {
      nombres: 'Administrador',
      apellidos: '',
      usuario: 'admin',
      password: passwordHash,
      rol: { connect: { nombre: 'ADMIN' } },
    },
  });

  // Niveles del sistema (idempotente: crea o actualiza por codigo)
  const idsPorCodigo = new Map<string, number>();
  for (const def of NIVELES_CATALOGO) {
    const padreId = def.padre ? (idsPorCodigo.get(def.padre) ?? null) : null;
    const nivel = await prisma.nivel.upsert({
      where: { codigo: def.codigo },
      update: {
        tipo: def.tipo,
        nombre: def.nombre,
        descripcion: def.descripcion ?? null,
        padreId,
        orden: def.orden ?? 0,
      },
      create: {
        codigo: def.codigo,
        tipo: def.tipo,
        nombre: def.nombre,
        descripcion: def.descripcion ?? null,
        padreId,
        orden: def.orden ?? 0,
      },
      select: { id: true, codigo: true },
    });
    idsPorCodigo.set(nivel.codigo, nivel.id);
  }

  console.log('Roles base y usuario admin verificados (usuario: admin / password: admin123)');
  console.log(`Niveles sincronizados: ${idsPorCodigo.size}`);

  // ADMIN con acceso total (data-driven, sin excepciones en código)
  const admin = await prisma.rol.findUnique({ where: { nombre: 'ADMIN' } });
  if (admin) {
    await prisma.rolNivel.createMany({
      data: [...idsPorCodigo.values()].map((nivelId) => ({ rolId: admin.id, nivelId })),
      skipDuplicates: true,
    });
    console.log('Accesos ADMIN verificados');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
