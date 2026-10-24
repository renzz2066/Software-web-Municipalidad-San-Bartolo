import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, EstadoValor, ModalidadNotificacion, Prisma, TipoTributo, TipoValor } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CalculoService, type TipoCalculo } from '../calculo/calculo.service.js';
import { vencimientos } from '../calculo/motor.js';
import { reservarCorrelativos } from '../correlativos.js';
import { liquidar } from '../estado-cuenta/liquidacion.js';
import { cargarTasas, iso } from '../estado-cuenta/tasas.js';
import { hoyLima } from '../fechas.js';
import { anioValido } from '../maestros/maestros.reglas.js';
import { fechaExigible, masDias } from './plazos.js';
import {
  ESTADOS_VALOR_VIGENTE,
  errorAnulacion,
  errorNotificacion,
  planEmision,
  type CuotaEmitible,
  type Exclusiones,
  type ValorPlan,
  type TipoValorEmision,
} from './valores.reglas.js';

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;

export interface NotificacionEntrada {
  fecha: string;
  modalidad: ModalidadNotificacion;
  dni?: string;
  nombre?: string;
}

export interface EmisionEntrada {
  anio: number;
  tipos?: TipoValorEmision[];
  contribuyenteId?: number;
  zonaId?: number;
  soloVencidas?: boolean;
  montoMinimo?: number;
}

const TRIBUTO_DE: Record<TipoValorEmision, TipoCalculo> = { OP: 'PREDIAL', RD: 'ARBITRIOS' };
// Mismo margen que el cálculo masivo: miles de filas con la latencia a Supabase.
const OPCIONES_TX = { maxWait: 10_000, timeout: 120_000 };
const LOTE = 500;
// Serializa emisiones simultáneas: dos usuarios no pueden meter la misma cuota en dos valores.
const LOCK_EMISION = 7_301_001;
const MUESTRA = 200;

const SELECT_PREDIO = {
  id: true,
  numero: true,
  manzana: true,
  lote: true,
  via: { select: { tipoVia: true, nombre: true } },
  urbanizacion: { select: { nombre: true } },
} as const;

// Emisión de OP/RD (specs/rentas-valores-v1.md, V1-V3). Simular no escribe; ejecutar graba
// cabecera + detalle con la liquidación a la fecha de emisión, en una sola transacción.

// Declarado, fiscalizado y omitido del año de la RD, tomados de la liquidación del expediente.
function comparacionFiscalizacion(f: { id: number; anio: number; numero: string; predios: { liquidacion: Prisma.JsonValue }[] }, anio: number) {
  const liquidacion = f.predios[0]?.liquidacion as
    | { anios: { anio: number; porTributo: { tributo: string; declarado: string; fiscalizado: string; omitido: string }[] }[] }
    | null;
  return {
    id: f.id,
    numero: `${f.anio}-${f.numero}`,
    porTributo: liquidacion?.anios.find((a) => a.anio === anio)?.porTributo.filter((t) => Number(t.omitido) > 0) ?? [],
  };
}

