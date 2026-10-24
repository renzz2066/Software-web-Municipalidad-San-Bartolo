import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EstadoCuenta,
  EstadoFiscalizacion,
  EstadoRegistro,
  ModalidadNotificacion,
  Prisma,
  TipoFiscalizacion,
  TipoValor,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DatosPredioDto, OtraInstalacionDto, PisoDto } from '../../predios/dto/declaracion.dto.js';
import { INCLUDE_PREDIO, PrediosService } from '../../predios/predios.service.js';
import { CalculoService, type DatosPredioCalculo } from '../calculo/calculo.service.js';
import { vencimientos } from '../calculo/motor.js';
import { reservarCorrelativos } from '../correlativos.js';
import { cargarTasas, iso, liquidarCuenta } from '../estado-cuenta/tasas.js';
import { hoyLima } from '../fechas.js';
import { ESTADOS_VALOR_VIGENTE } from '../valores/valores.reglas.js';
import {
  type AccionExpediente,
  type CuotaDeclarada,
  type ResumenDiferencias,
  diferencias,
  errorAccion,
  errorExpediente,
  errorRequerimiento,
  estadoTrasFichas,
  planAjustes,
  rangoFiscalizable,
} from './fiscalizacion.reglas.js';

type Tx = Prisma.TransactionClient;

const OPCIONES_TX = { maxWait: 10_000, timeout: 20_000 };
// Liquidar recalcula cada año del expediente; con la latencia a Supabase necesita margen.
const OPCIONES_TX_LIQUIDACION = { maxWait: 10_000, timeout: 120_000 };
const D = Prisma.Decimal;
const ZONA_LIMA = '-05:00';

export interface AperturaEntrada {
  tipo: TipoFiscalizacion;
  contribuyenteId: number;
  fiscalizadorId: number;
  anioDesde: number;
  anioHasta: number;
  predioIds: number[];
  observacion?: string;
}

export interface RequerimientoEntrada {
  fechaInspeccion: string; // AAAA-MM-DD
  horaInspeccion: string; // HH:MM, hora de Lima
  notificacion?: { fecha: string; modalidad: ModalidadNotificacion; dni?: string; nombre?: string } | null;
}

// Ficha de inspección (F3): los mismos datos que una DJ del predio, más lo observado en campo.
export interface FichaEntrada {
  predio: DatosPredioDto;
  pisos: PisoDto[];
  otrasInstalaciones: OtraInstalacionDto[];
  observacion?: string;
}

// La ficha como la usa el motor de cálculo (mismos campos que lee cargarPredios).
function datosCalculo(f: FichaEntrada): DatosPredioCalculo {
  return {
    viaId: f.predio.viaId,
    urbanizacionId: f.predio.urbanizacionId ?? null,
    zonaId: f.predio.zonaId ?? null,
    usoPredio: f.predio.usoPredio.trim().toUpperCase(),
    areaTerreno: f.predio.areaTerreno,
    pisos: f.pisos.map((p) => ({
      nivel: p.nivel,
      anioConstruccion: p.anioConstruccion ?? null,
      clasificacion: p.clasificacion,
      material: p.material,
      estadoConservacion: p.estadoConservacion,
      categorias: p.categorias,
      areaConstruida: p.areaConstruida,
    })),
    otrasInstalaciones: f.otrasInstalaciones.map((o) => ({ valor: o.valor ?? null })),
  };
}

const n2 = (x: Prisma.Decimal) => x.toFixed(2);

// Liquidación serializable (se guarda en fiscalizacion_predios.liquidacion y la ve la pantalla).
function serializar(anios: { anio: number; base: Prisma.Decimal | null; r: ResumenDiferencias }[]) {
  const total = anios.reduce((t, a) => t.plus(a.r.totalOmitido), new D(0));
  return {
    totalOmitido: n2(total),
    sinDiferencias: total.isZero(),
    anios: anios.map(({ anio, base, r }) => ({
      anio,
      baseFiscalizada: base ? n2(base) : null,
      porTributo: r.porAnio.map((x) => ({ tributo: x.tributo, declarado: n2(x.declarado), fiscalizado: n2(x.fiscalizado), omitido: n2(x.omitido) })),
      aumentos: r.aumentos.map((x) => ({ ...x, declarado: n2(x.declarado), fiscalizado: n2(x.fiscalizado), diferencia: n2(x.diferencia) })),
      disminuciones: r.disminuciones.map((x) => ({ ...x, declarado: n2(x.declarado), fiscalizado: n2(x.fiscalizado), diferencia: n2(x.diferencia) })),
    })),
  };
}

