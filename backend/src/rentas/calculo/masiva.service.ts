import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { EstadoCuenta, EstadoDeterminacion, EstadoDj, EstadoRegistro, GrupoCatalogo, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload.type.js';
import { CatalogosService } from '../../catalogos/catalogos.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CONCEPTOS_ARBITRIO } from '../catalogos-construccion.js';
import { reservarCorrelativos } from '../correlativos.js';
import { anioValido } from '../maestros/maestros.reglas.js';
import {
  SIN_EFECTO_CUENTA,
  cargarComun,
  cargarPersonas,
  cuentasActuales,
  detalleDe,
  guardarDeterminaciones,
  n2,
  parametrosDelAnio,
  prediosDelAnio,
  resolucionesDelAnio,
  type Comun,
  type ContextoPersona,
  type Liquidada,
  type Sustitucion,
} from './contexto-determinacion.js';
import { determinarAnio, huellaDeterminado, type Declarado, type Determinado, type ParametrosV2, type PredioDelAnio } from './determinacion.reglas.js';
import { planificarCuenta, type CuentaActual, type LineaNueva, type PlanCuenta, type Tributo } from './reliquidacion.reglas.js';

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;

// La masiva escribe miles de filas por lotes; con la latencia a Supabase necesita margen.
const OPCIONES_TX = { maxWait: 10_000, timeout: 300_000 };
const LOTE = 300;
const TODOS: Tributo[] = ['PREDIAL', 'ARBITRIOS'];
// Cuántos años atrás se busca la última determinación para arrastrarla (J09).
const ANIOS_ATRAS = 10;

export interface EntradaMasiva {
  anio: number;
  contribuyenteId?: number;
  tributos?: Tributo[];
}

type ClaseExclusion = 'DJ_PENDIENTE' | 'RIGE_DJ' | 'BLOQUEO';

type Evaluacion =
  | { contribuyenteId: number; tipo: 'EXCLUIDO'; clase: ClaseExclusion; motivo: string; vigente: Liquidada | null }
  | { contribuyenteId: number; tipo: 'VACIO' }
  | {
      contribuyenteId: number;
      tipo: 'DETERMINADO' | 'SIN_CAMBIO';
      r: Determinado;
      entradas: PredioDelAnio[];
      plan: PlanCuenta;
      alcance: CuentaActual[]; // la cuenta que el plan compara (para saber el tributo de lo que anula)
      liquidaPredial: boolean;
      liquidaArbitrios: boolean;
      anterior: Liquidada | null;
    };

type Hecha = Extract<Evaluacion, { plan: PlanCuenta }>;

// Determinación anual masiva (specs/rentas-nucleo-v2.md, Fase 6; J09): la actualización anual de
// valores. Por cada persona, lo que rige el año nuevo (sus DJ, o su última determinación tal como
// estaba en diciembre, o el padrón) con los parámetros del año nuevo; se liquida como una DJ (L09,
// L10, L12). Reemplaza al cálculo masivo e individual de v1 y reusa simular/ejecutar. No toca el año
// de quien ya lo tiene determinado desde una DJ ni de quien tiene una DJ pendiente que lo toca.
@Injectable()
export class DeterminacionMasivaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogos: CatalogosService,
  ) {}

  simular(entrada: EntradaMasiva, usuario: AuthenticatedUser) {
    this.autorizar(entrada, usuario);
    return this.prisma.$transaction(async (tx) => this.respuesta(entrada, await this.evaluar(tx, entrada), false), OPCIONES_TX);
  }

  // Todo o nada (L12): determinaciones, cuenta corriente y autoavalúo del predio.
  ejecutar(entrada: EntradaMasiva, usuario: AuthenticatedUser) {
    this.autorizar(entrada, usuario);
    return this.prisma.$transaction(async (tx) => {
      const evaluado = await this.evaluar(tx, entrada);
      await this.escribir(tx, entrada.anio, evaluado.evaluaciones, evaluado.comun);
      return this.respuesta(entrada, evaluado, true);
    }, OPCIONES_TX);
  }

  // Para emitir valores (specs/rentas-valores-v1.md, V8): a quién no se le emite porque su deuda del año
  // cambiaría al determinar, no se puede calcular o tiene una DJ pendiente; y la base de la OP.
  async revisarParaEmision(tx: Tx, anio: number, tipos: Tributo[], contribuyenteId?: number) {
    const { evaluaciones, comun } = await this.evaluar(tx, { anio, contribuyenteId, tributos: tipos });
    const idPredial = comun.tributos.get('PREDIAL')!;
    const pendientes = new Map<number, Set<Tributo>>();
    const bases = new Map<number, Prisma.Decimal>();
    const marcar = (cid: number, t: Tributo) => pendientes.set(cid, new Set([...(pendientes.get(cid) ?? []), t]));
    for (const e of evaluaciones) {
      if (e.tipo === 'VACIO') continue;
      if (e.tipo === 'EXCLUIDO') {
        if (e.clase === 'RIGE_DJ') {
          if (e.vigente?.liquidaPredial) bases.set(e.contribuyenteId, e.vigente.baseAfecta);
        } else for (const t of tipos) marcar(e.contribuyenteId, t);
        continue;
      }
      if (e.r.predialCalculable) bases.set(e.contribuyenteId, e.r.baseAfecta);
      else if (tipos.includes('PREDIAL')) marcar(e.contribuyenteId, 'PREDIAL');
      const tributoDe = new Map(e.alcance.map((c) => [c.id, c.tributoId]));
      for (const tributoId of [...e.plan.crear.map((c) => c.tributoId), ...e.plan.anular.map((id) => tributoDe.get(id))]) {
        marcar(e.contribuyenteId, tributoId === idPredial ? 'PREDIAL' : 'ARBITRIOS');
      }
    }
    return { pendientes, bases };
  }

  // Fiscalización (specs/rentas-fiscalizacion-v1.md, F4): lo que se determinaría para la persona y el
  // año con la ficha de inspección en lugar de lo declarado. No escribe.
  async lineasFiscalizacion(tx: Tx, anio: number, contribuyenteId: number, sustituir: Sustitucion) {
    const comun = await cargarComun(tx, this.catalogos);
    const persona = (await cargarPersonas(tx, comun, [contribuyenteId], { hasta: anio })).get(contribuyenteId)!;
    const params = await parametrosDelAnio(tx, comun, anio);
    const r = determinarAnio(params, prediosDelAnio(comun, persona, anio, sustituir), resolucionesDelAnio(persona, anio), {
      cuotasArbitrios: comun.cuotasArbitrios,
      feriados: comun.feriados,
    });
    if (!r.predialCalculable) throw new BadRequestException(`No se puede valorizar ${anio}: ${r.errores[0] ?? 'faltan datos del predio'}`);
    const idPredial = comun.tributos.get('PREDIAL')!;
    const lineas = [
      ...r.cuotasPredial.map((c) => ({ predioId: null as number | null, tributoId: idPredial, cuota: c.cuota, importe: c.importe })),
      ...r.cuotasArbitrios.map((c) => ({ predioId: c.predioId as number | null, tributoId: comun.tributos.get(c.concepto)!, cuota: c.cuota, importe: c.importe })),
    ];
    return { lineas, tributos: comun.tributos, base: r.baseAfecta };
  }

  // Resolución de una fiscalización: su ficha entra a la cadena de lo declarado como una DJ de motivo
  // FISCALIZACION ya liquidada (la cuenta la corrigió la fiscalización con su RD), para que las
  // determinaciones siguientes partan de lo fiscalizado. Rige desde el año de la resolución.
  async registrarDjFiscalizacion(tx: Tx, e: { contribuyenteId: number; referencia: string; fecha: string; predios: { predioId: number; declarado: Declarado }[] }) {
    const anio = Number(e.fecha.slice(0, 4));
    const [motivo, persona, titulares] = await Promise.all([
      tx.catalogo.findUnique({ where: { grupo_codigo: { grupo: GrupoCatalogo.MOTIVO_DJ, codigo: 'FISCALIZACION' } }, select: { atributos: true } }),
      tx.contribuyente.findUniqueOrThrow({
        where: { id: e.contribuyenteId },
        select: { id: true, tipoPersona: true, tipoDoc: true, numDoc: true, nombreCompleto: true, direccionFiscal: true },
      }),
      tx.predioContribuyente.findMany({ where: { contribuyenteId: e.contribuyenteId, predioId: { in: e.predios.map((p) => p.predioId) } } }),
    ]);
    const [numero] = await reservarCorrelativos(tx, 'DJ', anio);
    const titular = new Map(titulares.map((t) => [t.predioId, t]));
    const dj = await tx.djPresentada.create({
      data: {
        anio,
        numero: Number(numero),
        contribuyenteId: e.contribuyenteId,
        motivo: 'FISCALIZACION',
        tipo: (motivo?.atributos as { tipo?: string } | null)?.tipo ?? 'DECLARATIVA',
        fechaPresentacion: new Date(e.fecha),
        persona: persona as unknown as Prisma.InputJsonValue,
        estado: EstadoDj.LIQUIDADA,
        liquidadaAt: new Date(),
        observacion: `Resultado de la ${e.referencia}`.slice(0, 250),
        anexos: {
          create: e.predios.map((p, i) => {
            const t = titular.get(p.predioId);
            return {
              numero: i + 1,
              predioId: p.predioId,
              condicion: t?.condicion ?? 'PROPIETARIO_UNICO',
              porcentaje: t?.porcentaje ?? 100,
              anioAfectacion: anio,
              fechaAfectacionArbitrios: new Date(`${anio}-01-01`),
              areaTerreno: p.declarado.areaTerreno,
              observacion: e.referencia.slice(0, 250),
              niveles: {
                create: p.declarado.niveles.map((v, j) => ({
                  orden: j + 1,
                  nivel: v.nivel.slice(0, 10),
                  anioConstruccion: v.anioConstruccion,
                  clasificacion: v.clasificacion,
                  material: v.material,
                  estadoConservacion: v.estadoConservacion,
                  categorias: v.categorias,
                  areaPropia: v.areaPropia,
                })),
              },
              obras: {
                create: p.declarado.obras.map((o, j) => ({ orden: j + 1, descripcion: o.descripcion.slice(0, 120), cantidad: o.cantidad, valorDeclarado: o.valorDeclarado })),
              },
              usos: {
                create: p.declarado.usos.map((u, j) => ({ orden: j + 1, uso: u.uso.slice(0, 10), area: u.area, predominante: u.predominante })),
              },
            };
          }),
        },
      },
      select: { id: true },
    });
    return dj.id;
  }

  // ---- Evaluación ----

  private autorizar(entrada: EntradaMasiva, usuario: AuthenticatedUser) {
    if (!anioValido(entrada.anio)) throw new BadRequestException('El año no es válido');
    if (!entrada.contribuyenteId && !usuario.niveles.includes('rentas.calculo-masivo')) {
      throw new ForbiddenException('La determinación masiva requiere el nivel "Cálculo Masivo"');
    }
  }

  private async evaluar(tx: Tx, entrada: EntradaMasiva) {
    const { anio, contribuyenteId } = entrada;
    const tipos = entrada.tributos?.length ? TODOS.filter((t) => entrada.tributos!.includes(t)) : TODOS;
    const comun = await cargarComun(tx, this.catalogos);
    const params = await parametrosDelAnio(tx, comun, anio);
    if (tipos.includes('PREDIAL') && (params.uit === null || params.escala.length === 0)) {
      throw new BadRequestException(`Faltan la UIT o la escala predial ${anio}: complétalas en Maestros`);
    }
    if (tipos.includes('ARBITRIOS') && params.tarifas.length === 0) {
      throw new BadRequestException(`No hay tarifas de arbitrios ${anio}: regístralas en Maestros`);
    }
    const idPredial = comun.tributos.get('PREDIAL')!;
    const tributoIds = [...(tipos.includes('PREDIAL') ? [idPredial] : []), ...(tipos.includes('ARBITRIOS') ? CONCEPTOS_ARBITRIO.map((c) => comun.tributos.get(c)!) : [])];
    const ids = contribuyenteId ? [contribuyenteId] : await this.universo(tx, anio, tributoIds);
    const evaluaciones: Evaluacion[] = [];
    for (let i = 0; i < ids.length; i += LOTE) {
      const lote = ids.slice(i, i + LOTE);
      const personas = await cargarPersonas(tx, comun, lote, { hasta: anio, desde: anio - ANIOS_ATRAS });
      const cuentas = await cuentasActuales(tx, lote, anio, tributoIds);
      for (const cid of lote) evaluaciones.push(this.evaluarPersona(comun, params, personas.get(cid)!, cuentas.get(cid) ?? [], tipos));
    }
    return { evaluaciones, comun, tipos };
  }

  // Quiénes pueden tener predial o arbitrios en el año: titulares vigentes (o que dejaron de serlo en el
  // año o después), quien tiene DJ liquidadas o determinaciones, y quien ya tiene cuenta del año.
  private async universo(tx: Tx, anio: number, tributoIds: number[]) {
    const inicio = new Date(`${anio}-01-01`);
    const [titulares, conDj, conCuenta, conDeterminacion] = await Promise.all([
      tx.predioContribuyente.findMany({ where: { OR: [{ estado: EstadoRegistro.ACTIVO }, { fechaFin: { gte: inicio } }] }, select: { contribuyenteId: true }, distinct: ['contribuyenteId'] }),
      tx.djPresentada.findMany({ where: { estado: EstadoDj.LIQUIDADA }, select: { contribuyenteId: true }, distinct: ['contribuyenteId'] }),
      tx.cuentaCorriente.findMany({
        where: { anioFiscal: anio, tributoId: { in: tributoIds }, estado: { notIn: SIN_EFECTO_CUENTA } },
        select: { contribuyenteId: true },
        distinct: ['contribuyenteId'],
      }),
      tx.determinacion.findMany({ where: { estado: EstadoDeterminacion.LIQUIDADA, anio: { lte: anio, gte: anio - ANIOS_ATRAS } }, select: { contribuyenteId: true }, distinct: ['contribuyenteId'] }),
    ]);
    return [...new Set([...titulares, ...conDj, ...conCuenta, ...conDeterminacion].map((x) => x.contribuyenteId))].sort((a, b) => a - b);
  }

  private evaluarPersona(comun: Comun, params: ParametrosV2, p: ContextoPersona, actuales: CuentaActual[], tipos: Tributo[]): Evaluacion {
    const anio = params.anio;
    const cid = p.contribuyenteId;
    const vigente = p.liquidadas.get(anio) ?? null;
    const reabierta = p.pendientes.find((d) => d.reabierta);
    if (reabierta) return { contribuyenteId: cid, tipo: 'EXCLUIDO', clase: 'DJ_PENDIENTE', motivo: `La DJ ${reabierta.numero} está reabierta: liquídala o anúlala`, vigente };
    const pendiente = p.pendientes.find((d) => d.desde <= anio);
    if (pendiente) {
      return { contribuyenteId: cid, tipo: 'EXCLUIDO', clase: 'DJ_PENDIENTE', motivo: `Tiene la DJ ${pendiente.numero} pendiente que toca ${anio}: se determina al liquidarla`, vigente };
    }
    if (vigente?.djId) {
      return { contribuyenteId: cid, tipo: 'EXCLUIDO', clase: 'RIGE_DJ', motivo: `El ${anio} lo determinó su DJ ${vigente.dj}: se corrige con otra DJ`, vigente };
    }
    const entradas = prediosDelAnio(comun, p, anio);
    if (entradas.length === 0 && actuales.length === 0 && !vigente) return { contribuyenteId: cid, tipo: 'VACIO' };
    const r = determinarAnio(params, entradas, resolucionesDelAnio(p, anio), { cuotasArbitrios: comun.cuotasArbitrios, feriados: comun.feriados });

    // V06: sin poder valorizar, el predial de la persona no se toca (los arbitrios sí).
    const liquidaPredial = tipos.includes('PREDIAL') && r.predialCalculable;
    const liquidaArbitrios = tipos.includes('ARBITRIOS');
    const idPredial = comun.tributos.get('PREDIAL')!;
    const nuevas: LineaNueva[] = [
      ...(liquidaPredial ? r.cuotasPredial.map((c) => ({ tributoId: idPredial, predioId: null, cuota: c.cuota, importe: c.importe, derechoEmision: c.derechoEmision, vence: c.vence })) : []),
      ...(liquidaArbitrios
        ? r.cuotasArbitrios.map((c) => ({ tributoId: comun.tributos.get(c.concepto)!, predioId: c.predioId, cuota: c.cuota, importe: c.importe, derechoEmision: new D(0), vence: c.vence }))
        : []),
    ];
    const alcance = actuales.filter((c) => (c.tributoId === idPredial ? liquidaPredial : liquidaArbitrios));
    const grupos = [
      ...(liquidaPredial ? [{ tributoId: idPredial, predioId: null }] : []),
      ...nuevas.filter((x) => x.predioId !== null),
      ...alcance.filter((x) => x.tributoId !== idPredial),
    ].map((g) => ({ tributoId: g.tributoId, predioId: g.predioId }));
    const plan = planificarCuenta(nuevas, alcance, grupos);
    if (plan.bloqueos.length) {
      const b = plan.bloqueos[0];
      const tributo = comun.codigoTributo.get(b.tributoId) ?? 'tributo';
      return { contribuyenteId: cid, tipo: 'EXCLUIDO', clase: 'BLOQUEO', motivo: `${tributo}${b.predioId ? ` del predio #${b.predioId}` : ''}: ${b.motivo}`, vigente };
    }
    const igual = vigente !== null && vigente.huella === huellaDeterminado(r) && plan.crear.length === 0 && plan.anular.length === 0;
    return { contribuyenteId: cid, tipo: igual ? 'SIN_CAMBIO' : 'DETERMINADO', r, entradas, plan, alcance, liquidaPredial, liquidaArbitrios, anterior: vigente };
  }

  // ---- Escritura ----

  private async escribir(tx: Tx, anio: number, evaluaciones: Evaluacion[], comun: Comun) {
    const nuevas = evaluaciones.filter((e): e is Hecha => e.tipo === 'DETERMINADO');
    if (nuevas.length === 0) return;
    const reemplazadas = nuevas.map((e) => e.anterior?.id).filter((id): id is number => typeof id === 'number');
    for (let i = 0; i < reemplazadas.length; i += 1000) {
      await tx.determinacion.updateMany({ where: { id: { in: reemplazadas.slice(i, i + 1000) }, estado: EstadoDeterminacion.LIQUIDADA }, data: { estado: EstadoDeterminacion.REEMPLAZADA } });
    }
    const ahora = new Date();
    const ids = await guardarDeterminaciones(
      tx,
      nuevas.map((e) => ({
        contribuyenteId: e.contribuyenteId,
        djId: null,
        estado: EstadoDeterminacion.LIQUIDADA,
        r: e.r,
        entradas: e.entradas,
        liquidaPredial: e.liquidaPredial,
        liquidaArbitrios: e.liquidaArbitrios,
        liquidadaAt: ahora,
        detalle: {
          ...detalleDe(e.r),
          masiva: true,
          anuladas: e.plan.anular,
          saldoAFavor: e.plan.saldoAFavor.map((s) => ({ tributo: comun.codigoTributo.get(s.tributoId) ?? '', predioId: s.predioId, importe: n2(s.importe) })),
          reemplazaA: e.anterior?.id ?? null,
        },
      })),
    );
    const anular = nuevas.flatMap((e) => e.plan.anular);
    for (let i = 0; i < anular.length; i += 1000) {
      await tx.cuentaCorriente.updateMany({ where: { id: { in: anular.slice(i, i + 1000) }, estado: EstadoCuenta.PENDIENTE }, data: { estado: EstadoCuenta.ANULADO } });
    }
    const crear = nuevas.flatMap((e) =>
      e.plan.crear.map((l) => ({
        contribuyenteId: e.contribuyenteId,
        predioId: l.predioId,
        tributoId: l.tributoId,
        anioFiscal: anio,
        cuota: l.cuota,
        importe: l.importe,
        derechoEmision: l.derechoEmision,
        fechaVencimiento: new Date(l.vence),
        ajusteDeId: l.ajusteDeId,
        determinacionId: ids.get(`${e.contribuyenteId}|${anio}`)!,
      })),
    );
    for (let i = 0; i < crear.length; i += 1000) await tx.cuentaCorriente.createMany({ data: crear.slice(i, i + 1000) });

    // Autoavalúo del predio en el año determinado (lo leen la ficha del predio y caja).
    const autoavaluos = new Map<number, Prisma.Decimal>();
    for (const e of nuevas) for (const p of e.r.predios) if (p.valor?.ok) autoavaluos.set(p.predioId, p.valor.autoavaluo);
    const filas = [...autoavaluos.entries()];
    for (let i = 0; i < filas.length; i += 500) {
      const valores = filas.slice(i, i + 500).map(([id, v]) => Prisma.sql`(${id}::int, ${v.toFixed(2)}::numeric)`);
      await tx.$executeRaw`
        UPDATE predios AS p SET "valorAutovaluo" = v.valor, "updatedAt" = now()
        FROM (VALUES ${Prisma.join(valores)}) AS v(id, valor)
        WHERE p.id = v.id AND p."valorAutovaluo" IS DISTINCT FROM v.valor`;
    }
  }

  // ---- Respuesta (misma forma que el cálculo v1, más las exclusiones) ----

  private respuesta(entrada: EntradaMasiva, ev: { evaluaciones: Evaluacion[]; tipos: Tributo[] }, ejecutado: boolean) {
    const { evaluaciones, tipos } = ev;
    if (entrada.contribuyenteId) {
      const e = evaluaciones[0];
      if (e?.tipo === 'EXCLUIDO') throw new ConflictException(e.motivo);
    }
    const hechas = evaluaciones.filter((e): e is Hecha => e.tipo === 'DETERMINADO' || e.tipo === 'SIN_CAMBIO');
    const excluidas = evaluaciones.filter((e): e is Extract<Evaluacion, { tipo: 'EXCLUIDO' }> => e.tipo === 'EXCLUIDO');
    const suma = (f: (e: (typeof hechas)[number]) => Prisma.Decimal) => hechas.reduce((t, e) => t.plus(f(e)), new D(0));
    const errores = [...new Set(hechas.flatMap((e) => e.r.errores)), ...excluidas.filter((e) => e.clase === 'BLOQUEO').map((e) => `Contribuyente #${e.contribuyenteId}: ${e.motivo}`)];
    return {
      anio: entrada.anio,
      tributos: tipos,
      contribuyentes: hechas.length,
      predios: new Set(hechas.flatMap((e) => e.r.predios.map((p) => p.predioId))).size,
      totales: {
        predial: n2(suma((e) => (e.liquidaPredial ? e.r.impuesto : new D(0)))),
        derechoEmision: n2(suma((e) => (e.liquidaPredial ? e.r.derechoEmision : new D(0)))),
        arbitrios: n2(suma((e) => (e.liquidaArbitrios ? e.r.arbitrios : new D(0)))),
      },
      cambios: {
        crear: hechas.reduce((t, e) => t + e.plan.crear.length, 0),
        actualizar: 0,
        anular: hechas.reduce((t, e) => t + e.plan.anular.length, 0),
        sinCambio: hechas.reduce((t, e) => t + e.plan.sinCambio, 0),
        protegidas: 0,
      },
      excluidos: {
        djPendiente: excluidas.filter((e) => e.clase === 'DJ_PENDIENTE').length,
        rigeDj: excluidas.filter((e) => e.clase === 'RIGE_DJ').length,
        bloqueados: excluidas.filter((e) => e.clase === 'BLOQUEO').length,
      },
      determinadosV2: excluidas.filter((e) => e.clase === 'RIGE_DJ').length,
      sinCambioPersonas: hechas.filter((e) => e.tipo === 'SIN_CAMBIO').length,
      errores: errores.slice(0, 200),
      totalErrores: errores.length,
      detalle: entrada.contribuyenteId
        ? hechas.map((e) => ({
            contribuyenteId: e.contribuyenteId,
            predios: e.r.predios.map((p) => ({
              predioId: p.predioId,
              porcentaje: String(p.porcentaje),
              origen: p.origen,
              ...(p.valor?.ok
                ? { arancel: p.valor.arancel ?? undefined, terreno: n2(p.valor.terreno), construccion: n2(p.valor.construccion), otras: n2(p.valor.obras), autoavaluo: n2(p.valor.autoavaluo) }
                : { error: p.valor && !p.valor.ok ? p.valor.error : null }),
            })),
            baseImponible: n2(e.r.baseAfecta),
            impuestoPredial: e.r.predialCalculable ? n2(e.r.impuesto) : null,
            arbitrios: n2(e.r.arbitrios),
            beneficios: e.r.beneficios,
            avisos: [...new Set(e.r.avisos)],
          }))
        : [],
      ejecutado,
    };
  }
}
