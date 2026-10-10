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

  private async codigosDeUsuario(usuarioId: number): Promise<Set<string>> {
    const accesos = await this.prisma.rolNivel.findMany({
      where: { rol: { usuarios: { some: { id: usuarioId } } } },
      select: { nivel: { select: { codigo: true } } },
    });
    return new Set(accesos.map((a) => a.nivel.codigo));
  }

  // Códigos asignados al rol del usuario (para gating del frontend)
  misAccesos(usuarioId: number) {
    return this.codigosDeUsuario(usuarioId).then((set) => [...set]);
  }

  // Lista jerárquica MODULO -> FUNCIONALIDAD con flag de habilitación
  // según los accesos reales del rol en sesión.
  async findAll(usuarioId: number) {
    const asignados = await this.codigosDeUsuario(usuarioId);
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
      habilitado: asignados.has(m.codigo),
      subniveles: m.hijos.map((h) => ({ ...h, habilitado: asignados.has(h.codigo) })),
    }));
  }

  // Registra/actualiza en BD los nodos del catálogo (idempotente).
  // Padres primero: el catálogo ya viene ordenado.
  // Además otorga todo el catálogo al rol ADMIN.
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

    const admin = await this.prisma.rol.findUnique({ where: { nombre: 'ADMIN' } });
    if (admin) {
      await this.prisma.rolNivel.createMany({
        data: [...idsPorCodigo.values()].map((nivelId) => ({ rolId: admin.id, nivelId })),
        skipDuplicates: true,
      });
    }

    return { sincronizados: idsPorCodigo.size };
  }
}
