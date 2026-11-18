import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GrupoCatalogo, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { GRUPOS, REGLAS_MUNI, errorValorRegla, validarAtributos } from './catalogos.reglas.js';
import { ActualizarCatalogoDto, CrearCatalogoDto, GuardarReglaDto, ListarCatalogoDto } from './dto/catalogo.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

const SELECT_ITEM = {
  id: true,
  grupo: true,
  codigo: true,
  nombre: true,
  abreviatura: true,
  padreId: true,
  padre: { select: { id: true, codigo: true, nombre: true } },
  atributos: true,
  orden: true,
  activo: true,
  sistema: true,
  ordenanza: true,
  updatedAt: true,
} satisfies Prisma.CatalogoSelect;

export type ItemCatalogo = Prisma.CatalogoGetPayload<{ select: typeof SELECT_ITEM }>;

// Catálogos con código y reglas por muni (specs/rentas-nucleo-v2.md, Fase 0). Sin borrado:
// un ítem que ya no se usa se desactiva; los registros viejos conservan su código.
@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  grupos() {
    return Object.entries(GRUPOS).map(([grupo, def]) => ({ grupo, ...def }));
  }

  listar(dto: ListarCatalogoDto) {
    return this.prisma.catalogo.findMany({
      where: { ...(dto.grupo ? { grupo: dto.grupo } : {}), ...(dto.incluirInactivos === 'true' ? {} : { activo: true }) },
      select: SELECT_ITEM,
      orderBy: [{ grupo: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crear(dto: CrearCatalogoDto) {
    const atributos = this.atributos(dto.grupo, dto.atributos);
    const abreviatura = this.abreviatura(dto.grupo, dto.abreviatura);
    const padreId = await this.padre(dto.grupo, dto.padreId ?? null);
    try {
      return await this.prisma.catalogo.create({
        data: {
          grupo: dto.grupo,
          codigo: dto.codigo,
          nombre: dto.nombre.trim(),
          abreviatura,
          padreId,
          atributos: atributos ?? Prisma.DbNull,
          orden: dto.orden ?? (await this.siguienteOrden(dto.grupo)),
          ordenanza: dto.ordenanza?.trim() || null,
          activo: dto.activo ?? true,
        },
        select: SELECT_ITEM,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Ya existe el código ${dto.codigo} en este catálogo`);
      }
      throw e;
    }
  }

  async actualizar(id: number, dto: ActualizarCatalogoDto) {
    const actual = await this.prisma.catalogo.findUnique({ where: { id }, select: { grupo: true, sistema: true } });
    if (!actual) throw new NotFoundException('El ítem del catálogo no existe');
    if (actual.sistema && dto.activo === false) {
      throw new ConflictException('El sistema usa este ítem: se puede renombrar, pero no desactivar');
    }
    const data: Prisma.CatalogoUncheckedUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
    if (dto.abreviatura !== undefined) data.abreviatura = this.abreviatura(actual.grupo, dto.abreviatura);
    if (dto.padreId !== undefined) data.padreId = await this.padre(actual.grupo, dto.padreId, id);
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.atributos !== undefined) data.atributos = this.atributos(actual.grupo, dto.atributos) ?? Prisma.DbNull;
    if (dto.ordenanza !== undefined) data.ordenanza = dto.ordenanza?.trim() || null;
    if (dto.activo !== undefined) data.activo = dto.activo;
    return this.prisma.catalogo.update({ where: { id }, data, select: SELECT_ITEM });
  }

  // Para los otros módulos: cada código debe existir y estar activo en el catálogo.
  // `vigentes` permite conservar un código que el registro ya tenía aunque luego se desactivara.
  async asegurarCodigos(db: Db, grupo: GrupoCatalogo, codigos: string[], etiqueta: string, vigentes: string[] = []) {
    const pedidos = [...new Set(codigos.filter(Boolean))];
    if (pedidos.length === 0) return new Map<string, ItemCatalogo>();
    const items = await db.catalogo.findMany({ where: { grupo, codigo: { in: pedidos } }, select: SELECT_ITEM });
    const porCodigo = new Map(items.map((i) => [i.codigo, i]));
    const malo = pedidos.find((c) => {
      const item = porCodigo.get(c);
      return !item || (!item.activo && !vigentes.includes(c));
    });
    if (malo) throw new BadRequestException(`${etiqueta} no válido: ${malo}`);
    return porCodigo;
  }

  // ---- ReglaMuni ----

  async reglas() {
    const guardadas = await this.prisma.reglaMuni.findMany();
    const porClave = new Map(guardadas.map((r) => [r.clave, r]));
    return Object.entries(REGLAS_MUNI).map(([clave, def]) => {
      const r = porClave.get(clave);
      return {
        clave,
        regla: def.regla,
        descripcion: def.descripcion,
        def: def.def,
        valor: r ? r.valor : def.defecto,
        defecto: def.defecto,
        ordenanza: r?.ordenanza ?? null,
        guardada: Boolean(r),
        updatedAt: r?.updatedAt ?? null,
      };
    });
  }

  // Valor vigente de una regla en esta base; si la muni nunca la guardó, el nacional.
  async valorRegla<T>(clave: keyof typeof REGLAS_MUNI & string, db: Db = this.prisma): Promise<T> {
    const def = REGLAS_MUNI[clave];
    if (!def) throw new Error(`ReglaMuni desconocida: ${clave}`);
    const r = await db.reglaMuni.findUnique({ where: { clave }, select: { valor: true } });
    return (r ? r.valor : def.defecto) as T;
  }

  async guardarRegla(clave: string, dto: GuardarReglaDto) {
    const def = REGLAS_MUNI[clave];
    if (!def) throw new NotFoundException('La regla no existe');
    const error = errorValorRegla(clave, dto.valor);
    if (error) throw new BadRequestException(error);
    if (def.def.tipo === 'codigos') {
      await this.asegurarCodigos(this.prisma, def.def.grupo, dto.valor as string[], 'Código');
    }
    const valor = dto.valor as Prisma.InputJsonValue;
    const ordenanza = dto.ordenanza?.trim() || null;
    await this.prisma.reglaMuni.upsert({
      where: { clave },
      create: { clave, valor, ordenanza, descripcion: def.descripcion, regla: def.regla },
      update: { valor, ordenanza },
    });
    return (await this.reglas()).find((r) => r.clave === clave);
  }

  // ---- auxiliares ----

  private atributos(grupo: GrupoCatalogo, entrada: unknown) {
    const r = validarAtributos(grupo, entrada);
    if ('error' in r) throw new BadRequestException(r.error);
    return r.atributos;
  }

  private abreviatura(grupo: GrupoCatalogo, valor?: string | null) {
    const limpia = valor?.trim() || null;
    if (!limpia && GRUPOS[grupo].abreviatura === 'requerida') {
      throw new BadRequestException('Este catálogo exige abreviatura');
    }
    return limpia;
  }

  // El padre debe ser un ítem del grupo padre (p. ej. un sub-uso cuelga de un uso).
  private async padre(grupo: GrupoCatalogo, padreId: number | null, propioId?: number) {
    const grupoPadre = GRUPOS[grupo].padre;
    if (!grupoPadre) {
      if (padreId) throw new BadRequestException('Este catálogo no lleva ítem padre');
      return null;
    }
    if (!padreId) throw new BadRequestException(`Elige el ítem de "${GRUPOS[grupoPadre].nombre}" del que depende`);
    if (padreId === propioId) throw new BadRequestException('Un ítem no puede depender de sí mismo');
    const padre = await this.prisma.catalogo.findUnique({ where: { id: padreId }, select: { grupo: true } });
    if (padre?.grupo !== grupoPadre) throw new BadRequestException(`El padre debe ser de "${GRUPOS[grupoPadre].nombre}"`);
    return padreId;
  }

  private async siguienteOrden(grupo: GrupoCatalogo) {
    const max = await this.prisma.catalogo.aggregate({ where: { grupo }, _max: { orden: true } });
    return (max._max.orden ?? 0) + 1;
  }
}
