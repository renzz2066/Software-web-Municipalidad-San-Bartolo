import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NIVELES_CATALOGO } from './niveles.catalogo.js';

export interface ArbolFila {
  modId: number;
  modCodigo: string;
  modNombre: string;
  modDesc: string | null;
  modOrden: number;
  modHab: boolean;
  hId: number | null;
  hCodigo: string | null;
  hNombre: string | null;
  hDesc: string | null;
  hOrden: number | null;
  hHab: boolean | null;
}

export interface MatrizFila {
  kind: 'rol' | 'nivel' | 'acceso';
  id: number | null;
  nombre: string | null;
  descripcion: string | null;
  codigo: string | null;
  tipo: string | null;
  padreId: number | null;
  orden: number | null;
  refId: number | null;
}

export interface RolPub {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface SubnivelPub {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  habilitado: boolean;
}

export interface ModuloPub extends SubnivelPub {
  subniveles: SubnivelPub[];
}

export interface NivelBase {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  padreId: number | null;
}

export interface ModuloMatriz extends Omit<NivelBase, 'padreId'> {
  subniveles: Omit<NivelBase, 'padreId'>[];
}

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

  // Matriz unificada para Accesos por Roles en UN solo viaje (UNION):
  // roles + módulos con subniveles + accesos del rol seleccionado.
  async matriz(rolId?: number): Promise<{
    roles: RolPub[];
    modulos: ModuloMatriz[];
    seleccion: { rolId: number; nivelIds: number[] } | null;
  }> {
    const filas = await this.prisma.$queryRaw<MatrizFila[]>`
      SELECT 'rol' AS kind, r.id AS id, r.nombre AS nombre, r.descripcion AS descripcion,
             NULL::text AS codigo, NULL::text AS tipo, NULL::integer AS "padreId",
             NULL::integer AS orden, NULL::integer AS "refId"
      FROM roles r
      UNION ALL
      SELECT 'nivel', n.id, n.nombre, n.descripcion,
             n.codigo, n.tipo::text, n."padreId", n.orden, NULL
      FROM niveles n
      UNION ALL
      SELECT 'acceso', a."nivelId", NULL, NULL, NULL, NULL, NULL, NULL, a."rolId"
      FROM rol_nivel a
    `;

    const roles: RolPub[] = filas
      .filter((f) => f.kind === 'rol')
      .map((f) => ({ id: f.id as number, nombre: f.nombre as string, descripcion: f.descripcion }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const niveles: NivelBase[] = filas
      .filter((f) => f.kind === 'nivel')
      .map((f) => ({
        id: f.id as number,
        codigo: f.codigo as string,
        nombre: f.nombre as string,
        descripcion: f.descripcion,
        orden: f.orden as number,
        padreId: f.padreId,
      }));
    const modulos: ModuloMatriz[] = niveles
      .filter((n) => n.padreId === null)
      .sort((a, b) => a.orden - b.orden)
      .map((m) => ({
        id: m.id,
        codigo: m.codigo,
        nombre: m.nombre,
        descripcion: m.descripcion,
        orden: m.orden,
        subniveles: niveles
          .filter((h) => h.padreId === m.id)
          .sort((a, b) => a.orden - b.orden)
          .map((h) => ({
            id: h.id,
            codigo: h.codigo,
            nombre: h.nombre,
            descripcion: h.descripcion,
            orden: h.orden,
          })),
      }));

    const selId = rolId ?? roles[0]?.id ?? null;
    if (selId === null) {
      return { roles, modulos, seleccion: null };
    }
    if (!roles.some((r) => r.id === selId)) {
      throw new NotFoundException('El rol no existe');
    }
    const nivelIds = filas
      .filter((f) => f.kind === 'acceso' && f.refId === selId)
      .map((f) => f.id as number);
    return { roles, modulos, seleccion: { rolId: selId, nivelIds } };
  }

  // Lista jerárquica MODULO -> FUNCIONALIDAD con flag de habilitación
  // según los accesos reales del rol en sesión. UNA sola consulta.
  async findAll(usuarioId: number): Promise<ModuloPub[]> {
    const filas = await this.prisma.$queryRaw<ArbolFila[]>`
      SELECT m.id AS "modId", m.codigo AS "modCodigo", m.nombre AS "modNombre",
             m.descripcion AS "modDesc", m.orden AS "modOrden",
             (am."nivelId" IS NOT NULL) AS "modHab",
             h.id AS "hId", h.codigo AS "hCodigo", h.nombre AS "hNombre",
             h.descripcion AS "hDesc", h.orden AS "hOrden",
             (ah."nivelId" IS NOT NULL) AS "hHab"
      FROM niveles m
      LEFT JOIN niveles h ON h."padreId" = m.id
      LEFT JOIN rol_nivel am ON am."nivelId" = m.id
        AND am."rolId" = (SELECT "rolId" FROM usuarios WHERE id = ${usuarioId})
      LEFT JOIN rol_nivel ah ON ah."nivelId" = h.id
        AND ah."rolId" = (SELECT "rolId" FROM usuarios WHERE id = ${usuarioId})
      WHERE m.tipo = 'MODULO'
      ORDER BY m.orden ASC, h.orden ASC
    `;
    const porModulo = new Map<number, ModuloPub>();
    for (const f of filas) {
      let mod = porModulo.get(f.modId);
      if (!mod) {
        mod = {
          id: f.modId,
          codigo: f.modCodigo,
          nombre: f.modNombre,
          descripcion: f.modDesc,
          orden: f.modOrden,
          habilitado: f.modHab,
          subniveles: [],
        };
        porModulo.set(f.modId, mod);
      }
      if (f.hId !== null) {
        mod.subniveles.push({
          id: f.hId,
          codigo: f.hCodigo as string,
          nombre: f.hNombre as string,
          descripcion: f.hDesc,
          orden: f.hOrden as number,
          habilitado: f.hHab as boolean,
        });
      }
    }
    return [...porModulo.values()];
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
