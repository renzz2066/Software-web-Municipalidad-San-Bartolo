import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  console.log('Roles base y usuario admin verificados (usuario: admin / password: admin123)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
