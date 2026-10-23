import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EstadoRegistro, Prisma, TipoTributo } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload.type.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CONCEPTOS_ARBITRIO } from '../catalogos-construccion.js';
import { anioValido } from '../maestros/maestros.reglas.js';
import { ESTADOS_VALOR_VIGENTE } from '../valores/valores.reglas.js';
import {
  CUOTAS_POR_ANIO,
  impuestoPredial,
  planificar,
  redondear,
  repartir,
  tarifaArbitrio,
  valorizarPredio,
  vencimientos,
  type LineaCuenta,
  type ParametrosAnio,
  type PredioCalculo,
  type Valorizacion,
} from './motor.js';

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;
export type TipoCalculo = 'PREDIAL' | 'ARBITRIOS';

export interface CalculoEntrada {
  anio: number;
  contribuyenteId?: number;
  tributos?: TipoCalculo[];
}

// El masivo escribe miles de filas por lotes; con la latencia a Supabase necesita margen.
const OPCIONES_TX = { maxWait: 10_000, timeout: 120_000 };
const LOTE = 500;

@Injectable()
export class CalculoService {
  constructor(private readonly prisma: PrismaService) {}

  simular(entrada: CalculoEntrada, usuario: AuthenticatedUser) {
    this.autorizar(entrada, usuario);
    return this.prisma.$transaction(async (tx) => (await this.preparar(tx, entrada)).respuesta, OPCIONES_TX);
  }

  // Ejecuta en una sola transacción: cuenta corriente + autoavalúo del predio, o nada.
  ejecutar(entrada: CalculoEntrada, usuario: AuthenticatedUser) {
    this.autorizar(entrada, usuario);
    return this.prisma.$transaction(async (tx) => {
      const { respuesta, plan, valorizados } = await this.preparar(tx, entrada);
      const anio = entrada.anio;

      for (let i = 0; i < plan.crear.length; i += LOTE) {
        await tx.cuentaCorriente.createMany({
          data: plan.crear.slice(i, i + LOTE).map((l) => ({
            contribuyenteId: l.contribuyenteId,
            predioId: l.predioId,
            tributoId: l.tributoId,
            anioFiscal: anio,
            cuota: l.cuota,
            importe: l.importe,
            derechoEmision: l.derechoEmision,
            fechaVencimiento: new Date(l.fechaVencimiento),
          })),
        });
      }
      for (let i = 0; i < plan.actualizar.length; i += LOTE) {
        const filas = plan.actualizar
          .slice(i, i + LOTE)
          .map((l) => Prisma.sql`(${l.id}::int, ${l.importe.toFixed(2)}::numeric, ${l.derechoEmision.toFixed(2)}::numeric, ${l.fechaVencimiento}::date)`);
        await tx.$executeRaw`
          UPDATE cuenta_corriente AS c
          SET importe = v.importe, "derechoEmision" = v.emision, "fechaVencimiento" = v.vence,
              estado = 'PENDIENTE', "updatedAt" = now()
          FROM (VALUES ${Prisma.join(filas)}) AS v(id, importe, emision, vence)
          WHERE c.id = v.id`;
      }
      if (plan.anular.length) {
        await tx.cuentaCorriente.updateMany({ where: { id: { in: plan.anular } }, data: { estado: 'ANULADO' } });
      }
      const autoavaluos = [...valorizados.entries()].filter(([, v]) => v.ok) as [number, Extract<Valorizacion, { ok: true }>][];
      for (let i = 0; i < autoavaluos.length; i += LOTE) {
        const filas = autoavaluos.slice(i, i + LOTE).map(([id, v]) => Prisma.sql`(${id}::int, ${v.autoavaluo.toFixed(2)}::numeric)`);
        await tx.$executeRaw`
          UPDATE predios AS p SET "valorAutovaluo" = v.valor, "updatedAt" = now()
          FROM (VALUES ${Prisma.join(filas)}) AS v(id, valor)
          WHERE p.id = v.id AND p."valorAutovaluo" IS DISTINCT FROM v.valor`;
      }
      return { ...respuesta, ejecutado: true };
    }, OPCIONES_TX);
  }

