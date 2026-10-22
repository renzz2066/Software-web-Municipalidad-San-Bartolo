import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { NIVELES_CATALOGO } from '../src/niveles/niveles.catalogo.js';

const prisma = new PrismaClient();

const ROLES_BASE = [{ nombre: 'ADMIN', descripcion: 'Acceso total al sistema' }];

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

  // Parámetros legales de Rentas (specs/rentas-nucleo-v1.md, Fase A). Aranceles, valores
  // unitarios y tarifas dependen de ordenanzas locales: se registran en Maestros, no aquí.
  const anio = 2026;
  await prisma.uit.upsert({
    where: { anio },
    update: {},
    create: { anio, valor: 5500, ordenanza: 'UIT 2026 (MEF)' },
  });
  const escala = [
    { tramo: 1, desdeUit: 0, hastaUit: 15, tasa: 0.2 },
    { tramo: 2, desdeUit: 15, hastaUit: 60, tasa: 0.6 },
    { tramo: 3, desdeUit: 60, hastaUit: null, tasa: 1 },
  ];
  for (const t of escala) {
    await prisma.escalaPredial.upsert({
      where: { anio_tramo: { anio, tramo: t.tramo } },
      update: {},
      create: { anio, ...t, ordenanza: 'D.L. 776 art. 13' },
    });
  }
  console.log(`UIT y escala predial ${anio} verificadas`);

  // Tributos que genera el cálculo (Fase D). Los códigos de arbitrios = conceptos de tarifas.
  const tributos = [
    { codigo: 'PREDIAL', nombre: 'IMPUESTO PREDIAL', tipo: 'PREDIAL' as const },
    { codigo: 'RESIDUOS', nombre: 'ARBITRIO RESIDUOS SÓLIDOS', tipo: 'ARBITRIOS' as const },
    { codigo: 'BARRIDO', nombre: 'ARBITRIO BARRIDO DE CALLES', tipo: 'ARBITRIOS' as const },
    { codigo: 'PARQUES', nombre: 'ARBITRIO PARQUES Y JARDINES', tipo: 'ARBITRIOS' as const },
    { codigo: 'SERENAZGO', nombre: 'ARBITRIO SERENAZGO', tipo: 'ARBITRIOS' as const },
  ];
  for (const t of tributos) {
    await prisma.tributo.upsert({ where: { codigo: t.codigo }, update: {}, create: t });
  }
  console.log('Tributos de rentas verificados');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
