import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoCuenta,
  EstadoDeterminacion,
  EstadoDj,
  EstadoPersona,
  EstadoRegistro,
  EstadoValor,
  GrupoCatalogo,
  Prisma,
  TipoPredio,
  TipoTributo,
} from '@prisma/client';
import { CatalogosService } from '../../catalogos/catalogos.service.js';
import { estadoAlHabilitar, pendientesDe } from '../../contribuyentes/persona.reglas.js';
import { numeroDj } from '../../declaraciones/dj.reglas.js';
import { asociacionEnAnio } from '../../predios/predio.reglas.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CONCEPTOS_ARBITRIO } from '../catalogos-construccion.js';
import { iso } from '../estado-cuenta/tasas.js';
import { hoyLima } from '../fechas.js';
import {
  aniosADeterminar,
  determinarAnio,
  exoneracionPredio,
  huellaDeterminado,
  mesDesde,
  rigeEn,
  usosDelMes,
  vigenteArbitrios,
  vigentePredial,
  type DeclaracionPredio,
  type Declarado,
  type Determinado,
  type InicioArbitrios,
  type Maestro,
  type MesArbitrio,
  type ParametrosV2,
  type PredioDelAnio,
  type Resolucion,
} from './determinacion.reglas.js';
import {
  bajas,
  errorAnularLiquidada,
  errorLiquidar,
  errorResolverRevision,
  estadoTrasLiquidar,
  planificarCuenta,
  venceRevision,
  type ComparacionAnio,
  type CuentaActual,
  type LineaNueva,
  type PlanCuenta,
  type Tributo,
} from './reliquidacion.reglas.js';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Tx = Prisma.TransactionClient;

// Varios años con todos los predios del contribuyente: con la latencia a Supabase necesita margen.
const OPCIONES_TX = { maxWait: 10_000, timeout: 120_000 };
const SIN_EFECTO_CUENTA: EstadoCuenta[] = [EstadoCuenta.ANULADO, EstadoCuenta.EXTORNADO];
const DEUDA_VIVA: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.FRACCIONADO, EstadoCuenta.COACTIVO];
// L09: un valor en coactivo también protege la cuota (además de los vigentes EMITIDO/NOTIFICADO).
const VALOR_CON_TRAMITE: EstadoValor[] = [EstadoValor.EMITIDO, EstadoValor.NOTIFICADO, EstadoValor.COACTIVO];
const TODOS: Tributo[] = ['PREDIAL', 'ARBITRIOS'];

export interface Actor {
  id: number;
  rol: string;
}

const n = (v: Prisma.Decimal | number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));
const n2 = (v: Dec) => v.toFixed(2);

// Lo que se guarda en DeterminacionPredio.datos: lo declarado que se usó, para reconstruir el predio
// de ese año (la "copia por año" de Lurín sale de aquí).
interface DatosGuardados {
  declarado: Declarado;
  maestro: Maestro;
  meses: MesArbitrio[];
  arancel: string | null;
  niveles: unknown[];
}

// Padrón antes de la primera liquidación: anular la DJ lo devuelve (J04).
interface Aplicado {
  titulares: { contribuyenteId: number; predioId: number; antes: Record<string, unknown> | null }[];
  predios: { predioId: number; estado: EstadoRegistro }[];
  copias: { predioId: number; areaTerreno: string | null; areaConstruida: string | null; usoPredio: string | null; valorAutovaluo: string | null; pisos: Record<string, unknown>[]; otras: Record<string, unknown>[] }[];
  persona: { estado: EstadoPersona; motivoEstado: string | null } | null;
}

interface DetalleGuardado {
  huella: string;
  cuotasPredial: { cuota: number; importe: string; derechoEmision: string; vence: string }[];
  cuotasArbitrios: { predioId: number; concepto: string; cuota: number; importe: string; vence: string }[];
  beneficios: string[];
  errores: string[];
  avisos: string[];
  anuladas?: number[];
  saldoAFavor?: { tributo: string; predioId: number | null; importe: string }[];
  reemplazaA?: number | null;
}

type Contexto = Awaited<ReturnType<DeterminacionService['contexto']>>;