  // Masivo (sin contribuyente) exige el nivel propio; individual basta con registro tributario.
  private autorizar(entrada: CalculoEntrada, usuario: AuthenticatedUser) {
    if (!anioValido(entrada.anio)) {
      throw new BadRequestException('El año no es válido');
    }
    if (!entrada.contribuyenteId && !usuario.niveles.includes('rentas.calculo-masivo')) {
      throw new ForbiddenException('El cálculo masivo requiere el nivel "Cálculo Masivo"');
    }
  }

  // Para emitir valores (specs/rentas-valores-v1.md, V8): contribuyentes cuya deuda del año cambiaría
  // al recalcular o cuyo predial no se puede calcular (datos incompletos: no se sabe si su deuda está
  // al día); a ellos no se les emite. Devuelve también la base imponible predial de cada uno.
  async revisarParaEmision(tx: Tx, anio: number, tipos: TipoCalculo[], contribuyenteId?: number) {
    const { plan, existentes, bases, tributos, fallidos } = await this.preparar(tx, { anio, contribuyenteId, tributos: tipos });
    const idPredial = tributos.get('PREDIAL');
    const pendientes = new Map<number, Set<TipoCalculo>>();
    const marcar = (cid: number, tributoId: number) => {
      const s = pendientes.get(cid) ?? new Set<TipoCalculo>();
      s.add(tributoId === idPredial ? 'PREDIAL' : 'ARBITRIOS');
      pendientes.set(cid, s);
    };
    for (const l of [...plan.crear, ...plan.actualizar]) marcar(l.contribuyenteId, l.tributoId);
    const porId = new Map(existentes.map((e) => [e.id, e]));
    for (const id of plan.anular) {
      const e = porId.get(id);
      if (e) marcar(e.contribuyenteId, e.tributoId);
    }
    if (idPredial) for (const cid of fallidos) marcar(cid, idPredial);
    return { pendientes, bases };
  }

