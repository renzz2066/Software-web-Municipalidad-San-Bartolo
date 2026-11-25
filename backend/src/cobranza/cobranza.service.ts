import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoGestionCobranza, Prisma, type PuntajeCobranza } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ErrorCsv, leerPuntajesCsv } from './cobranza.csv.js';
import { concentracionTop, motivoGestionInvalida } from './cobranza.reglas.js';
import type { CrearGestionDto, FiltroPuntajesDto, HistorialGestionDto } from './dto/cobranza.dto.js';

const MODELO_POR_DEFECTO = 'Random Forest (entrenado 2015-2023)';
const LOTE_INSERCION = 1000;
const MAX_EXPORTACION = 20000;

interface UltimaGestion {
  codigoLegacy: string;
  estado: EstadoGestionCobranza;
  createdAt: Date;
}

// Priorización de cobranza (specs/prediccion-cobranza-v1.md).
// Los puntajes los calcula el modelo de tesis en Python; aquí solo se importan y consultan.
@Injectable()
export class CobranzaService {
  constructor(private readonly prisma: PrismaService) {}

  // P2: un lote nuevo por import; el anterior del mismo año queda vigente=false (sin DELETE).
  async importar(contenido: unknown, archivo: string, modelo?: string) {
    if (typeof contenido !== 'string' || contenido.trim() === '') {
      throw new BadRequestException('Adjunta el archivo puntajes_AAAA.csv (tipo text/csv).');
    }
    let filas;
    try {
      filas = leerPuntajesCsv(contenido);
    } catch (error) {
      if (error instanceof ErrorCsv) throw new BadRequestException(error.message);
      throw error;
    }
    const anio = filas[0].anio;

    // P3: enlace por codigoLegacy (CODCLI de SIMUN)
    const fichas = await this.prisma.contribuyente.findMany({
      where: { codigoLegacy: { in: filas.map((f) => f.codigoLegacy) } },
      select: { id: true, codigoLegacy: true },
    });
    const idPorCodigo = new Map(fichas.map((c) => [c.codigoLegacy, c.id]));

    const lote = await this.prisma.$transaction(
      async (tx) => {
        await tx.cobranzaLote.updateMany({ where: { anio, vigente: true }, data: { vigente: false } });
        const creado = await tx.cobranzaLote.create({
          data: {
            anio,
            modelo: modelo?.trim() || MODELO_POR_DEFECTO,
            archivo: archivo.trim().slice(0, 120),
            filas: filas.length,
            enlazados: idPorCodigo.size,
          },
        });
        for (let i = 0; i < filas.length; i += LOTE_INSERCION) {
          await tx.puntajeCobranza.createMany({
            data: filas.slice(i, i + LOTE_INSERCION).map((f) => ({
              ...f,
              loteId: creado.id,
              contribuyenteId: idPorCodigo.get(f.codigoLegacy) ?? null,
            })),
          });
        }
        return creado;
      },
      { timeout: 60_000 },
    );

    return { loteId: lote.id, anio, filas: lote.filas, enlazados: lote.enlazados };
  }

  lotes() {
    return this.prisma.cobranzaLote.findMany({
      orderBy: [{ anio: 'desc' }, { createdAt: 'desc' }],
      include: { creadoPor: { select: { usuario: true, nombres: true, apellidos: true } } },
    });
  }

  /** Lote vigente del año pedido o, sin año, el del año más reciente. */
  private async loteVigente(anio?: number) {
    const lote = await this.prisma.cobranzaLote.findFirst({
      where: { vigente: true, ...(anio ? { anio } : {}) },
      orderBy: [{ anio: 'desc' }, { createdAt: 'desc' }],
      include: { creadoPor: { select: { usuario: true, nombres: true, apellidos: true } } },
    });
    return lote;
  }

  /** Último estado de gestión por CODCLI en un año (DISTINCT ON: uno por código). */
  private async ultimasGestiones(anio: number, codigos?: string[]): Promise<Map<string, UltimaGestion>> {
    if (codigos && codigos.length === 0) return new Map();
    const filtroCodigos = codigos ? Prisma.sql`AND "codigoLegacy" IN (${Prisma.join(codigos)})` : Prisma.empty;
    const filas = await this.prisma.$queryRaw<UltimaGestion[]>`
      SELECT DISTINCT ON ("codigoLegacy") "codigoLegacy", estado, "createdAt"
        FROM gestiones_cobranza
       WHERE anio = ${anio} ${filtroCodigos}
       ORDER BY "codigoLegacy", "createdAt" DESC, id DESC`;
    return new Map(filas.map((f) => [f.codigoLegacy, f]));
  }