const SELECT_CONTRIBUYENTE = {
  id: true,
  tipoPersona: true,
  tipoDoc: true,
  numDoc: true,
  nombreCompleto: true,
  direccionFiscal: true,
  codigoLegacy: true,
} as const;

const limaFechaHora = (d: Date) => {
  const lima = new Date(d.getTime() - 5 * 3_600_000).toISOString();
  return { fecha: lima.slice(0, 10), hora: lima.slice(11, 16) };
};

// Expedientes de fiscalización (specs/rentas-fiscalizacion-v1.md, F1–F3): apertura con número FIS,
// requerimiento de inspección con su notificación y ficha por predio. La ficha no cambia el predio:
// eso lo hace la resolución (F4–F5) con una DJ de motivo FISCALIZACION, junto con las diferencias en
// cuenta corriente y la RD de fiscalización.
@Injectable()
export class FiscalizacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculo: CalculoService,
    private readonly predios: PrediosService,
  ) {}

  // Datos para abrir un expediente: predios activos del contribuyente, si declaró, años permitidos.
  async opciones(contribuyenteId: number) {
    const anioActual = Number(hoyLima().slice(0, 4));
    const [contribuyente, predios, conDJ, fiscalizadores] = await Promise.all([
      this.prisma.contribuyente.findUnique({ where: { id: contribuyenteId }, select: SELECT_CONTRIBUYENTE }),
      this.prisma.predio.findMany({
        where: { estado: { not: EstadoRegistro.BAJA }, contribuyentes: { some: { contribuyenteId, estado: EstadoRegistro.ACTIVO } } },
        select: { id: true, numero: true, manzana: true, lote: true, usoPredio: true, via: { select: { id: true, tipoVia: true, nombre: true } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.declaracionJurada.count({ where: { contribuyenteId } }),
      this.prisma.fiscalizador.findMany({ where: { activo: true }, select: { id: true, nombre: true, dni: true }, orderBy: { nombre: 'asc' } }),
    ]);
    if (!contribuyente) {
      throw new NotFoundException('El contribuyente no existe');
    }
    const rango = rangoFiscalizable(anioActual, conDJ === 0);
    return {
      contribuyente,
      predios,
      fiscalizadores,
      sinDeclaracion: conDJ === 0,
      rango,
      aniosConParametros: await this.aniosConParametros(this.prisma, rango.desde, rango.hasta),
    };
  }

  async abrir(e: AperturaEntrada) {
    const hoy = hoyLima();
    const anio = Number(hoy.slice(0, 4));
    const { id } = await this.prisma.$transaction(async (tx) => {
      const contribuyente = await tx.contribuyente.findUnique({ where: { id: e.contribuyenteId }, select: { estado: true } });
      if (!contribuyente || contribuyente.estado === EstadoRegistro.BAJA) {
        throw new BadRequestException('El contribuyente no existe o está dado de baja');
      }
      const fiscalizador = await tx.fiscalizador.findUnique({ where: { id: e.fiscalizadorId }, select: { activo: true } });
      if (!fiscalizador?.activo) {
        throw new BadRequestException('Elige un fiscalizador activo');
      }
      const titulares = await tx.predioContribuyente.count({
        where: { contribuyenteId: e.contribuyenteId, predioId: { in: e.predioIds }, estado: EstadoRegistro.ACTIVO, predio: { estado: { not: EstadoRegistro.BAJA } } },
      });
      if (titulares !== new Set(e.predioIds).size) {
        throw new BadRequestException('Algún predio no es del contribuyente o está dado de baja');
      }
      const sinDeclaracion = (await tx.declaracionJurada.count({ where: { contribuyenteId: e.contribuyenteId } })) === 0;
      const error = errorExpediente({
        anioDesde: e.anioDesde,
        anioHasta: e.anioHasta,
        predioIds: e.predioIds,
        anioActual: anio,
        sinDeclaracion,
        aniosConParametros: await this.aniosConParametros(tx, e.anioDesde, e.anioHasta),
      });
      if (error) {
        throw new BadRequestException(error);
      }
      const [numero] = await reservarCorrelativos(tx, 'FIS', anio);
      return tx.fiscalizacion.create({
        data: {
          anio,
          numero,
          tipo: e.tipo,
          contribuyenteId: e.contribuyenteId,
          fiscalizadorId: e.fiscalizadorId,
          anioDesde: e.anioDesde,
          anioHasta: e.anioHasta,
          observacion: e.observacion?.trim() || null,
          predios: { create: e.predioIds.map((predioId) => ({ predioId })) },
        },
        select: { id: true },
      });
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  async listar(filtros: { contribuyenteId?: number; estado?: EstadoFiscalizacion; anio?: number }) {
    const expedientes = await this.prisma.fiscalizacion.findMany({
      where: { contribuyenteId: filtros.contribuyenteId, estado: filtros.estado, anio: filtros.anio },
      select: {
        id: true,
        anio: true,
        numero: true,
        tipo: true,
        estado: true,
        anioDesde: true,
        anioHasta: true,
        fechaInspeccion: true,
        createdAt: true,
        contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
        fiscalizador: { select: { nombre: true } },
        _count: { select: { predios: true } },
      },
      orderBy: [{ anio: 'desc' }, { numero: 'desc' }],
      take: 200,
    });
    return expedientes.map(({ anio, numero, fechaInspeccion, createdAt, _count, fiscalizador, ...x }) => ({
      ...x,
      numero: `${anio}-${numero}`,
      fechaApertura: limaFechaHora(createdAt).fecha,
      inspeccion: fechaInspeccion ? limaFechaHora(fechaInspeccion) : null,
      fiscalizador: fiscalizador.nombre,
      predios: _count.predios,
    }));
  }

  async obtener(id: number) {
    const f = await this.prisma.fiscalizacion.findUnique({
      where: { id },
      include: {
        contribuyente: { select: SELECT_CONTRIBUYENTE },
        fiscalizador: { select: { id: true, nombre: true, dni: true } },
        creadoPor: { select: { nombres: true, apellidos: true } },
        predios: { include: { predio: { include: INCLUDE_PREDIO } }, orderBy: { predioId: 'asc' } },
        valores: { select: { id: true, tipo: true, anio: true, numero: true, estado: true, totalDeuda: true, predioId: true }, orderBy: { id: 'asc' } },
      },
    });
    if (!f) {
      throw new NotFoundException('El expediente no existe');
    }
    return {
      id: f.id,
      numero: `${f.anio}-${f.numero}`,
      tipo: f.tipo,
      estado: f.estado,
      anioDesde: f.anioDesde,
      anioHasta: f.anioHasta,
      fechaApertura: limaFechaHora(f.createdAt).fecha,
      observacion: f.observacion,
      motivoAnulacion: f.motivoAnulacion,
      abiertoPor: f.creadoPor ? `${f.creadoPor.nombres} ${f.creadoPor.apellidos}`.trim() : null,
      contribuyente: f.contribuyente,
      fiscalizador: f.fiscalizador,
      inspeccion: f.fechaInspeccion ? limaFechaHora(f.fechaInspeccion) : null,
      notificacion: f.fechaNotificacion
        ? { fecha: iso(f.fechaNotificacion), modalidad: f.modalidadNotificacion, dni: f.notificadoDni, nombre: f.notificadoNombre }
        : null,
      predios: f.predios.map((p) => ({ predioId: p.predioId, ficha: p.ficha, liquidacion: p.liquidacion, predio: p.predio })),
      liquidacion: f.predios[0]?.liquidacion ?? null,
      valores: f.valores.map((v) => ({ ...v, numero: `${v.anio}-${v.numero}`, totalDeuda: n2(v.totalDeuda) })),
    };
  }

  async requerimiento(id: number, r: RequerimientoEntrada) {
    if (!/^\d{2}:\d{2}$/.test(r.horaInspeccion)) {
      throw new BadRequestException('La hora de inspección debe ser HH:MM');
    }
    await this.prisma.$transaction(async (tx) => {
      const f = await this.paraAccion(tx, id, 'REQUERIMIENTO');
      const error = errorRequerimiento({
        fechaApertura: limaFechaHora(f.createdAt).fecha,
        fechaInspeccion: r.fechaInspeccion,
        notificacion: r.notificacion ?? null,
        hoy: hoyLima(),
      });
      if (error) {
        throw new BadRequestException(error);
      }
      const n = r.notificacion;
      await tx.fiscalizacion.update({
        where: { id },
        data: {
          fechaInspeccion: new Date(`${r.fechaInspeccion}T${r.horaInspeccion}:00${ZONA_LIMA}`),
          fechaNotificacion: n ? new Date(n.fecha) : null,
          modalidadNotificacion: n?.modalidad ?? null,
          notificadoDni: n?.dni?.trim().toUpperCase() || null,
          notificadoNombre: n?.nombre?.trim().toUpperCase() || null,
        },
      });
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  // Graba la ficha del predio; con todas las fichas el expediente pasa a INSPECCIONADO (y vuelve a
  // ABIERTO si alguna se borra en el futuro; hoy no hay borrado de fichas).
  async guardarFicha(id: number, predioId: number, ficha: FichaEntrada) {
    await this.prisma.$transaction(async (tx) => {
      await this.paraAccion(tx, id, 'FICHA');
      const { count } = await tx.fiscalizacionPredio.updateMany({
        where: { fiscalizacionId: id, predioId },
        data: {
          ficha: JSON.parse(JSON.stringify({ ...ficha, observacion: ficha.observacion?.trim() || null })) as Prisma.InputJsonValue,
          liquidacion: Prisma.DbNull, // la ficha cambió: la liquidación anterior ya no vale
        },
      });
      if (count === 0) {
        throw new NotFoundException('El predio no forma parte del expediente');
      }
      const filas = await tx.fiscalizacionPredio.findMany({ where: { fiscalizacionId: id }, select: { ficha: true } });
      const estado = estadoTrasFichas(filas.filter((p) => p.ficha !== null).length, filas.length);
      await tx.fiscalizacion.update({ where: { id }, data: { estado } });
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  async anular(id: number, motivo: string) {
    await this.prisma.$transaction(async (tx) => {
      const f = await tx.fiscalizacion.findUnique({ where: { id }, select: { estado: true } });
      if (!f) {
        throw new NotFoundException('El expediente no existe');
      }
      const error = errorAccion(f.estado, 'ANULAR', motivo);
      if (error) {
        throw new BadRequestException(error);
      }
      const { count } = await tx.fiscalizacion.updateMany({
        where: { id, estado: f.estado },
        data: { estado: EstadoFiscalizacion.ANULADO, motivoAnulacion: motivo.trim() },
      });
      if (count === 0) {
        throw new ConflictException('El expediente cambió mientras lo editabas; recarga la página');
      }
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  // F4: diferencia por año, tributo y cuota entre lo fiscalizado y lo declarado. No escribe.
  async liquidar(id: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.paraAccion(tx, id, 'LIQUIDAR');
      const { anios } = await this.plan(tx, id);
      return serializar(anios);
    }, OPCIONES_TX_LIQUIDACION);
  }

  // F5 (decisiones 3 y 4), en una transacción: sin aumentos el expediente se cierra SIN_DIFERENCIAS y
  // el predio no cambia. Con aumentos: la ficha pasa al predio como DJ FISCALIZACION, cada aumento
  // entra a la cuenta corriente (sube la cuota libre, o fila de diferencia sobre la protegida, o cuota
  // nueva) y se emite una RD por año y predio con lo determinado, ligada al expediente.
  async resolver(id: number) {
    await this.prisma.$transaction(async (tx) => {
      await this.paraAccion(tx, id, 'RESOLVER');
      const { f, anios } = await this.plan(tx, id);
      const liquidacion = serializar(anios) as unknown as Prisma.InputJsonValue;
      const hoy = hoyLima();
      const anioActual = Number(hoy.slice(0, 4));

      if (anios.every((a) => a.r.aumentos.length === 0)) {
        await tx.fiscalizacionPredio.updateMany({ where: { fiscalizacionId: id }, data: { liquidacion } });
        await this.cambiarEstado(tx, id, EstadoFiscalizacion.INSPECCIONADO, EstadoFiscalizacion.SIN_DIFERENCIAS);
        return;
      }

      const referencia = `Fiscalización FIS ${f.anio}-${f.numero}`;
      for (const p of f.predios) {
        const declaracionId = await this.predios.aplicarFicha(tx, {
          predioId: p.predioId,
          contribuyenteId: f.contribuyenteId,
          anio: anioActual,
          fecha: hoy,
          ficha: p.ficha,
          observacion: referencia,
        });
        await tx.fiscalizacionPredio.update({ where: { id: p.id }, data: { declaracionId, liquidacion } });
      }

      const tocadas: { id: number; anio: number; predioId: number | null }[] = [];
      for (const { anio, r, declaradas, tributos } of anios) {
        const plan = planAjustes(r.aumentos, declaradas);
        const porId = new Map(declaradas.map((c) => [c.id, c]));
        for (const a of plan.actualizar) {
          const { count } = await tx.cuentaCorriente.updateMany({
            where: { id: a.id, estado: EstadoCuenta.PENDIENTE },
            data: { importe: a.importe },
          });
          if (count === 0) {
            throw new ConflictException('Alguna cuota cambió de estado mientras se resolvía; vuelve a liquidar');
          }
          tocadas.push({ id: a.id, anio, predioId: porId.get(a.id)!.predioId });
        }
        const nuevas = [
          ...plan.ajustes.map((a) => ({ ...a, vence: porId.get(a.ajusteDeId)!.fechaVencimiento })),
          ...plan.crear.map((c) => ({ ...c, ajusteDeId: null, vence: new Date(vencimientos(anio)[c.cuota - 1] ?? `${anio}-12-31`) })),
        ];
        for (const n of nuevas) {
          const fila = await tx.cuentaCorriente.create({
            data: {
              contribuyenteId: f.contribuyenteId,
              predioId: n.predioId,
              tributoId: tributos.get(n.tributo)!,
              anioFiscal: anio,
              cuota: n.cuota,
              importe: n.importe,
              fechaVencimiento: n.vence,
              ajusteDeId: n.ajusteDeId,
            },
            select: { id: true },
          });
          tocadas.push({ id: fila.id, anio, predioId: n.predioId });
        }
      }
      await this.emitirRD(tx, f, anios, tocadas, hoy);
      await this.cambiarEstado(tx, id, EstadoFiscalizacion.INSPECCIONADO, EstadoFiscalizacion.RESUELTO);
    }, OPCIONES_TX_LIQUIDACION);
    return this.obtener(id);
  }

  // RD de fiscalización (decisión 4): misma serie RD que Control y Recaudación, una por año y predio.
  // El predial va por contribuyente: con un solo predio fiscalizado se liga a ese predio; con varios,
  // va en una RD del año sin predio. Detalle = cada cuota determinada, liquidada a la fecha de emisión.
  private async emitirRD(
    tx: Tx,
    f: { id: number; contribuyenteId: number; predios: { predioId: number }[] },
    anios: { anio: number; base: Prisma.Decimal | null }[],
    tocadas: { id: number; anio: number; predioId: number | null }[],
    hoy: string,
  ) {
    const predioUnico = f.predios.length === 1 ? f.predios[0].predioId : null;
    const grupos = new Map<string, { anio: number; predioId: number | null; ids: number[]; conPredial: boolean }>();
    for (const t of tocadas) {
      const predioId = t.predioId ?? predioUnico;
      const k = `${t.anio}|${predioId ?? '-'}`;
      const g = grupos.get(k) ?? { anio: t.anio, predioId, ids: [], conPredial: false };
      g.ids.push(t.id);
      if (t.predioId === null) g.conPredial = true;
      grupos.set(k, g);
    }
    const cuentas = await tx.cuentaCorriente.findMany({
      where: { id: { in: tocadas.map((t) => t.id) } },
      select: {
        id: true,
        anioFiscal: true,
        cuota: true,
        importe: true,
        derechoEmision: true,
        fechaVencimiento: true,
        estado: true,
        tributo: { select: { tipo: true } },
      },
    });
    const porId = new Map(cuentas.map((c) => [c.id, c]));
    const { ipm, tim } = await cargarTasas(tx);
    const lista = [...grupos.values()].sort((a, b) => a.anio - b.anio || (a.predioId ?? 0) - (b.predioId ?? 0));
    const anioEmision = Number(hoy.slice(0, 4));
    const numeros = await reservarCorrelativos(tx, 'RD', anioEmision, lista.length);
    const bases = new Map(anios.map((a) => [a.anio, a.base]));
    for (const [i, g] of lista.entries()) {
      const detalles = g.ids.map((cid) => {
        const c = porId.get(cid)!;
        const l = liquidarCuenta(c, hoy, ipm, tim);
        return { cuentaCorrienteId: cid, importe: l.insoluto, reajuste: l.reajuste, mora: l.mora, subtotal: l.total };
      });
      await tx.valorCab.create({
        data: {
          tipo: TipoValor.RD,
          anio: anioEmision,
          numero: numeros[i],
          contribuyenteId: f.contribuyenteId,
          predioId: g.predioId,
          baseImponible: g.conPredial ? (bases.get(g.anio) ?? null) : null,
          totalDeuda: detalles.reduce((t, d) => t.plus(d.subtotal), new D(0)),
          fechaEmision: new Date(hoy),
          fiscalizacionId: f.id,
          detalles: { create: detalles },
        },
      });
    }
  }

  // Lo fiscalizado (motor con la ficha) contra lo declarado (cuenta corriente), por cada año del expediente.
  private async plan(tx: Tx, id: number) {
    const f = await tx.fiscalizacion.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        anio: true,
        numero: true,
        contribuyenteId: true,
        anioDesde: true,
        anioHasta: true,
        predios: { select: { id: true, predioId: true, ficha: true }, orderBy: { predioId: 'asc' } },
      },
    });
    const predios = f.predios.map((p) => ({ ...p, ficha: p.ficha as unknown as FichaEntrada }));
    if (predios.some((p) => !p.ficha)) {
      throw new BadRequestException('Falta la ficha de inspección de algún predio');
    }
    const predioIds = predios.map((p) => p.predioId);
    const sustituir = new Map(predios.map((p) => [p.predioId, datosCalculo(p.ficha)]));

    const anios = [];
    for (let anio = f.anioDesde; anio <= f.anioHasta; anio++) {
      const { lineas, tributos, base } = await this.calculo.lineasFiscalizacion(tx, anio, f.contribuyenteId, sustituir);
      const codigo = new Map([...tributos].map(([c, tid]) => [tid, c]));
      const delExpediente = (predioId: number | null) => predioId === null || predioIds.includes(predioId);
      const fiscalizado = lineas
        .filter((l) => delExpediente(l.predioId))
        .map((l) => ({ anio, tributo: codigo.get(l.tributoId)!, predioId: l.predioId, cuota: l.cuota, importe: l.importe }));
      const cuentas = await tx.cuentaCorriente.findMany({
        where: {
          contribuyenteId: f.contribuyenteId,
          anioFiscal: anio,
          tributoId: { in: [...tributos.values()] },
          OR: [{ predioId: null }, { predioId: { in: predioIds } }],
        },
        select: {
          id: true,
          predioId: true,
          tributoId: true,
          cuota: true,
          importe: true,
          estado: true,
          ajusteDeId: true,
          fechaVencimiento: true,
          valorDetalles: { where: { valor: { estado: { in: ESTADOS_VALOR_VIGENTE } } }, select: { id: true }, take: 1 },
        },
      });
      const declaradas: (CuotaDeclarada & { fechaVencimiento: Date | null })[] = cuentas.map((c) => ({
        id: c.id,
        anio,
        tributo: codigo.get(c.tributoId)!,
        predioId: c.predioId,
        cuota: c.cuota,
        importe: c.importe,
        estado: c.estado,
        enValor: c.valorDetalles.length > 0,
        ajusteDeId: c.ajusteDeId,
        fechaVencimiento: c.fechaVencimiento,
      }));
      const declarado = declaradas.filter((c) => c.estado !== EstadoCuenta.ANULADO);
      anios.push({ anio, base, r: diferencias(declarado, fiscalizado), declaradas, tributos });
    }
    return { f: { ...f, predios }, anios };
  }

  private async cambiarEstado(tx: Tx, id: number, desde: EstadoFiscalizacion, hacia: EstadoFiscalizacion) {
    const { count } = await tx.fiscalizacion.updateMany({ where: { id, estado: desde }, data: { estado: hacia } });
    if (count === 0) {
      throw new ConflictException('El expediente cambió mientras se resolvía; recarga la página');
    }
  }

  private async paraAccion(tx: Tx, id: number, accion: AccionExpediente) {
    const f = await tx.fiscalizacion.findUnique({ where: { id }, select: { estado: true, createdAt: true } });
    if (!f) {
      throw new NotFoundException('El expediente no existe');
    }
    const error = errorAccion(f.estado, accion);
    if (error) {
      throw new BadRequestException(error);
    }
    return f;
  }

  // Un año se puede fiscalizar si tiene UIT y escala predial cargadas (decisión 8).
  private async aniosConParametros(db: PrismaService | Tx, desde: number, hasta: number) {
    const [uits, escalas] = await Promise.all([
      db.uit.findMany({ where: { anio: { gte: desde, lte: hasta } }, select: { anio: true } }),
      db.escalaPredial.findMany({ where: { anio: { gte: desde, lte: hasta } }, distinct: ['anio'], select: { anio: true } }),
    ]);
    const conEscala = new Set(escalas.map((e) => e.anio));
    return uits.map((u) => u.anio).filter((a) => conEscala.has(a)).sort();
  }
}