  private async preparar(tx: Tx, entrada: CalculoEntrada) {
    const { anio, contribuyenteId } = entrada;
    const tipos = entrada.tributos?.length ? entrada.tributos : (['PREDIAL', 'ARBITRIOS'] as TipoCalculo[]);
    const params = await this.cargarParametros(tx, anio, tipos);
    const tributos = await this.cargarTributos(tx, tipos);
    const predios = await this.cargarPredios(tx, contribuyenteId);

    const valorizados = new Map<number, Valorizacion>();
    if (tipos.includes('PREDIAL')) {
      for (const p of predios) valorizados.set(p.id, valorizarPredio(p, params));
    }

    // Participación de cada contribuyente en cada predio.
    const porContribuyente = new Map<number, { predio: PredioCalculo; pct: Prisma.Decimal }[]>();
    for (const p of predios) {
      for (const t of p.titulares) {
        if (contribuyenteId && t.contribuyenteId !== contribuyenteId) continue;
        const lista = porContribuyente.get(t.contribuyenteId) ?? [];
        lista.push({ predio: p, pct: new D(t.porcentaje) });
        porContribuyente.set(t.contribuyenteId, lista);
      }
    }

    const fechas = vencimientos(anio);
    const lineas: LineaCuenta[] = [];
    const errores: string[] = [];
    const fallidos = new Set<number>();
    const bases = new Map<number, Prisma.Decimal>();
    const detalle: Record<string, unknown>[] = [];
    let totalPredial = new D(0);
    let totalArbitrios = new D(0);
    let totalEmision = new D(0);

    for (const [cid, participaciones] of porContribuyente) {
      let base = new D(0);
      let impuesto: Prisma.Decimal | null = null;
      if (tipos.includes('PREDIAL')) {
        const errorPredio = participaciones.map((x) => valorizados.get(x.predio.id)).find((v) => v && !v.ok);
        if (errorPredio && !errorPredio.ok) {
          errores.push(errorPredio.error);
          fallidos.add(cid);
        } else {
          base = participaciones.reduce((acc, x) => {
            const v = valorizados.get(x.predio.id) as Extract<Valorizacion, { ok: true }>;
            return acc.plus(redondear(v.autoavaluo.times(x.pct).div(100)));
          }, new D(0));
          impuesto = impuestoPredial(base, params);
          bases.set(cid, base);
          const emision = new D(params.derechoEmision);
          repartir(impuesto, CUOTAS_POR_ANIO).forEach((importe, i) =>
            lineas.push({
              contribuyenteId: cid,
              predioId: null,
              tributoId: tributos.get('PREDIAL')!,
              cuota: i + 1,
              importe,
              derechoEmision: i === 0 ? emision : new D(0),
              fechaVencimiento: fechas[i],
            }),
          );
          totalPredial = totalPredial.plus(impuesto);
          totalEmision = totalEmision.plus(emision);
        }
      }

      let arbitrios = new D(0);
      if (tipos.includes('ARBITRIOS')) {
        for (const { predio, pct } of participaciones) {
          for (const concepto of CONCEPTOS_ARBITRIO) {
            const tarifa = tarifaArbitrio(predio, concepto, params.tarifas);
            if (!tarifa) continue;
            const anual = redondear(new D(tarifa.tasa).times(pct).div(100));
            repartir(anual, CUOTAS_POR_ANIO).forEach((importe, i) =>
              lineas.push({
                contribuyenteId: cid,
                predioId: predio.id,
                tributoId: tributos.get(concepto)!,
                cuota: i + 1,
                importe,
                derechoEmision: new D(0),
                fechaVencimiento: fechas[i],
              }),
            );
            arbitrios = arbitrios.plus(anual);
          }
        }
        totalArbitrios = totalArbitrios.plus(arbitrios);
      }

      if (contribuyenteId) {
        detalle.push({
          contribuyenteId: cid,
          predios: participaciones.map(({ predio, pct }) => {
            const v = valorizados.get(predio.id);
            return {
              predioId: predio.id,
              porcentaje: pct.toFixed(2),
              ...(v?.ok
                ? {
                    arancel: v.arancel.toFixed(2),
                    terreno: v.terreno.toFixed(2),
                    construccion: v.construccion.toFixed(2),
                    otras: v.otras.toFixed(2),
                    autoavaluo: v.autoavaluo.toFixed(2),
                    pisos: v.pisos,
                  }
                : { error: v && !v.ok ? v.error : null }),
            };
          }),
          baseImponible: base.toFixed(2),
          impuestoPredial: impuesto?.toFixed(2) ?? null,
          arbitrios: arbitrios.toFixed(2),
        });
      }
    }

    // Existentes del alcance; las de contribuyentes con error no se anulan (se dejan como estaban).
    const idPredial = tributos.get('PREDIAL');
    const existentes = (
      await tx.cuentaCorriente.findMany({
        where: { anioFiscal: anio, tributoId: { in: [...tributos.values()] }, ...(contribuyenteId ? { contribuyenteId } : {}) },
        select: {
          id: true,
          contribuyenteId: true,
          predioId: true,
          tributoId: true,
          cuota: true,
          importe: true,
          derechoEmision: true,
          estado: true,
          valorDetalles: { where: { valor: { estado: { in: ESTADOS_VALOR_VIGENTE } } }, select: { id: true }, take: 1 },
        },
      })
    )
      .filter((e) => !(fallidos.has(e.contribuyenteId) && e.tributoId === idPredial))
      .map(({ valorDetalles, ...e }) => ({ ...e, enValor: valorDetalles.length > 0 }));
    const plan = planificar(lineas, existentes);

    const respuesta = {
      anio,
      tributos: tipos,
      contribuyentes: porContribuyente.size,
      predios: predios.length,
      totales: {
        predial: totalPredial.toFixed(2),
        derechoEmision: totalEmision.toFixed(2),
        arbitrios: totalArbitrios.toFixed(2),
      },
      cambios: {
        crear: plan.crear.length,
        actualizar: plan.actualizar.length,
        anular: plan.anular.length,
        sinCambio: plan.sinCambio,
        protegidas: plan.protegidas,
      },
      errores: errores.slice(0, 200),
      totalErrores: errores.length,
      detalle,
      ejecutado: false,
    };
    return { respuesta, plan, valorizados, existentes, bases, tributos, fallidos };
  }