  /**
   * P3: enlaza las filas sin ficha con los contribuyentes que se migraron después del import.
   * Devuelve cuántas filas del lote tienen ficha. Solo toca filas con contribuyenteId nulo.
   */
  private async enlazarPendientes(loteId: number): Promise<number> {
    await this.prisma.$executeRaw`
      UPDATE puntajes_cobranza p
         SET "contribuyenteId" = c.id
        FROM contribuyentes c
       WHERE p."loteId" = ${loteId}
         AND p."contribuyenteId" IS NULL
         AND c."codigoLegacy" = p."codigoLegacy"`;
    return this.prisma.puntajeCobranza.count({ where: { loteId, contribuyenteId: { not: null } } });
  }

  // P4
  async resumen(anio?: number) {
    const encontrado = await this.loteVigente(anio);
    if (!encontrado) return { lote: null };
    const lote = { ...encontrado, enlazados: await this.enlazarPendientes(encontrado.id) };

    const [porGrupo, porTramo, deudas, acciones, gestiones] = await Promise.all([
      this.prisma.puntajeCobranza.groupBy({
        by: ['grupo'],
        where: { loteId: lote.id },
        _count: { _all: true },
        _sum: { deudaEsperada: true, deudaAnio: true },
      }),
      this.prisma.puntajeCobranza.groupBy({
        by: ['tramo'],
        where: { loteId: lote.id },
        _count: { _all: true },
        _sum: { deudaEsperada: true },
      }),
      this.prisma.puntajeCobranza.findMany({
        where: { loteId: lote.id },
        orderBy: { prioridad: 'asc' },
        select: { deudaEsperada: true },
      }),
      this.prisma.puntajeCobranza.groupBy({
        by: ['accion'],
        where: { loteId: lote.id },
        _count: { _all: true },
        orderBy: { accion: 'asc' },
      }),
      this.ultimasGestiones(lote.anio),
    ]);

    const conteoEstados: Record<string, number> = {};
    for (const g of gestiones.values()) conteoEstados[g.estado] = (conteoEstados[g.estado] ?? 0) + 1;
    const montos = deudas.map((d) => Number(d.deudaEsperada));

    return {
      lote,
      deudaEsperadaTotal: montos.reduce((s, d) => s + d, 0),
      concentracionTop20: concentracionTop(montos, 0.2),
      porGrupo: porGrupo.map((g) => ({
        grupo: g.grupo,
        contribuyentes: g._count._all,
        deudaAnio: Number(g._sum.deudaAnio ?? 0),
        deudaEsperada: Number(g._sum.deudaEsperada ?? 0),
      })),
      porTramo: porTramo
        .map((t) => ({ tramo: t.tramo, contribuyentes: t._count._all, deudaEsperada: Number(t._sum.deudaEsperada ?? 0) }))
        .sort((a, b) => a.tramo.localeCompare(b.tramo)),
      acciones: acciones.map((a) => ({ accion: a.accion, contribuyentes: a._count._all })),
      gestiones: { ...conteoEstados, gestionados: gestiones.size },
    };
  }

  private async construirFiltro(loteId: number, anio: number, f: FiltroPuntajesDto) {
    const where: Prisma.PuntajeCobranzaWhereInput = {
      loteId,
      tramo: f.tramo,
      grupo: f.grupo,
      accion: f.accion,
    };
    const q = f.q?.trim();
    if (q) {
      where.OR = /^\d+$/.test(q)
        ? [{ codigoLegacy: { startsWith: q.padStart(Math.min(7, q.length), '0') } }, { contribuyente: { numDoc: q } }]
        : [{ contribuyente: { nombreCompleto: { contains: q, mode: 'insensitive' } } }];
    }
    if (f.estado) {
      const ultimas = await this.ultimasGestiones(anio);
      if (f.estado === EstadoGestionCobranza.PENDIENTE) {
        const gestionados = [...ultimas.values()].filter((g) => g.estado !== f.estado).map((g) => g.codigoLegacy);
        where.codigoLegacy = { notIn: gestionados };
      } else {
        where.codigoLegacy = { in: [...ultimas.values()].filter((g) => g.estado === f.estado).map((g) => g.codigoLegacy) };
      }
    }
    return where;
  }

