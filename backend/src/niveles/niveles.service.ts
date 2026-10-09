import { Injectable } from '@nestjs/common';
import { TipoNivel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { NIVELES_CATALOGO } from './niveles.catalogo.js';

const subnivelPublico = {
  id: true,
  codigo: true,
  nombre: true,
  descripcion: true,
  orden: true,
} as const;

@Injectable()
export class NivelesService {
  constructor(private readonly prisma: PrismaService) {}

  // Lista jerárquica MODULO -> FUNCIONALIDAD con flag de habilitación
  // según el rol en sesión. Sin tabla rol_nivel (fase posterior),
  // solo ADMIN ve todo habilitado.
  async findAll(rolSesion: string) {
    const habilitado = rolSesion === 'ADMIN';
    const modulos = await this.prisma.nivel.findMany({
      where: { tipo: TipoNivel.MODULO },
      select: {
        ...subnivelPublico,
        hijos: { select: subnivelPublico, orderBy: { orden: 'asc' } },
      },
      orderBy: { orden: 'asc' },
    });
    return modulos.map((m) => ({
      ...m,
      habilitado,
      subniveles: m.hijos.map((h) => ({ ...h, habilitado })),
    }));
  }

  // Registra/actualiza en BD los nodos del catálogo (idempotente).
  // Padres primero: el catálogo ya viene ordenado.
  async sincronizar() {
    const idsPorCodigo = new Map<string, number>();
    for (const def of NIVELES_CATALOGO) {
      const padreId = def.padre ? idsPorCodigo.get(def.padre) : null;
      if (def.padre && padreId === undefined) {
        throw new Error(`Nivel padre no registrado: ${def.padre}`);
      }
      const nivel = await this.prisma.nivel.upsert({
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
    return { sincronizados: idsPorCodigo.size };
  }
}