  private async cargarParametros(tx: Tx, anio: number, tipos: TipoCalculo[]): Promise<ParametrosAnio> {
    const [uit, escala, aranceles, valoresUnitarios, depreciaciones, tarifas] = await Promise.all([
      tx.uit.findUnique({ where: { anio } }),
      tx.escalaPredial.findMany({ where: { anio }, orderBy: { tramo: 'asc' } }),
      tx.arancel.findMany({ where: { anio } }),
      tx.valorUnitario.findMany({ where: { anio } }),
      tx.depreciacion.findMany({ where: { anio } }),
      tx.tarifaArbitrio.findMany({ where: { anio } }),
    ]);
    if (tipos.includes('PREDIAL') && (!uit || escala.length === 0)) {
      throw new BadRequestException(`Faltan la UIT o la escala predial ${anio}: complétalas en Maestros`);
    }
    if (tipos.includes('ARBITRIOS') && tarifas.length === 0) {
      throw new BadRequestException(`No hay tarifas de arbitrios ${anio}: regístralas en Maestros`);
    }
    return {
      anio,
      uit: uit?.valor ?? 0,
      derechoEmision: uit?.derechoEmision ?? 0,
      escala,
      aranceles,
      valoresUnitarios,
      depreciaciones,
      tarifas,
    };
  }

  private async cargarTributos(tx: Tx, tipos: TipoCalculo[]) {
    const codigos = [...(tipos.includes('PREDIAL') ? ['PREDIAL'] : []), ...(tipos.includes('ARBITRIOS') ? CONCEPTOS_ARBITRIO : [])];
    const filas = await tx.tributo.findMany({
      where: { codigo: { in: codigos }, tipo: { in: [TipoTributo.PREDIAL, TipoTributo.ARBITRIOS] } },
      select: { id: true, codigo: true },
    });
    if (filas.length !== codigos.length) {
      throw new BadRequestException('Faltan tributos de rentas en la base: ejecuta "npx prisma db seed"');
    }
    return new Map(filas.map((t) => [t.codigo, t.id]));
  }

  // Predios activos con titulares activos; individual: todos los predios del contribuyente.
  private async cargarPredios(tx: Tx, contribuyenteId?: number): Promise<PredioCalculo[]> {
    const filas = await tx.predio.findMany({
      where: {
        estado: EstadoRegistro.ACTIVO,
        contribuyentes: { some: { estado: EstadoRegistro.ACTIVO, ...(contribuyenteId ? { contribuyenteId } : {}) } },
      },
      select: {
        id: true,
        viaId: true,
        urbanizacionId: true,
        zonaId: true,
        usoPredio: true,
        areaTerreno: true,
        pisos: {
          select: {
            nivel: true,
            anioConstruccion: true,
            clasificacion: true,
            material: true,
            estadoConservacion: true,
            categorias: true,
            areaConstruida: true,
          },
        },
        otrasInstalaciones: { select: { valor: true } },
        contribuyentes: { where: { estado: EstadoRegistro.ACTIVO }, select: { contribuyenteId: true, porcentaje: true } },
      },
      orderBy: { id: 'asc' },
    });
    return filas.map(({ contribuyentes, ...p }) => ({ ...p, titulares: contribuyentes }));
  }
}