// Determinación y liquidación de la DJ presentada (specs/rentas-nucleo-v2.md, Fase 5; C6, C7).
// Determinar guarda lo calculado por año; liquidar ("Generar Cta.") lo vuelve a calcular, comprueba
// que no cambió y escribe la cuenta corriente y el padrón en una sola transacción (L12).
@Injectable()
export class DeterminacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogos: CatalogosService,
  ) {}

  // ---- Determinar (C6) ----

  async determinar(djId: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.bloquear(tx, djId);
      const ctx = await this.contexto(tx, djId);
      const { dj } = ctx;
      if (dj.estado !== EstadoDj.PENDIENTE && dj.estado !== EstadoDj.EN_REVISION) {
        throw new ConflictException('Solo se determina una DJ pendiente o en revisión');
      }
      const resultados = await this.calcular(tx, ctx, ctx.anios);
      await tx.determinacion.updateMany({ where: { djId, estado: EstadoDeterminacion.DETERMINADA }, data: { estado: EstadoDeterminacion.DESCARTADA } });
      for (const r of resultados) await this.guardar(tx, ctx, r);

      // J14: si baja la obligación de un período ya liquidado, queda en revisión y no genera cuenta.
      if (dj.tipo !== 'INFORMATIVA') {
        const b = bajas(await this.comparar(tx, ctx, resultados));
        if (b.length && !dj.revisionResueltaAt) {
          await tx.djPresentada.update({
            where: { id: djId },
            data: { estado: EstadoDj.EN_REVISION, revisionVence: new Date(dj.revisionVence ?? venceRevision(dj.fechaPresentacion, ctx.feriados)) },
          });
        } else if (!b.length && dj.estado === EstadoDj.EN_REVISION) {
          await tx.djPresentada.update({ where: { id: djId }, data: { estado: EstadoDj.PENDIENTE, revisionVence: null } });
        }
      }
    }, OPCIONES_TX);
    return this.verDj(djId);
  }

  // ---- Vista previa y liquidación (C7) ----

  async previa(djId: number, anios?: number[], tributos?: Tributo[]) {
    return this.prisma.$transaction(async (tx) => {
      const ctx = await this.contexto(tx, djId);
      const { resultados, seleccion, tipos } = await this.prepararLiquidacion(tx, ctx, anios, tributos, true);
      const planes = ctx.dj.tipo === 'INFORMATIVA' ? new Map<number, PlanCuenta>() : await this.planes(tx, ctx, resultados, tipos);
      return {
        anios: seleccion,
        tributos: tipos,
        informativa: ctx.dj.tipo === 'INFORMATIVA',
        porAnio: resultados.map((r) => this.resumenPlan(ctx, r, planes.get(r.anio))),
        avisos: await this.avisosFicha(tx, ctx),
      };
    }, OPCIONES_TX);
  }

  async liquidar(djId: number, anios: number[] | undefined, tributos: Tributo[] | undefined, actor: Actor) {
    const resumen = await this.prisma.$transaction(async (tx) => {
      await this.bloquear(tx, djId);
      const ctx = await this.contexto(tx, djId);
      const { dj } = ctx;
      const { resultados, seleccion, tipos, guardadas } = await this.prepararLiquidacion(tx, ctx, anios, tributos);
      const informativa = dj.tipo === 'INFORMATIVA';
      const planes = informativa ? new Map<number, PlanCuenta>() : await this.planes(tx, ctx, resultados, tipos);

      // Bloqueos: V06 (predio sin valorizar) y L09 (baja una deuda con valor, coactivo o convenio).
      const bloqueos: string[] = [];
      for (const r of resultados) {
        if (!informativa && tipos.includes('PREDIAL') && !r.predialCalculable) bloqueos.push(`${r.anio}: ${r.errores[0] ?? 'el predial no se puede calcular'} (V06)`);
        for (const b of planes.get(r.anio)?.bloqueos ?? []) bloqueos.push(`${r.anio}, ${this.etiquetaGrupo(ctx, b)}: ${b.motivo}`);
      }
      if (bloqueos.length) throw new ConflictException(`No se liquida: ${bloqueos.slice(0, 5).join(' · ')}`);

      const avisos = await this.avisosFicha(tx, ctx);
      const porAnio = [];
      for (const r of resultados) {
        const det = guardadas.get(r.anio)!;
        const plan = planes.get(r.anio);
        const anterior = await tx.determinacion.findFirst({
          where: { contribuyenteId: dj.contribuyenteId, anio: r.anio, estado: EstadoDeterminacion.LIQUIDADA },
          select: { id: true },
        });
        if (plan) {
          if (plan.anular.length) {
            await tx.cuentaCorriente.updateMany({ where: { id: { in: plan.anular }, estado: EstadoCuenta.PENDIENTE }, data: { estado: EstadoCuenta.ANULADO } });
          }
          if (plan.crear.length) {
            await tx.cuentaCorriente.createMany({
              data: plan.crear.map((l) => ({
                contribuyenteId: dj.contribuyenteId,
                predioId: l.predioId,
                tributoId: l.tributoId,
                anioFiscal: r.anio,
                cuota: l.cuota,
                importe: l.importe,
                derechoEmision: l.derechoEmision,
                fechaVencimiento: new Date(l.vence),
                ajusteDeId: l.ajusteDeId,
                determinacionId: det.id,
              })),
            });
          }
        }
        if (anterior) await tx.determinacion.update({ where: { id: anterior.id }, data: { estado: EstadoDeterminacion.REEMPLAZADA } });
        const detalle: DetalleGuardado = {
          ...(det.detalle as unknown as DetalleGuardado),
          anuladas: plan?.anular ?? [],
          saldoAFavor: (plan?.saldoAFavor ?? []).map((s) => ({ tributo: ctx.codigoTributo.get(s.tributoId) ?? '', predioId: s.predioId, importe: n2(s.importe) })),
          reemplazaA: anterior?.id ?? null,
        };
        await tx.determinacion.update({
          where: { id: det.id },
          data: {
            estado: EstadoDeterminacion.LIQUIDADA,
            liquidadaAt: new Date(),
            liquidaPredial: !informativa && tipos.includes('PREDIAL'),
            liquidaArbitrios: !informativa && tipos.includes('ARBITRIOS'),
            detalle: detalle as unknown as Prisma.InputJsonValue,
          },
        });
        porAnio.push(this.resumenPlan(ctx, r, plan));
      }
      // Lo determinado que no se eligió (L08) no queda pendiente: se descarta.
      await tx.determinacion.updateMany({ where: { djId, estado: EstadoDeterminacion.DETERMINADA }, data: { estado: EstadoDeterminacion.DESCARTADA } });

      const aplicado = await this.aplicarPadron(tx, ctx, resultados, avisos);
      avisos.push(...(await this.estadoPersona(tx, ctx, aplicado)));
      await tx.djPresentada.update({
        where: { id: djId },
        data: {
          estado: EstadoDj.LIQUIDADA,
          liquidadaAt: new Date(),
          liquidadaPorId: actor.id,
          aplicado: aplicado as unknown as Prisma.InputJsonValue,
        },
      });
      return { anios: seleccion, tributos: tipos, informativa, porAnio, avisos };
    }, OPCIONES_TX);
    return { ...resumen, dj: await this.verDj(djId) };
  }

  // ---- Revisión (J14, J17) ----

  async resolverRevision(djId: number, accion: 'APROBAR' | 'RECHAZAR', justificacion: string, actor: Actor) {
    if (!['SUPERVISOR', 'ADMIN'].includes(actor.rol)) throw new ForbiddenException('Solo un supervisor resuelve la revisión de una DJ');
    const dj = await this.prisma.djPresentada.findUnique({ where: { id: djId }, select: { estado: true, creadoPorId: true, revisionVence: true } });
    if (!dj) throw new NotFoundException('La declaración no existe');
    const e = errorResolverRevision(
      { estado: dj.estado, creadoPorId: dj.creadoPorId, revisionVence: dj.revisionVence ? iso(dj.revisionVence) : null },
      accion,
      actor,
      hoyLima(),
      justificacion,
    );
    if (e) throw new ConflictException(e);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.djPresentada.updateMany({
        where: { id: djId, estado: EstadoDj.EN_REVISION },
        data: {
          estado: accion === 'APROBAR' ? EstadoDj.PENDIENTE : EstadoDj.RECHAZADA,
          revisionResueltaPorId: actor.id,
          revisionResueltaAt: new Date(),
          revisionJustificacion: justificacion.trim(),
        },
      });
      if (count === 0) throw new ConflictException('La DJ cambió mientras se resolvía; recarga la página');
      // Rechazada: lo determinado no se liquida.
      if (accion === 'RECHAZAR') {
        await tx.determinacion.updateMany({ where: { djId, estado: EstadoDeterminacion.DETERMINADA }, data: { estado: EstadoDeterminacion.DESCARTADA } });
      }
    });
    return this.verDj(djId);
  }

  // ---- Anular una DJ que ya generó cuenta (J04, J17) ----

  async anularLiquidada(tx: Tx, djId: number, motivo: string, actor: Actor) {
    await this.bloquear(tx, djId);
    const dj = await tx.djPresentada.findUniqueOrThrow({
      where: { id: djId },
      select: { id: true, contribuyenteId: true, creadoPorId: true, liquidadaAt: true, aplicado: true, anexos: { select: { predioId: true } } },
    });
    const e = errorAnularLiquidada(dj, actor);
    if (e) throw new ConflictException(e);
    const predioIds = dj.anexos.map((a) => a.predioId);
    const posterior = await tx.djPresentada.findFirst({
      where: {
        id: { not: djId },
        liquidadaAt: { gt: dj.liquidadaAt! },
        estado: { not: EstadoDj.ANULADA },
        OR: [{ contribuyenteId: dj.contribuyenteId }, { anexos: { some: { predioId: { in: predioIds } } } }],
      },
      select: { anio: true, numero: true },
    });
    if (posterior) {
      throw new ConflictException(`Hay una DJ liquidada después (${numeroDj(posterior.anio, posterior.numero)}) sobre la misma persona o predio: anúlala primero o presenta una rectificatoria`);
    }
    const dets = await tx.determinacion.findMany({ where: { djId }, select: { id: true, detalle: true } });
    const ids = dets.map((d) => d.id);
    const cuentas = await tx.cuentaCorriente.findMany({
      where: { determinacionId: { in: ids }, estado: { notIn: SIN_EFECTO_CUENTA } },
      select: { id: true, estado: true, valorDetalles: { where: { valor: { estado: { in: VALOR_CON_TRAMITE } } }, select: { id: true }, take: 1 } },
    });
    if (cuentas.some((c) => c.estado !== EstadoCuenta.PENDIENTE || c.valorDetalles.length)) {
      throw new ConflictException('La cuenta que generó esta DJ ya tiene pagos, valores o convenio: no se anula; presenta una rectificatoria');
    }
    // J04: se extorna lo que generó y vuelve lo que había antes (cuotas y determinaciones).
    if (cuentas.length) await tx.cuentaCorriente.updateMany({ where: { id: { in: cuentas.map((c) => c.id) } }, data: { estado: EstadoCuenta.EXTORNADO } });
    const detalles = dets.map((d) => d.detalle as unknown as DetalleGuardado);
    const anuladas = [...new Set(detalles.flatMap((d) => d.anuladas ?? []))];
    if (anuladas.length) {
      await tx.cuentaCorriente.updateMany({
        where: { id: { in: anuladas }, estado: EstadoCuenta.ANULADO, OR: [{ determinacionId: null }, { determinacionId: { notIn: ids } }] },
        data: { estado: EstadoCuenta.PENDIENTE },
      });
    }
    const previas = [...new Set(detalles.map((d) => d.reemplazaA).filter((x): x is number => typeof x === 'number' && !ids.includes(x)))];
    if (previas.length) {
      await tx.determinacion.updateMany({ where: { id: { in: previas }, estado: EstadoDeterminacion.REEMPLAZADA }, data: { estado: EstadoDeterminacion.LIQUIDADA } });
    }
    await tx.determinacion.updateMany({ where: { id: { in: ids } }, data: { estado: EstadoDeterminacion.DESCARTADA } });
    await this.revertirPadron(tx, dj.contribuyenteId, (dj.aplicado as unknown as Aplicado | null) ?? null);
    await tx.djPresentada.update({
      where: { id: djId },
      data: { estado: EstadoDj.ANULADA, anuladaMotivo: motivo, anuladaPorId: actor.id, anuladaAt: new Date() },
    });
  }

  // Lo calculado sin liquidar de una DJ que se edita o se anula sin haber generado cuenta.
  async descartar(tx: Tx, djId: number) {
    await tx.determinacion.updateMany({ where: { djId, estado: EstadoDeterminacion.DETERMINADA }, data: { estado: EstadoDeterminacion.DESCARTADA } });
  }

  // ---- Lecturas ----

  // Determinaciones de la DJ (las que siguen en pie), con PU/PR y arbitrios por mes.
  async verDj(djId: number) {
    const filas = await this.prisma.determinacion.findMany({
      where: { djId, estado: { not: EstadoDeterminacion.DESCARTADA } },
      include: this.include(),
      orderBy: [{ anio: 'asc' }, { id: 'desc' }],
    });
    // Tras reabrir y volver a liquidar, una DJ puede tener dos del mismo año: se muestra la última.
    const vistas = new Set<number>();
    return filas.filter((f) => (vistas.has(f.anio) ? false : vistas.add(f.anio))).map((f) => this.serializar(f));
  }

  // HR por año del contribuyente: la vigente (liquidada) y la que espera liquidarse.
  async porContribuyente(contribuyenteId: number) {
    const filas = await this.prisma.determinacion.findMany({
      where: { contribuyenteId, estado: { in: [EstadoDeterminacion.LIQUIDADA, EstadoDeterminacion.DETERMINADA] } },
      select: {
        id: true,
        anio: true,
        estado: true,
        baseAfecta: true,
        impuesto: true,
        derechoEmision: true,
        arbitrios: true,
        liquidaPredial: true,
        liquidaArbitrios: true,
        liquidadaAt: true,
        dj: { select: { id: true, anio: true, numero: true, estado: true } },
        _count: { select: { predios: true } },
      },
      orderBy: [{ anio: 'desc' }, { estado: 'asc' }, { id: 'desc' }],
    });
    return filas.map((f) => ({
      ...f,
      dj: f.dj ? { ...f.dj, numeroTexto: numeroDj(f.dj.anio, f.dj.numero) } : null,
      predios: f._count.predios,
      _count: undefined,
    }));
  }

  // ---- Preparación ----

  // `paraVer`: la vista previa también se muestra mientras la DJ está en revisión.
  private async prepararLiquidacion(tx: Tx, ctx: Contexto, anios: number[] | undefined, tributos: Tributo[] | undefined, paraVer = false) {
    const { dj } = ctx;
    const guardadasLista = await tx.determinacion.findMany({
      where: { djId: dj.id, estado: EstadoDeterminacion.DETERMINADA },
      select: { id: true, anio: true, detalle: true },
    });
    const guardadas = new Map(guardadasLista.map((g) => [g.anio, g]));
    const determinada = ctx.anios.length === 0 || ctx.anios.every((a) => guardadas.has(a));
    const e = paraVer
      ? dj.estado !== EstadoDj.PENDIENTE && dj.estado !== EstadoDj.EN_REVISION
        ? 'La DJ no está pendiente de liquidar'
        : determinada
          ? null
          : 'Primero determina la DJ para revisar lo que se va a liquidar'
      : errorLiquidar({ estado: dj.estado, tipo: dj.tipo, revisionVence: dj.revisionVence }, hoyLima(), determinada);
    if (e) throw new ConflictException(e);
    const seleccion = anios?.length ? [...new Set(anios)].sort() : ctx.anios;
    const fuera = seleccion.find((a) => !ctx.anios.includes(a));
    if (fuera) throw new BadRequestException(`La DJ no determina el año ${fuera}: elige entre ${ctx.anios.join(', ') || 'ninguno'}`);
    const tipos = tributos?.length ? TODOS.filter((t) => tributos.includes(t)) : TODOS;

    const resultados = await this.calcular(tx, ctx, seleccion);
    // Lo que se revisó al determinar es lo que se liquida: si cambió algo (parámetros, otra DJ), se vuelve a determinar.
    const cambio = resultados.find((r) => (guardadas.get(r.anio)?.detalle as unknown as DetalleGuardado | undefined)?.huella !== huellaDeterminado(r));
    if (cambio) throw new ConflictException(`La determinación de ${cambio.anio} cambió desde que se calculó (parámetros, predios u otra DJ): vuelve a determinar`);
    return { resultados, seleccion, tipos, guardadas };
  }

  private async planes(tx: Tx, ctx: Contexto, resultados: Determinado[], tipos: Tributo[]) {
    const idPredial = ctx.tributos.get('PREDIAL')!;
    const idsArbitrios = CONCEPTOS_ARBITRIO.map((c) => ctx.tributos.get(c)!);
    const ids = [...(tipos.includes('PREDIAL') ? [idPredial] : []), ...(tipos.includes('ARBITRIOS') ? idsArbitrios : [])];
    const planes = new Map<number, PlanCuenta>();
    for (const r of resultados) {
      const nuevas: LineaNueva[] = [];
      if (tipos.includes('PREDIAL')) {
        for (const c of r.cuotasPredial) nuevas.push({ tributoId: idPredial, predioId: null, cuota: c.cuota, importe: c.importe, derechoEmision: c.derechoEmision, vence: c.vence });
      }
      if (tipos.includes('ARBITRIOS')) {
        for (const c of r.cuotasArbitrios) {
          nuevas.push({ tributoId: ctx.tributos.get(c.concepto)!, predioId: c.predioId, cuota: c.cuota, importe: c.importe, derechoEmision: new D(0), vence: c.vence });
        }
      }
      const actuales = await this.cuentasActuales(tx, ctx.dj.contribuyenteId, r.anio, ids);
      const grupos = [
        ...(tipos.includes('PREDIAL') ? [{ tributoId: idPredial, predioId: null }] : []),
        ...nuevas.filter((x) => x.predioId !== null),
        ...actuales.filter((x) => x.tributoId !== idPredial),
      ].map((g) => ({ tributoId: g.tributoId, predioId: g.predioId }));
      planes.set(r.anio, planificarCuenta(nuevas, actuales, grupos));
    }
    return planes;
  }

  private async cuentasActuales(tx: Tx, contribuyenteId: number, anio: number, tributoIds: number[]): Promise<CuentaActual[]> {
    const filas = await tx.cuentaCorriente.findMany({
      where: { contribuyenteId, anioFiscal: anio, tributoId: { in: tributoIds }, estado: { notIn: SIN_EFECTO_CUENTA } },
      select: {
        id: true,
        tributoId: true,
        predioId: true,
        cuota: true,
        importe: true,
        derechoEmision: true,
        estado: true,
        ajusteDeId: true,
        valorDetalles: { where: { valor: { estado: { in: VALOR_CON_TRAMITE } } }, select: { id: true }, take: 1 },
      },
      orderBy: [{ cuota: 'asc' }, { id: 'asc' }],
    });
    return filas.map(({ valorDetalles, ...f }) => ({ ...f, enValor: valorDetalles.length > 0 }));
  }

  // J14: lo vigente en la cuenta de cada año (importe, sin derecho de emisión) contra lo determinado.
  private async comparar(tx: Tx, ctx: Contexto, resultados: Determinado[]): Promise<ComparacionAnio[]> {
    const idPredial = ctx.tributos.get('PREDIAL')!;
    const comps: ComparacionAnio[] = [];
    for (const r of resultados) {
      const filas = await tx.cuentaCorriente.groupBy({
        by: ['tributoId'],
        where: { contribuyenteId: ctx.dj.contribuyenteId, anioFiscal: r.anio, tributoId: { in: [...ctx.tributos.values()] }, estado: { notIn: SIN_EFECTO_CUENTA } },
        _sum: { importe: true },
      });
      const predial = filas.filter((f) => f.tributoId === idPredial).reduce((t, f) => t.plus(f._sum.importe ?? 0), new D(0));
      const arbitrios = filas.filter((f) => f.tributoId !== idPredial).reduce((t, f) => t.plus(f._sum.importe ?? 0), new D(0));
      if (r.predialCalculable) comps.push({ anio: r.anio, tributo: 'PREDIAL', liquidado: predial, determinado: r.impuesto });
      comps.push({ anio: r.anio, tributo: 'ARBITRIOS', liquidado: arbitrios, determinado: r.arbitrios });
    }
    return comps;
  }

  // L13: la copia de la persona se toma de la ficha al registrar la DJ y el formulario de DJ no la
  // edita: no hay datos que pasar a la ficha. Si la ficha cambió después, gana la ficha (la más reciente).
  private async avisosFicha(tx: Tx, ctx: Contexto): Promise<string[]> {
    const c = await tx.contribuyente.findUnique({ where: { id: ctx.dj.contribuyenteId }, select: { updatedAt: true } });
    return c && c.updatedAt > ctx.dj.createdAt ? ['La ficha de la persona cambió después de presentar la DJ: se conserva la ficha, que es más reciente (L13)'] : [];
  }

  private resumenPlan(ctx: Contexto, r: Determinado, plan: PlanCuenta | undefined) {
    return {
      anio: r.anio,
      impuesto: n2(r.impuesto),
      derechoEmision: n2(r.derechoEmision),
      arbitrios: n2(r.arbitrios),
      predialCalculable: r.predialCalculable,
      crear: plan?.crear.length ?? 0,
      montoNuevo: n2((plan?.crear ?? []).reduce((t, c) => t.plus(c.importe).plus(c.derechoEmision), new D(0))),
      ajustes: plan?.crear.filter((c) => c.ajusteDeId !== null).length ?? 0,
      anular: plan?.anular.length ?? 0,
      sinCambio: plan?.sinCambio ?? 0,
      saldoAFavor: n2((plan?.saldoAFavor ?? []).reduce((t, s) => t.plus(s.importe), new D(0))),
      bloqueos: (plan?.bloqueos ?? []).map((b) => `${this.etiquetaGrupo(ctx, b)}: ${b.motivo}`),
      errores: r.errores,
      avisos: r.avisos,
    };
  }

  private etiquetaGrupo(ctx: Contexto, g: { tributoId: number; predioId: number | null }) {
    const tributo = ctx.codigoTributo.get(g.tributoId) ?? 'tributo';
    return g.predioId ? `${tributo} del predio #${g.predioId}` : tributo;
  }

  // ---- Cálculo ----

  private async calcular(tx: Tx, ctx: Contexto, anios: number[]): Promise<Determinado[]> {
    const resultados: Determinado[] = [];
    for (const anio of anios) {
      const params = await this.parametros(tx, ctx, anio);
      resultados.push(determinarAnio(params, this.prediosDelAnio(ctx, anio), this.persona(ctx, anio), { cuotasArbitrios: ctx.cuotasArbitrios, feriados: ctx.feriados }));
    }
    return resultados;
  }

  // Lo que rige para cada predio de la persona en el año, en este orden (J15: entran también los no
  // declarados en esta DJ, porque la base es el total, L01):
  // 1) su último anexo de DJ (liquidada, o esta) que ya rige ese año (J10, J11);
  // 2) lo que usó la determinación liquidada de ese año (la "copia por año" del predio);
  // 3) el padrón: titular al 1 de enero (predial) o en el mes (arbitrios), con los datos del predio.
  // Si otra DJ terminó su titularidad (p. ej. el comprador lo descargó como transferente), deja de regir.
  private prediosDelAnio(ctx: Contexto, anio: number): PredioDelAnio[] {
    const previa = ctx.previas.get(anio) ?? new Map<number, { origen: string; condicion: string | null; porcentaje: number; afectoPredial: boolean; datos: DatosGuardados }>();
    const ids = [...new Set([...ctx.decls.keys(), ...ctx.titularidad.keys(), ...previa.keys()])].sort((a, b) => a - b);
    const lista: PredioDelAnio[] = [];
    for (const predioId of ids) {
      const m = ctx.maestros.get(predioId);
      if (!m) continue;
      const decls = ctx.decls.get(predioId) ?? [];
      const t = ctx.titularidad.get(predioId);
      const p = previa.get(predioId);
      // Fin de la titularidad en el padrón. No pesa sobre un anexo presentado después (volvió a adquirirlo).
      const fin = t?.fechaFin ?? null;
      const terminoAntes = (presentado: string | null) => fin !== null && (presentado === null || presentado <= fin);
      const finAnio = fin ? Number(fin.slice(0, 4)) : null;
      const finMes = fin ? mesDesde(fin, anio, ctx.inicioArbitrios) : 13;

      let predial: { origen: string; porcentaje: number; condicion: string | null; declarado: Declarado } | null = null;
      const d = vigentePredial(decls, anio);
      if (d) {
        predial = d.descargo ? null : { origen: d.origen, porcentaje: d.porcentaje, condicion: d.condicion, declarado: d.declarado };
        if (predial && terminoAntes(d.fechaPresentacion) && finAnio! < anio) predial = null;
      } else if (p) {
        predial = p.afectoPredial ? { origen: p.origen, porcentaje: p.porcentaje, condicion: p.condicion, declarado: p.datos.declarado } : null;
        if (predial && finAnio !== null && finAnio < anio) predial = null;
      } else if (t && asociacionEnAnio(t, anio).contribuyenteDelAnio) {
        predial = { origen: 'Padrón', porcentaje: t.porcentaje, condicion: t.condicion, declarado: m.padron };
      }

      const meses: MesArbitrio[] = [];
      let declaradoArbitrios: Declarado | null = null;
      let origenArbitrios: string | null = null;
      for (let mes = 1; mes <= 12; mes++) {
        const da = vigenteArbitrios(decls, anio, mes);
        if (mes >= finMes && (!da || terminoAntes(da.fechaPresentacion))) continue;
        if (da) {
          if (!da.descargo) {
            meses.push({ mes, porcentaje: da.porcentaje, usos: usosDelMes(da.declarado.usos, anio, mes, ctx.inicioArbitrios) });
            declaradoArbitrios = da.declarado;
            origenArbitrios ??= da.origen;
          }
        } else if (p) {
          const previo = p.datos.meses.find((x) => x.mes === mes);
          if (previo) {
            meses.push(previo);
            origenArbitrios ??= p.origen;
          }
        } else if (t) {
          const empieza = t.fechaAdquisicion ? mesDesde(t.fechaAdquisicion, anio, ctx.inicioArbitrios) : 0;
          const finDesconocido = t.estado !== EstadoRegistro.ACTIVO && !t.fechaFin;
          if (!finDesconocido && empieza <= mes) {
            meses.push({ mes, porcentaje: t.porcentaje, usos: usosDelMes(m.padron.usos, anio, mes, ctx.inicioArbitrios) });
            origenArbitrios ??= 'Padrón';
          }
        }
      }
      if (!predial && meses.length === 0) continue;
      lista.push({
        predioId,
        origen: (predial?.origen ?? origenArbitrios ?? 'Padrón').slice(0, 60),
        condicion: predial?.condicion ?? t?.condicion ?? null,
        porcentaje: predial?.porcentaje ?? meses[0].porcentaje,
        afectoPredial: Boolean(predial),
        maestro: m.maestro,
        declarado: predial?.declarado ?? declaradoArbitrios ?? m.padron,
        meses,
        exoneracion: exoneracionPredio(m.resoluciones, anio),
      });
    }
    return lista;
  }

  private persona(ctx: Contexto, anio: number) {
    const rige = (regimen: string) => ctx.resolucionesPersona.find((r) => r.regimen === regimen && rigeEn(r, anio)) ?? null;
    return { inafecto: rige('INAFECTACION'), deduccion: rige('DEDUCCION'), exoneracion: rige('EXONERACION') };
  }

  private async parametros(tx: Tx, ctx: Contexto, anio: number): Promise<ParametrosV2> {
    const cache = ctx.parametros.get(anio);
    if (cache) return cache;
    const [uit, escala, aranceles, valoresUnitarios, depreciaciones, tarifas, rusticos] = await Promise.all([
      tx.uit.findUnique({ where: { anio } }),
      tx.escalaPredial.findMany({ where: { anio }, orderBy: { tramo: 'asc' } }),
      tx.arancel.findMany({ where: { anio } }),
      tx.valorUnitario.findMany({ where: { anio } }),
      tx.depreciacion.findMany({ where: { anio } }),
      tx.tarifaArbitrio.findMany({ where: { anio }, orderBy: { id: 'asc' } }),
      tx.arancelRustico.findMany({ where: { anio } }),
    ]);
    const p: ParametrosV2 = {
      anio,
      uit: uit?.valor ?? null,
      derechoEmision: uit?.derechoEmision ?? 0,
      escala,
      aranceles,
      valoresUnitarios,
      depreciaciones,
      tarifas,
      rusticos,
      conceptos: CONCEPTOS_ARBITRIO,
    };
    ctx.parametros.set(anio, p);
    return p;
  }

  // ---- Persistencia ----

  private async guardar(tx: Tx, ctx: Contexto, r: Determinado) {
    const detalle: DetalleGuardado = {
      huella: huellaDeterminado(r),
      cuotasPredial: r.cuotasPredial.map((c) => ({ cuota: c.cuota, importe: n2(c.importe), derechoEmision: n2(c.derechoEmision), vence: c.vence })),
      cuotasArbitrios: r.cuotasArbitrios.map((c) => ({ predioId: c.predioId, concepto: c.concepto, cuota: c.cuota, importe: n2(c.importe), vence: c.vence })),
      beneficios: r.beneficios,
      errores: r.errores,
      avisos: r.avisos,
    };
    const prediosDelAnio = new Map(this.prediosDelAnio(ctx, r.anio).map((p) => [p.predioId, p]));
    const det = await tx.determinacion.create({
      data: {
        contribuyenteId: ctx.dj.contribuyenteId,
        anio: r.anio,
        djId: ctx.dj.id,
        baseImponible: r.baseImponible,
        deduccion: r.deduccion,
        baseAfecta: r.baseAfecta,
        impuesto: r.impuesto,
        derechoEmision: r.derechoEmision,
        arbitrios: r.arbitrios,
        predialCalculable: r.predialCalculable,
        detalle: detalle as unknown as Prisma.InputJsonValue,
        predios: {
          create: r.predios.map((p) => {
            const entrada = prediosDelAnio.get(p.predioId)!;
            const ok = p.valor?.ok === true ? p.valor : null;
            const datos: DatosGuardados = { declarado: entrada.declarado, maestro: entrada.maestro, meses: entrada.meses, arancel: ok?.arancel ?? null, niveles: ok?.niveles ?? [] };
            return {
              predioId: p.predioId,
              tipo: entrada.maestro.tipo === 'RUSTICO' ? TipoPredio.RUSTICO : TipoPredio.URBANO,
              origen: p.origen,
              condicion: p.condicion,
              porcentaje: p.porcentaje,
              afectoPredial: p.afectoPredial,
              exoneracion: p.exoneracion,
              terreno: ok?.terreno ?? null,
              construccion: ok?.construccion ?? null,
              obras: ok?.obras ?? null,
              autoavaluo: ok?.autoavaluo ?? null,
              valorAfecto: p.valorAfecto,
              arbitrios: p.arbitrios,
              error: p.valor && !p.valor.ok ? p.valor.error.slice(0, 250) : null,
              datos: datos as unknown as Prisma.InputJsonValue,
            };
          }),
        },
      },
      select: { id: true },
    });
    if (r.arbitriosMes.length) {
      await tx.determinacionArbitrio.createMany({
        data: r.arbitriosMes.map((a) => ({ determinacionId: det.id, predioId: a.predioId, uso: a.uso.slice(0, 10), mes: a.mes, concepto: a.concepto, importe: a.importe })),
      });
    }
  }

  // ---- Padrón (titulares, predio y copia física) ----

  private async aplicarPadron(tx: Tx, ctx: Contexto, resultados: Determinado[], avisos: string[]): Promise<Aplicado> {
    const { dj } = ctx;
    const C = dj.contribuyenteId;
    const aplicado: Aplicado = (dj.aplicado as unknown as Aplicado | null) ?? { titulares: [], predios: [], copias: [], persona: null };
    const anotarTitular = async (contribuyenteId: number, predioId: number) => {
      if (aplicado.titulares.some((t) => t.contribuyenteId === contribuyenteId && t.predioId === predioId)) return;
      const fila = await tx.predioContribuyente.findUnique({ where: { contribuyenteId_predioId: { contribuyenteId, predioId } } });
      aplicado.titulares.push({
        contribuyenteId,
        predioId,
        antes: fila
          ? {
              porcentaje: fila.porcentaje.toString(),
              fechaAdquisicion: fila.fechaAdquisicion ? iso(fila.fechaAdquisicion) : null,
              fechaFin: fila.fechaFin ? iso(fila.fechaFin) : null,
              condicion: fila.condicion,
              esPrincipal: fila.esPrincipal,
              estado: fila.estado,
            }
          : null,
      });
      return fila;
    };
    const anotarPredio = (predioId: number, estado: EstadoRegistro) => {
      if (!aplicado.predios.some((p) => p.predioId === predioId)) aplicado.predios.push({ predioId, estado });
    };

    for (const a of dj.anexos) {
      const predio = await tx.predio.findUniqueOrThrow({ where: { id: a.predioId }, select: { estado: true } });
      const fila = await tx.predioContribuyente.findUnique({ where: { contribuyenteId_predioId: { contribuyenteId: C, predioId: a.predioId } } });
      await anotarTitular(C, a.predioId);
      if (a.fechaDescargo) {
        // J12: el descargo termina la titularidad; en una baja del predio sin otros titulares, el predio sale.
        if (fila) {
          await tx.predioContribuyente.update({
            where: { id: fila.id },
            data: { estado: EstadoRegistro.BAJA, fechaFin: a.fechaDescargo, esPrincipal: false },
          });
        }
        const otros = await tx.predioContribuyente.count({ where: { predioId: a.predioId, estado: EstadoRegistro.ACTIVO, contribuyenteId: { not: C } } });
        if (dj.motivo === 'BAJA' && otros === 0 && predio.estado !== EstadoRegistro.BAJA) {
          anotarPredio(a.predioId, predio.estado);
          await tx.predio.update({ where: { id: a.predioId }, data: { estado: EstadoRegistro.BAJA } });
        }
        continue;
      }
      if (predio.estado !== EstadoRegistro.ACTIVO) {
        anotarPredio(a.predioId, predio.estado);
        await tx.predio.update({ where: { id: a.predioId }, data: { estado: EstadoRegistro.ACTIVO } });
      }
      const otroPrincipal = await tx.predioContribuyente.count({
        where: { predioId: a.predioId, estado: EstadoRegistro.ACTIVO, esPrincipal: true, contribuyenteId: { not: C } },
      });
      const datos = {
        porcentaje: a.porcentaje,
        condicion: a.condicion,
        estado: EstadoRegistro.ACTIVO,
        fechaFin: null,
        fechaAdquisicion: a.fechaAdquisicion ?? fila?.fechaAdquisicion ?? null,
        esPrincipal: otroPrincipal === 0,
      };
      await tx.predioContribuyente.upsert({
        where: { contribuyenteId_predioId: { contribuyenteId: C, predioId: a.predioId } },
        update: datos,
        create: { contribuyenteId: C, predioId: a.predioId, ...datos },
      });
      // Quien transfiere deja de ser titular (J10: paga el año en curso): así el predio no se cobra dos veces.
      for (const x of a.adquirientes) {
        if (x.rol !== 'TRANSFERENTE' || !x.personaId || x.personaId === C) continue;
        const suya = await tx.predioContribuyente.findUnique({ where: { contribuyenteId_predioId: { contribuyenteId: x.personaId, predioId: a.predioId } } });
        if (suya?.estado !== EstadoRegistro.ACTIVO) continue;
        await anotarTitular(x.personaId, a.predioId);
        const fin = a.fechaAdquisicion ?? new Date(dj.fechaPresentacion);
        await tx.predioContribuyente.update({ where: { id: suya.id }, data: { estado: EstadoRegistro.BAJA, fechaFin: fin, esPrincipal: false } });
        // Su cuenta no se toca desde la DJ de otra persona: se corrige con su propio descargo.
        avisos.push(`${x.nombreCompleto} deja de ser titular del predio #${a.predioId} desde el ${iso(fin)}: su cuenta se corrige con su DJ de descargo`);
      }
      await this.actualizarCopia(tx, ctx, a, aplicado, resultados);
    }
    return aplicado;
  }

  // La copia física del predio (áreas, uso, pisos, instalaciones, autoavalúo) la leen el cálculo v1,
  // caja, valores y fiscalización: refleja la última DJ liquidada del predio.
  private async actualizarCopia(tx: Tx, ctx: Contexto, a: Contexto['dj']['anexos'][number], aplicado: Aplicado, resultados: Determinado[]) {
    const posterior = await tx.djAnexo.count({
      where: {
        predioId: a.predioId,
        id: { not: a.id },
        dj: { estado: EstadoDj.LIQUIDADA, id: { not: ctx.dj.id } },
        OR: [{ anioAfectacion: { gt: a.anioAfectacion } }, { anioAfectacion: a.anioAfectacion, dj: { fechaPresentacion: { gt: new Date(ctx.dj.fechaPresentacion) } } }],
      },
    });
    if (posterior) return;
    const actual = await tx.predio.findUniqueOrThrow({
      where: { id: a.predioId },
      select: { areaTerreno: true, areaConstruida: true, usoPredio: true, valorAutovaluo: true, pisos: true, otrasInstalaciones: true },
    });
    if (!aplicado.copias.some((c) => c.predioId === a.predioId)) {
      aplicado.copias.push({
        predioId: a.predioId,
        areaTerreno: actual.areaTerreno?.toString() ?? null,
        areaConstruida: actual.areaConstruida?.toString() ?? null,
        usoPredio: actual.usoPredio,
        valorAutovaluo: actual.valorAutovaluo?.toString() ?? null,
        pisos: actual.pisos.map(({ id: _i, predioId: _p, createdAt: _c, updatedAt: _u, ...p }) => ({ ...p, areaConstruida: p.areaConstruida?.toString() ?? null, valorUnitario: p.valorUnitario?.toString() ?? null, valorConstruccion: p.valorConstruccion?.toString() ?? null })),
        otras: actual.otrasInstalaciones.map(({ id: _i, predioId: _p, createdAt: _c, pisoId: _s, ...o }) => ({ ...o, cantidad: o.cantidad?.toString() ?? null, valor: o.valor?.toString() ?? null })),
      });
    }
    const ultimo = [...resultados].reverse().map((r) => r.predios.find((p) => p.predioId === a.predioId && p.valor?.ok)).find(Boolean);
    const predominante = a.usos.find((u) => u.predominante) ?? a.usos[0];
    await tx.otraInstalacion.deleteMany({ where: { predioId: a.predioId } });
    await tx.piso.deleteMany({ where: { predioId: a.predioId } });
    if (a.niveles.length) {
      await tx.piso.createMany({
        data: a.niveles.map((nv) => ({
          predioId: a.predioId,
          nivel: nv.nivel,
          anioConstruccion: nv.anioConstruccion,
          clasificacion: nv.clasificacion,
          material: nv.material,
          estadoConservacion: nv.estadoConservacion.slice(0, 15),
          categorias: nv.categorias,
          areaConstruida: new D(nv.areaPropia).plus(new D(nv.areaComun ?? 0).times(nv.participacion ?? 0).div(100)).toDecimalPlaces(2),
        })),
      });
    }
    if (a.obras.length) {
      await tx.otraInstalacion.createMany({
        data: a.obras.map((o) => ({ predioId: a.predioId, descripcion: o.descripcion, unidad: o.unidad, cantidad: o.cantidad, valor: o.valorDeclarado })),
      });
    }
    await tx.predio.update({
      where: { id: a.predioId },
      data: {
        areaTerreno: a.areaTerreno,
        areaConstruida: a.niveles.reduce((t, nv) => t.plus(nv.areaPropia), new D(0)),
        usoPredio: predominante?.uso ?? null,
        ...(ultimo?.valor?.ok ? { valorAutovaluo: ultimo.valor.autoavaluo } : {}),
      },
    });
  }

  // P03 (y P01): sin predios activos tras un descargo y sin deuda → inhabilitado; con predio → habilitado.
  private async estadoPersona(tx: Tx, ctx: Contexto, aplicado: Aplicado): Promise<string[]> {
    const C = ctx.dj.contribuyenteId;
    const [persona, activos, deuda] = await Promise.all([
      tx.contribuyente.findUniqueOrThrow({ where: { id: C }, select: { estado: true, motivoEstado: true, numDoc: true, excepcionAprobadaAt: true, nombreRevisado: true } }),
      tx.predioContribuyente.count({ where: { contribuyenteId: C, estado: EstadoRegistro.ACTIVO, predio: { estado: EstadoRegistro.ACTIVO } } }),
      tx.cuentaCorriente.count({ where: { contribuyenteId: C, estado: { in: DEUDA_VIVA } } }),
    ]);
    const r = estadoTrasLiquidar({
      estado: persona.estado,
      huboDescargo: ctx.dj.anexos.some((a) => a.fechaDescargo),
      prediosActivos: activos,
      tieneDeuda: deuda > 0,
      estadoAlHabilitar: estadoAlHabilitar(pendientesDe(persona)),
    });
    if (r.estado !== persona.estado) {
      aplicado.persona ??= { estado: persona.estado, motivoEstado: persona.motivoEstado };
      await tx.contribuyente.update({
        where: { id: C },
        data: {
          estado: r.estado as EstadoPersona,
          motivoEstado: r.estado === EstadoPersona.INHABILITADO ? `Sin predios desde la DJ ${numeroDj(ctx.dj.anio, ctx.dj.numero)} (P03)` : null,
        },
      });
    }
    return r.aviso ? [r.aviso] : [];
  }

  private async revertirPadron(tx: Tx, contribuyenteId: number, aplicado: Aplicado | null) {
    if (!aplicado) return;
    for (const t of [...aplicado.titulares].reverse()) {
      const where = { contribuyenteId_predioId: { contribuyenteId: t.contribuyenteId, predioId: t.predioId } };
      if (!t.antes) {
        // La creó la DJ: se quita (es la relación del padrón, no deuda; queda en la auditoría).
        await tx.predioContribuyente.deleteMany({ where: { contribuyenteId: t.contribuyenteId, predioId: t.predioId } });
        continue;
      }
      const a = t.antes as { porcentaje: string; fechaAdquisicion: string | null; fechaFin: string | null; condicion: string | null; esPrincipal: boolean; estado: EstadoRegistro };
      await tx.predioContribuyente.update({
        where,
        data: {
          porcentaje: a.porcentaje,
          fechaAdquisicion: a.fechaAdquisicion ? new Date(a.fechaAdquisicion) : null,
          fechaFin: a.fechaFin ? new Date(a.fechaFin) : null,
          condicion: a.condicion,
          esPrincipal: a.esPrincipal,
          estado: a.estado,
        },
      });
    }
    for (const p of aplicado.predios) await tx.predio.update({ where: { id: p.predioId }, data: { estado: p.estado } });
    for (const c of aplicado.copias) {
      await tx.otraInstalacion.deleteMany({ where: { predioId: c.predioId } });
      await tx.piso.deleteMany({ where: { predioId: c.predioId } });
      if (c.pisos.length) await tx.piso.createMany({ data: c.pisos.map((p) => ({ ...p, predioId: c.predioId })) as Prisma.PisoCreateManyInput[] });
      if (c.otras.length) await tx.otraInstalacion.createMany({ data: c.otras.map((o) => ({ ...o, predioId: c.predioId })) as Prisma.OtraInstalacionCreateManyInput[] });
      await tx.predio.update({
        where: { id: c.predioId },
        data: { areaTerreno: c.areaTerreno, areaConstruida: c.areaConstruida, usoPredio: c.usoPredio, valorAutovaluo: c.valorAutovaluo },
      });
    }
    if (aplicado.persona) await tx.contribuyente.update({ where: { id: contribuyenteId }, data: aplicado.persona });
  }

  // ---- Carga ----

  // Bloquea la fila de la DJ hasta el fin de la transacción: dos liquidaciones a la vez no se cruzan.
  private async bloquear(tx: Tx, djId: number) {
    const filas = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM dj_presentadas WHERE id = ${djId} FOR UPDATE`;
    if (!filas.length) throw new NotFoundException('La declaración no existe');
  }

  private async contexto(tx: Tx, djId: number) {
    const fila = await tx.djPresentada.findUnique({
      where: { id: djId },
      select: {
        id: true,
        anio: true,
        numero: true,
        contribuyenteId: true,
        motivo: true,
        tipo: true,
        estado: true,
        fechaPresentacion: true,
        creadoPorId: true,
        createdAt: true,
        revisionVence: true,
        revisionResueltaAt: true,
        liquidadaAt: true,
        aplicado: true,
        anexos: { include: { niveles: { orderBy: { orden: 'asc' } }, obras: { orderBy: { orden: 'asc' } }, usos: { orderBy: { orden: 'asc' } }, rusticos: true, adquirientes: true }, orderBy: { numero: 'asc' } },
      },
    });
    if (!fila) throw new NotFoundException('La declaración no existe');
    const dj = { ...fila, fechaPresentacion: iso(fila.fechaPresentacion), revisionVence: fila.revisionVence ? iso(fila.revisionVence) : null };
    const C = dj.contribuyenteId;
    const anioActual = Number(hoyLima().slice(0, 4));

    const reabierta = await tx.djPresentada.findFirst({
      where: { contribuyenteId: C, id: { not: djId }, liquidadaAt: { not: null }, estado: { in: [EstadoDj.PENDIENTE, EstadoDj.EN_REVISION] } },
      select: { anio: true, numero: true },
    });
    if (reabierta) {
      throw new ConflictException(`La DJ ${numeroDj(reabierta.anio, reabierta.numero)} de la persona está reabierta: liquídala o anúlala antes de determinar otra`);
    }

    // Lo declarado que rige: DJ liquidadas de la persona y la que se determina.
    const djs = await tx.djPresentada.findMany({
      where: { contribuyenteId: C, OR: [{ estado: EstadoDj.LIQUIDADA }, { id: djId }] },
      select: {
        id: true,
        anio: true,
        numero: true,
        fechaPresentacion: true,
        anexos: { include: { niveles: { orderBy: { orden: 'asc' } }, obras: { orderBy: { orden: 'asc' } }, usos: { orderBy: { orden: 'asc' } }, rusticos: { orderBy: { orden: 'asc' } } } },
      },
    });
    const decls = new Map<number, DeclaracionPredio[]>();
    for (const d of djs) {
      for (const a of d.anexos) {
        const lista = decls.get(a.predioId) ?? [];
        lista.push({
          djId: d.id,
          origen: `DJ ${numeroDj(d.anio, d.numero)} · anexo ${a.numero}`,
          fechaPresentacion: iso(d.fechaPresentacion),
          orden: a.id,
          descargo: a.fechaDescargo !== null,
          anioAfectacion: a.anioAfectacion,
          fechaArbitrios: iso(a.fechaAfectacionArbitrios),
          porcentaje: Number(a.porcentaje),
          condicion: a.condicion,
          declarado: {
            areaTerreno: Number(a.areaTerreno),
            areaComun: n(a.areaComun),
            niveles: a.niveles.map((v) => ({
              nivel: v.nivel,
              anioConstruccion: v.anioConstruccion,
              clasificacion: v.clasificacion,
              material: v.material,
              estadoConservacion: v.estadoConservacion,
              categorias: v.categorias,
              areaPropia: Number(v.areaPropia),
              areaComun: n(v.areaComun),
              participacion: n(v.participacion),
            })),
            obras: a.obras.map((o) => ({ descripcion: o.descripcion, cantidad: Number(o.cantidad), valorDeclarado: n(o.valorDeclarado) })),
            usos: a.usos.map((u) => ({
              uso: u.uso,
              subUso: u.subUso,
              area: Number(u.area),
              frontis: n(u.frontis),
              participacion: n(u.participacion),
              fechaInicio: u.fechaInicio ? iso(u.fechaInicio) : null,
              fechaFin: u.fechaFin ? iso(u.fechaFin) : null,
              predominante: u.predominante,
            })),
            rusticos: a.rusticos.map((r) => ({ categoria: r.categoria, clasificacion: r.clasificacion, hectareas: Number(r.hectareas) })),
          },
        });
        decls.set(a.predioId, lista);
      }
    }
    const anios = aniosADeterminar(
      dj.anexos.map((a) => ({ anioAfectacion: a.anioAfectacion, fechaArbitrios: iso(a.fechaAfectacionArbitrios) })),
      anioActual,
    );

    const [filasTitular, previasFilas, beneficios, catalogoBeneficio, feriados, tributos, cuotasArbitrios, inicioArbitrios] = await Promise.all([
      tx.predioContribuyente.findMany({ where: { contribuyenteId: C } }),
      tx.determinacion.findMany({
        where: { contribuyenteId: C, estado: EstadoDeterminacion.LIQUIDADA, anio: { in: anios } },
        select: { anio: true, predios: { select: { predioId: true, origen: true, condicion: true, porcentaje: true, afectoPredial: true, datos: true } } },
      }),
      tx.contribuyenteBeneficio.findMany({ where: { contribuyenteId: C } }),
      tx.catalogo.findMany({ where: { grupo: GrupoCatalogo.BENEFICIO }, select: { codigo: true, nombre: true, atributos: true } }),
      tx.feriado.findMany({ select: { fecha: true } }),
      tx.tributo.findMany({ where: { codigo: { in: ['PREDIAL', ...CONCEPTOS_ARBITRIO] }, tipo: { in: [TipoTributo.PREDIAL, TipoTributo.ARBITRIOS] } }, select: { id: true, codigo: true } }),
      this.catalogos.valorRegla<number[][]>('arbitrios.cuotas', tx),
      this.catalogos.valorRegla<InicioArbitrios>('arbitrios.inicioAfectacion', tx),
    ]);
    if (tributos.length !== CONCEPTOS_ARBITRIO.length + 1) {
      throw new BadRequestException('Faltan tributos de rentas en la base: ejecuta "npx prisma db seed"');
    }
    const titularidad = new Map(
      filasTitular.map((t) => [
        t.predioId,
        {
          contribuyenteId: C,
          fechaAdquisicion: t.fechaAdquisicion ? iso(t.fechaAdquisicion) : null,
          fechaFin: t.fechaFin ? iso(t.fechaFin) : null,
          estado: t.estado,
          porcentaje: Number(t.porcentaje),
          condicion: t.condicion,
        },
      ]),
    );
    const previas = new Map<number, Map<number, { origen: string; condicion: string | null; porcentaje: number; afectoPredial: boolean; datos: DatosGuardados }>>();
    for (const p of previasFilas) {
      previas.set(p.anio, new Map(p.predios.map((x) => [x.predioId, { ...x, porcentaje: Number(x.porcentaje), datos: x.datos as unknown as DatosGuardados }])));
    }
    const atributos = new Map(catalogoBeneficio.map((c) => [c.codigo, { nombre: c.nombre, ...((c.atributos ?? {}) as { regimen?: string; deduccionUit?: number; porcentaje?: number }) }]));
    const resolucionesPersona: Resolucion[] = beneficios.map((b) => {
      const a = atributos.get(b.codigo);
      return {
        regimen: a?.regimen,
        nombre: a?.nombre ?? b.codigo,
        resolucion: b.resolucion,
        porcentaje: a?.porcentaje ?? null,
        deduccionUit: a?.deduccionUit ?? null,
        anioDesde: b.anioDesde,
        anioHasta: b.anioHasta,
        vigente: b.vigente,
      };
    });

    const predioIds = [...new Set([...decls.keys(), ...titularidad.keys(), ...previasFilas.flatMap((p) => p.predios.map((x) => x.predioId))])];
    const predios = await tx.predio.findMany({
      where: { id: { in: predioIds } },
      select: {
        id: true,
        tipo: true,
        viaId: true,
        urbanizacionId: true,
        zonaId: true,
        frecuenciaBarrido: true,
        ubicacionParque: true,
        frontis: true,
        areaTerreno: true,
        areaConstruida: true,
        usoPredio: true,
        pisos: { orderBy: { nivel: 'asc' } },
        otrasInstalaciones: { orderBy: { id: 'asc' } },
        beneficios: true,
      },
    });
    const maestros = new Map(
      predios.map((p) => {
        const maestro: Maestro = {
          tipo: p.tipo,
          viaId: p.viaId,
          urbanizacionId: p.urbanizacionId,
          zonaId: p.zonaId,
          frecuenciaBarrido: p.frecuenciaBarrido,
          ubicacionParque: p.ubicacionParque,
          frontis: n(p.frontis),
        };
        // Padrón (v1): los datos actuales del predio, como los usa el cálculo v1.
        const padron: Declarado = {
          areaTerreno: Number(p.areaTerreno ?? 0),
          areaComun: null,
          niveles: p.pisos.map((pi) => ({
            nivel: pi.nivel,
            anioConstruccion: pi.anioConstruccion,
            clasificacion: pi.clasificacion ?? '',
            material: pi.material ?? '',
            estadoConservacion: pi.estadoConservacion ?? '',
            categorias: pi.categorias ?? '',
            areaPropia: Number(pi.areaConstruida ?? 0),
            areaComun: null,
            participacion: null,
          })),
          obras: p.otrasInstalaciones.map((o) => ({ descripcion: o.descripcion, cantidad: Number(o.cantidad ?? 1), valorDeclarado: n(o.valor) })),
          usos: [
            {
              uso: p.usoPredio ?? '',
              subUso: null,
              area: Number(p.areaConstruida ?? 0) || Number(p.areaTerreno ?? 0),
              frontis: null,
              participacion: null,
              fechaInicio: null,
              fechaFin: null,
              predominante: true,
            },
          ],
          rusticos: [],
        };
        const resoluciones: Resolucion[] = p.beneficios.map((b) => ({
          regimen: atributos.get(b.codigo)?.regimen,
          nombre: atributos.get(b.codigo)?.nombre ?? b.codigo,
          resolucion: b.resolucion,
          porcentaje: Number(b.porcentaje),
          anioDesde: b.anioDesde,
          anioHasta: b.anioHasta,
          vigente: b.vigente,
        }));
        return [p.id, { maestro, padron, resoluciones }];
      }),
    );

    return {
      dj,
      anioActual,
      anios,
      decls,
      titularidad,
      previas,
      maestros,
      resolucionesPersona,
      feriados: new Set(feriados.map((f) => iso(f.fecha))),
      tributos: new Map(tributos.map((t) => [t.codigo, t.id])),
      codigoTributo: new Map(tributos.map((t) => [t.id, t.codigo])),
      cuotasArbitrios,
      inicioArbitrios,
      parametros: new Map<number, ParametrosV2>(),
    };
  }

  private include() {
    return {
      dj: { select: { id: true, anio: true, numero: true } },
      predios: {
        orderBy: { predioId: 'asc' as const },
        include: { predio: { select: { id: true, nombre: true, codigoCatastro: true, direccion: { select: { direccion: true } } } } },
      },
      arbitriosMes: { orderBy: [{ predioId: 'asc' as const }, { concepto: 'asc' as const }, { mes: 'asc' as const }] },
    } satisfies Prisma.DeterminacionInclude;
  }

  private serializar(f: Prisma.DeterminacionGetPayload<{ include: ReturnType<DeterminacionService['include']> }>) {
    const detalle = f.detalle as unknown as DetalleGuardado;
    // Arbitrios por predio y concepto: los 12 meses y sus cuotas.
    const porClave = new Map<string, { predioId: number; concepto: string; usos: Set<string>; meses: Dec[] }>();
    for (const a of f.arbitriosMes) {
      const k = `${a.predioId}|${a.concepto}`;
      const fila = porClave.get(k) ?? { predioId: a.predioId, concepto: a.concepto, usos: new Set<string>(), meses: Array.from({ length: 12 }, () => new D(0)) };
      fila.usos.add(a.uso);
      fila.meses[a.mes - 1] = fila.meses[a.mes - 1].plus(a.importe);
      porClave.set(k, fila);
    }
    return {
      id: f.id,
      anio: f.anio,
      estado: f.estado,
      dj: f.dj ? { id: f.dj.id, numeroTexto: numeroDj(f.dj.anio, f.dj.numero) } : null,
      baseImponible: n2(f.baseImponible),
      deduccion: n2(f.deduccion),
      baseAfecta: n2(f.baseAfecta),
      impuesto: n2(f.impuesto),
      derechoEmision: n2(f.derechoEmision),
      arbitrios: n2(f.arbitrios),
      predialCalculable: f.predialCalculable,
      liquidaPredial: f.liquidaPredial,
      liquidaArbitrios: f.liquidaArbitrios,
      liquidadaAt: f.liquidadaAt,
      createdAt: f.createdAt,
      cuotasPredial: detalle.cuotasPredial,
      beneficios: detalle.beneficios,
      errores: detalle.errores,
      avisos: detalle.avisos,
      saldoAFavor: detalle.saldoAFavor ?? [],
      predios: f.predios.map((p) => {
        const datos = p.datos as unknown as DatosGuardados;
        return {
          predioId: p.predioId,
          direccion: p.predio.direccion?.direccion ?? p.predio.nombre ?? `Predio #${p.predioId}`,
          codigoCatastro: p.predio.codigoCatastro,
          tipo: p.tipo,
          origen: p.origen,
          condicion: p.condicion,
          porcentaje: p.porcentaje.toString(),
          afectoPredial: p.afectoPredial,
          exoneracion: p.exoneracion.toString(),
          terreno: p.terreno?.toFixed(2) ?? null,
          construccion: p.construccion?.toFixed(2) ?? null,
          obras: p.obras?.toFixed(2) ?? null,
          autoavaluo: p.autoavaluo?.toFixed(2) ?? null,
          valorAfecto: n2(p.valorAfecto),
          arbitrios: n2(p.arbitrios),
          error: p.error,
          arancel: datos.arancel,
          niveles: datos.niveles,
          meses: datos.meses.map((m) => m.mes),
        };
      }),
      arbitriosPorMes: [...porClave.values()].map((a) => ({
        predioId: a.predioId,
        concepto: a.concepto,
        usos: [...a.usos],
        meses: a.meses.map((m) => m.toFixed(2)),
        cuotas: detalle.cuotasArbitrios.filter((c) => c.predioId === a.predioId && c.concepto === a.concepto),
      })),
    };
  }
}