  private async conGestion(anio: number, items: (PuntajeCobranza & { contribuyente: unknown })[]) {
    const ultimas = await this.ultimasGestiones(
      anio,
      items.map((i) => i.codigoLegacy),
    );
    return items.map((i) => {
      const g = ultimas.get(i.codigoLegacy);
      return {
        ...i,
        pPuntual: Number(i.pPuntual),
        pTardio: Number(i.pTardio),
        pIncobrable: Number(i.pIncobrable),
        deudaAnio: Number(i.deudaAnio),
        deudaPendiente: Number(i.deudaPendiente),
        deudaEsperada: Number(i.deudaEsperada),
        estadoGestion: g?.estado ?? EstadoGestionCobranza.PENDIENTE,
        ultimaGestionAt: g?.createdAt ?? null,
      };
    });
  }

  private readonly incluirContribuyente = {
    contribuyente: { select: { id: true, nombreCompleto: true, tipoDoc: true, numDoc: true } },
  } as const;

  // P5
  async listar(f: FiltroPuntajesDto) {
    const lote = await this.loteVigente(f.anio);
    if (!lote) return { items: [], total: 0, page: f.page, pageSize: f.pageSize, anio: null };
    const where = await this.construirFiltro(lote.id, lote.anio, f);
    const [items, total] = await Promise.all([
      this.prisma.puntajeCobranza.findMany({
        where,
        orderBy: { prioridad: 'asc' },
        skip: (f.page - 1) * f.pageSize,
        take: f.pageSize,
        include: this.incluirContribuyente,
      }),
      this.prisma.puntajeCobranza.count({ where }),
    ]);
    return { items: await this.conGestion(lote.anio, items), total, page: f.page, pageSize: f.pageSize, anio: lote.anio };
  }

  async exportar(f: FiltroPuntajesDto) {
    const lote = await this.loteVigente(f.anio);
    if (!lote) return [];
    const where = await this.construirFiltro(lote.id, lote.anio, f);
    const items = await this.prisma.puntajeCobranza.findMany({
      where,
      orderBy: { prioridad: 'asc' },
      take: MAX_EXPORTACION,
      include: this.incluirContribuyente,
    });
    return this.conGestion(lote.anio, items);
  }

  // P6
  historial(dto: HistorialGestionDto) {
    return this.prisma.gestionCobranza.findMany({
      where: { anio: dto.anio, codigoLegacy: dto.codigo },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { creadoPor: { select: { usuario: true, nombres: true, apellidos: true } } },
    });
  }

  async registrarGestion(dto: CrearGestionDto) {
    const lote = await this.loteVigente(dto.anio);
    const puntaje =
      lote &&
      (await this.prisma.puntajeCobranza.findUnique({
        where: { loteId_codigoLegacy: { loteId: lote.id, codigoLegacy: dto.codigo } },
        select: { id: true },
      }));
    if (!puntaje) throw new NotFoundException(`El código ${dto.codigo} no está en la lista ${dto.anio}.`);

    const motivo = motivoGestionInvalida(dto.estado, dto.observacion);
    if (motivo) throw new BadRequestException(motivo);

    return this.prisma.gestionCobranza.create({
      data: {
        anio: dto.anio,
        codigoLegacy: dto.codigo,
        estado: dto.estado,
        observacion: dto.observacion?.trim() || null,
      },
    });
  }

  // P7: tarjeta de la ficha del contribuyente
  async porContribuyente(contribuyenteId: number) {
    const puntaje = await this.prisma.puntajeCobranza.findFirst({
      where: { contribuyenteId, lote: { vigente: true } },
      orderBy: { anio: 'desc' },
      include: { lote: { select: { id: true, anio: true, filas: true, modelo: true } } },
    });
    if (!puntaje) return null;
    const [item] = await this.conGestion(puntaje.anio, [{ ...puntaje, contribuyente: null }]);
    return { ...item, totalLista: puntaje.lote.filas, modelo: puntaje.lote.modelo };
  }
}