@Injectable()
export class ValoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculo: CalculoService,
  ) {}

  simular(entrada: EmisionEntrada) {
    return this.prisma.$transaction(async (tx) => (await this.preparar(tx, entrada)).respuesta, OPCIONES_TX);
  }

  ejecutar(entrada: EmisionEntrada) {
    return this.prisma.$transaction(async (tx) => {
      // $executeRaw: la función devuelve void y $queryRaw no puede deserializarlo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_EMISION})`;
      const { respuesta, valores, bases, fecha } = await this.preparar(tx, entrada);
      const anioEmision = Number(fecha.slice(0, 4));
      const emitidos: Record<string, string[]> = {};

      for (const tipo of [TipoValor.OP, TipoValor.RD]) {
        const delTipo = valores.filter((v) => v.tipo === tipo);
        if (!delTipo.length) continue;
        const numeros = await reservarCorrelativos(tx, tipo, anioEmision, delTipo.length);
        emitidos[tipo] = [numeros[0], numeros[numeros.length - 1]];
        for (let i = 0; i < delTipo.length; i += LOTE) {
          const lote = delTipo.slice(i, i + LOTE);
          const cabeceras = await tx.valorCab.createManyAndReturn({
            data: lote.map((v, j) => ({
              tipo,
              anio: anioEmision,
              numero: numeros[i + j],
              contribuyenteId: v.contribuyenteId,
              predioId: v.predioId,
              baseImponible: tipo === TipoValor.OP ? (bases.get(v.contribuyenteId) ?? null) : null,
              totalDeuda: v.total,
              fechaEmision: new Date(fecha),
            })),
            select: { id: true, numero: true },
          });
          const idPorNumero = new Map(cabeceras.map((c) => [c.numero, c.id]));
          await tx.valorDet.createMany({
            data: lote.flatMap((v, j) =>
              v.detalles.map((d) => ({
                valorId: idPorNumero.get(numeros[i + j])!,
                cuentaCorrienteId: d.cuentaId,
                importe: d.importe,
                reajuste: d.reajuste,
                mora: d.mora,
                subtotal: d.subtotal,
              })),
            ),
          });
        }
      }
      return { ...respuesta, ejecutado: true, emitidos };
    }, OPCIONES_TX);
  }

  // Registra (o corrige) la notificación y fija la fecha de exigibilidad (V4).
  async notificar(id: number, entrada: NotificacionEntrada) {
    await this.prisma.$transaction(async (tx) => {
      const valor = await this.buscar(tx, id);
      const fecha = entrada.fecha.slice(0, 10);
      const error = errorNotificacion(valor.estado, iso(valor.fechaEmision), { ...entrada, fecha }, hoyLima());
      if (error) {
        throw new BadRequestException(error);
      }
      // 20 días hábiles caben holgados en 60 calendario aun con feriados largos.
      const feriados = await tx.feriado.findMany({
        where: { fecha: { gte: new Date(fecha), lte: new Date(masDias(fecha, 60)) } },
        select: { fecha: true },
      });
      const exigible = fechaExigible(valor.tipo, fecha, new Set(feriados.map((f) => iso(f.fecha))));
      await this.actualizarVigente(tx, id, {
        estado: EstadoValor.NOTIFICADO,
        fechaNotificacion: new Date(fecha),
        modalidadNotificacion: entrada.modalidad,
        notificadoDni: entrada.dni?.trim().toUpperCase() || null,
        notificadoNombre: entrada.nombre?.trim() || null,
        fechaExigible: new Date(exigible),
      });
    });
    return this.obtener(id);
  }

  // Anula con motivo (V5): sus cuotas quedan libres para otro valor y para el recálculo.
  async anular(id: number, motivo: string) {
    await this.prisma.$transaction(async (tx) => {
      const valor = await this.buscar(tx, id);
      const error = errorAnulacion(valor.estado, motivo);
      if (error) {
        throw new BadRequestException(error);
      }
      await this.actualizarVigente(tx, id, { estado: EstadoValor.ANULADO, motivoAnulacion: motivo.trim() });
    });
    return this.obtener(id);
  }

  private async buscar(tx: Tx, id: number) {
    const valor = await tx.valorCab.findUnique({ where: { id }, select: { tipo: true, estado: true, fechaEmision: true } });
    if (!valor) {
      throw new NotFoundException('El valor no existe');
    }
    return valor;
  }

  // Solo si sigue vigente: otro usuario pudo anularlo o transferirlo entre la lectura y la escritura.
  private async actualizarVigente(tx: Tx, id: number, data: Prisma.ValorCabUpdateManyMutationInput) {
    const { count } = await tx.valorCab.updateMany({ where: { id, estado: { in: ESTADOS_VALOR_VIGENTE } }, data });
    if (count === 0) {
      throw new ConflictException('El valor cambió de estado mientras lo editabas; recarga la página');
    }
  }

  async listar(contribuyenteId: number) {
    const valores = await this.prisma.valorCab.findMany({
      where: { contribuyenteId },
      select: {
        id: true,
        tipo: true,
        anio: true,
        numero: true,
        estado: true,
        fechaEmision: true,
        fechaNotificacion: true,
        totalDeuda: true,
        predio: { select: SELECT_PREDIO },
        detalles: { select: { cuentaCorriente: { select: { anioFiscal: true } } } },
      },
      orderBy: [{ fechaEmision: 'desc' }, { id: 'desc' }],
    });
    return valores.map(({ detalles, ...v }) => ({
      ...v,
      aniosFiscales: [...new Set(detalles.map((d) => d.cuentaCorriente.anioFiscal))].sort(),
      cuotas: detalles.length,
    }));
  }

  // Detalle para pantalla e impresión: montos de la emisión + deuda actualizada a hoy.
  async obtener(id: number) {
    const valor = await this.prisma.valorCab.findUnique({
      where: { id },
      include: {
        contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true, direccionFiscal: true } },
        predio: { select: { ...SELECT_PREDIO, usoPredio: true, zona: { select: { codigo: true, nombre: true } } } },
        transferencia: { select: { anio: true, numero: true, fecha: true, estado: true } },
        // RD de fiscalización (specs/rentas-fiscalizacion-v1.md, decisión 4): su liquidación para el imprimible.
        fiscalizacion: { select: { id: true, anio: true, numero: true, predios: { select: { liquidacion: true }, take: 1 } } },
        // RM (specs/rentas-fiscalizacion-v1.md, F6–F7): la infracción y, si nace de una DJ extemporánea, la DJ.
        infraccion: { select: { codigo: true, articulo: true, numeral: true, descripcion: true, base: true } },
        declaracion: { select: { id: true, motivo: true, fecha: true, fechaHecho: true, predioId: true } },
        detalles: {
          select: {
            id: true,
            importe: true,
            reajuste: true,
            mora: true,
            subtotal: true,
            cuentaCorriente: {
              select: {
                id: true,
                anioFiscal: true,
                cuota: true,
                importe: true,
                derechoEmision: true,
                fechaVencimiento: true,
                estado: true,
                tributo: { select: { codigo: true, nombre: true, tipo: true } },
              },
            },
          },
          orderBy: [{ cuentaCorriente: { anioFiscal: 'asc' } }, { cuentaCorriente: { tributoId: 'asc' } }, { cuentaCorriente: { cuota: 'asc' } }],
        },
      },
    });
    if (!valor) {
      throw new NotFoundException('El valor no existe');
    }

    const hoy = hoyLima();
    const { ipm, tim } = await cargarTasas(this.prisma);
    let totalHoy = new D(0);
    const detalles = valor.detalles.map((d) => {
      const c = d.cuentaCorriente;
      const l = liquidar(
        {
          esPredial: c.tributo.tipo === TipoTributo.PREDIAL,
          cuota: c.cuota,
          anio: c.anioFiscal,
          importe: c.importe,
          derechoEmision: c.derechoEmision,
          fechaVencimiento: c.fechaVencimiento ? iso(c.fechaVencimiento) : `${c.anioFiscal}-12-31`,
          vencimientoCuota1: vencimientos(c.anioFiscal)[0],
          generaMora: c.estado !== EstadoCuenta.FRACCIONADO,
        },
        hoy,
        ipm,
        tim,
      );
      // Solo suma a la deuda de hoy lo que sigue pendiente de pago.
      if (c.estado === EstadoCuenta.PENDIENTE || c.estado === EstadoCuenta.COACTIVO) totalHoy = totalHoy.plus(l.total);
      return {
        id: d.id,
        anio: c.anioFiscal,
        cuota: c.cuota,
        tributo: c.tributo,
        vencimiento: c.fechaVencimiento ? iso(c.fechaVencimiento) : null,
        estadoCuota: c.estado,
        importe: d.importe.toFixed(2),
        reajuste: d.reajuste.toFixed(2),
        mora: d.mora.toFixed(2),
        derechoEmision: d.subtotal.minus(d.importe).minus(d.reajuste).minus(d.mora).toFixed(2),
        subtotal: d.subtotal.toFixed(2),
        hoy: { reajuste: l.reajuste.toFixed(2), mora: l.mora.toFixed(2), total: l.total.toFixed(2) },
      };
    });

    // OP: escala y UIT del año fiscal, para mostrar la tasa aplicada a la base imponible (V3).
    const anioFiscal = detalles[0]?.anio ?? valor.anio;
    const [uit, escala] =
      valor.tipo === TipoValor.OP
        ? await Promise.all([
            this.prisma.uit.findUnique({ where: { anio: anioFiscal }, select: { valor: true } }),
            this.prisma.escalaPredial.findMany({ where: { anio: anioFiscal }, orderBy: { tramo: 'asc' } }),
          ])
        : [null, []];

    return {
      id: valor.id,
      tipo: valor.tipo,
      anio: valor.anio,
      numero: valor.numero,
      estado: valor.estado,
      fechaEmision: iso(valor.fechaEmision),
      fechaNotificacion: valor.fechaNotificacion ? iso(valor.fechaNotificacion) : null,
      fechaExigible: valor.fechaExigible ? iso(valor.fechaExigible) : null,
      modalidadNotificacion: valor.modalidadNotificacion,
      notificadoDni: valor.notificadoDni,
      notificadoNombre: valor.notificadoNombre,
      motivoAnulacion: valor.motivoAnulacion,
      baseImponible: valor.baseImponible?.toFixed(2) ?? null,
      totalDeuda: valor.totalDeuda.toFixed(2),
      contribuyente: valor.contribuyente,
      predio: valor.predio,
      transferencia: valor.transferencia,
      fiscalizacion: valor.fiscalizacion ? comparacionFiscalizacion(valor.fiscalizacion, anioFiscal) : null,
      infraccion: valor.infraccion,
      declaracion: valor.declaracion
        ? { ...valor.declaracion, fecha: iso(valor.declaracion.fecha), fechaHecho: valor.declaracion.fechaHecho ? iso(valor.declaracion.fechaHecho) : null }
        : null,
      anioFiscal,
      uit: uit?.valor.toFixed(2) ?? null,
      escala: escala.map((t) => ({ tramo: t.tramo, desdeUit: t.desdeUit.toString(), hastaUit: t.hastaUit?.toString() ?? null, tasa: t.tasa.toString() })),
      detalles,
      hoy: { fecha: hoy, total: totalHoy.toFixed(2) },
    };
  }

  private async preparar(tx: Tx, entrada: EmisionEntrada) {
    const { anio, contribuyenteId, zonaId } = entrada;
    if (!anioValido(anio)) {
      throw new BadRequestException('El año no es válido');
    }
    const tipos = entrada.tipos?.length ? entrada.tipos : [TipoValor.OP, TipoValor.RD];
    const montoMinimo = entrada.montoMinimo ?? 0;
    const soloVencidas = entrada.soloVencidas ?? true;
    const fecha = hoyLima();
    const tributos = tipos.map((t) => TRIBUTO_DE[t]);

    // Zona: RD por la zona de su predio; OP si el contribuyente tiene algún predio activo en la zona.
    const filtroZona: Prisma.CuentaCorrienteWhereInput = zonaId
      ? {
          OR: [
            { predio: { zonaId } },
            { predioId: null, contribuyente: { predios: { some: { estado: 'ACTIVO', predio: { zonaId, estado: 'ACTIVO' } } } } },
          ],
        }
      : {};
    const [cuentas, { ipm, tim }, revision] = await Promise.all([
      tx.cuentaCorriente.findMany({
        where: {
          estado: EstadoCuenta.PENDIENTE,
          anioFiscal: anio,
          tributo: { tipo: { in: tributos as TipoTributo[] } },
          ...(contribuyenteId ? { contribuyenteId } : {}),
          ...filtroZona,
        },
        select: {
          id: true,
          contribuyenteId: true,
          predioId: true,
          anioFiscal: true,
          cuota: true,
          importe: true,
          derechoEmision: true,
          fechaVencimiento: true,
          tributo: { select: { tipo: true } },
          valorDetalles: { where: { valor: { estado: { in: ESTADOS_VALOR_VIGENTE } } }, select: { id: true }, take: 1 },
        },
        orderBy: [{ contribuyenteId: 'asc' }, { predioId: 'asc' }, { tributoId: 'asc' }, { cuota: 'asc' }],
      }),
      cargarTasas(tx),
      this.calculo.revisarParaEmision(tx, anio, tributos, contribuyenteId),
    ]);

    const vencimientoCuota1 = vencimientos(anio)[0];
    const emitibles: CuotaEmitible[] = cuentas.map((c) => {
      const esPredial = c.tributo.tipo === TipoTributo.PREDIAL;
      const fechaVencimiento = c.fechaVencimiento ? iso(c.fechaVencimiento) : `${anio}-12-31`;
      const l = liquidar(
        {
          esPredial,
          cuota: c.cuota,
          anio,
          importe: c.importe,
          derechoEmision: c.derechoEmision,
          fechaVencimiento,
          vencimientoCuota1,
          generaMora: true,
        },
        fecha,
        ipm,
        tim,
      );
      return {
        id: c.id,
        contribuyenteId: c.contribuyenteId,
        predioId: c.predioId,
        anio,
        tributo: esPredial ? 'PREDIAL' : 'ARBITRIOS',
        fechaVencimiento,
        enValor: c.valorDetalles.length > 0,
        liquidacion: l,
      };
    });

    const { pendientes, bases } = revision;
    const { valores, excluidas } = planEmision(emitibles, {
      fecha,
      soloVencidas,
      montoMinimo,
      excluir: (cid, tipo) => pendientes.get(cid)?.has(TRIBUTO_DE[tipo]) ?? false,
    });
    const recalcular = [...pendientes.entries()].filter(([, s]) => tributos.some((t) => s.has(t))).map(([cid]) => cid);

    const respuesta = await this.armarRespuesta(tx, { anio, fecha, tipos, valores, excluidas, recalcular });
    return { respuesta, valores, bases, fecha };
  }

  private async armarRespuesta(
    tx: Tx,
    r: {
      anio: number;
      fecha: string;
      tipos: TipoValor[];
      valores: ValorPlan[];
      excluidas: Exclusiones;
      recalcular: number[];
    },
  ) {
    const muestra = r.valores.slice(0, MUESTRA);
    const idsContrib = [...new Set([...muestra.map((v) => v.contribuyenteId), ...r.recalcular.slice(0, 50)])];
    const idsPredio = [...new Set(muestra.map((v) => v.predioId).filter((x): x is number => x !== null))];
    const [contribuyentes, predios] = await Promise.all([
      tx.contribuyente.findMany({ where: { id: { in: idsContrib } }, select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } }),
      tx.predio.findMany({ where: { id: { in: idsPredio } }, select: SELECT_PREDIO }),
    ]);
    const contrib = new Map(contribuyentes.map((c) => [c.id, c]));
    const predio = new Map(predios.map((p) => [p.id, p]));

    const porTipo = Object.fromEntries(
      r.tipos.map((t) => {
        const delTipo = r.valores.filter((v) => v.tipo === t);
        return [t, { cantidad: delTipo.length, total: delTipo.reduce((a, v) => a.plus(v.total), new D(0)).toFixed(2) }];
      }),
    );
    return {
      anio: r.anio,
      fecha: r.fecha,
      tipos: r.tipos,
      valores: r.valores.length,
      contribuyentes: new Set(r.valores.map((v) => v.contribuyenteId)).size,
      total: r.valores.reduce((a, v) => a.plus(v.total), new D(0)).toFixed(2),
      porTipo,
      excluidas: r.excluidas,
      recalcular: r.recalcular.slice(0, 50).map((id) => contrib.get(id) ?? { id }),
      totalRecalcular: r.recalcular.length,
      muestra: muestra.map((v) => ({
        tipo: v.tipo,
        contribuyente: contrib.get(v.contribuyenteId) ?? { id: v.contribuyenteId },
        predio: v.predioId ? (predio.get(v.predioId) ?? { id: v.predioId }) : null,
        cuotas: v.detalles.length,
        total: v.total.toFixed(2),
      })),
      ejecutado: false,
    };
  }
}
