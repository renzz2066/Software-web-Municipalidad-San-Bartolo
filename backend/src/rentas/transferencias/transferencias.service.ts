import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, EstadoValor, Prisma, TipoValor } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { reservarCorrelativos } from '../correlativos.js';
import { cargarTasas, iso, liquidarCuenta } from '../estado-cuenta/tasas.js';
import { hoyLima } from '../fechas.js';
import { ESTADOS_VALOR_VIGENTE, motivoNoTransferible, type MotivoNoTransferible } from '../valores/valores.reglas.js';

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;

export interface TransferenciaEntrada {
  tipos?: TipoValor[];
  valorIds?: number[]; // sin lista = todos los exigibles
}

const OPCIONES_TX = { maxWait: 10_000, timeout: 120_000 };
// Serializa transferencias: un valor no puede ir en dos memorándums.
const LOCK_TRANSFERENCIA = 7_301_002;

const SELECT_VALOR = {
  id: true,
  tipo: true,
  anio: true,
  numero: true,
  estado: true,
  fechaNotificacion: true,
  fechaExigible: true,
  contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
  predio: {
    select: {
      id: true,
      numero: true,
      manzana: true,
      lote: true,
      via: { select: { tipoVia: true, nombre: true } },
      urbanizacion: { select: { nombre: true } },
    },
  },
  detalles: {
    select: {
      cuentaCorriente: {
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
      },
    },
  },
} as const;

type ValorTransferible = Prisma.ValorCabGetPayload<{ select: typeof SELECT_VALOR }>;

// Transferencia de valores exigibles a Cobranza Coactiva por memorándum (specs/rentas-valores-v1.md, V7).
// El valor pasa a COACTIVO y sus cuotas PENDIENTE también; la recepción la registra Coactiva.
@Injectable()
export class TransferenciasService {
  constructor(private readonly prisma: PrismaService) {}

  simular(entrada: TransferenciaEntrada) {
    return this.prisma.$transaction(async (tx) => (await this.preparar(tx, entrada)).respuesta, OPCIONES_TX);
  }

  ejecutar(entrada: TransferenciaEntrada) {
    return this.prisma.$transaction(async (tx) => {
      // $executeRaw: la función devuelve void y $queryRaw no puede deserializarlo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_TRANSFERENCIA})`;
      const { respuesta, transferibles, fecha } = await this.preparar(tx, entrada);
      if (transferibles.length === 0) {
        throw new BadRequestException('No hay valores exigibles para transferir');
      }
      const anio = Number(fecha.slice(0, 4));
      const [numero] = await reservarCorrelativos(tx, 'MEMO', anio);
      const transferencia = await tx.transferenciaCoactivo.create({
        data: { anio, numero, fecha: new Date(fecha), cantidad: transferibles.length, monto: respuesta.monto },
        select: { id: true },
      });
      const { count } = await tx.valorCab.updateMany({
        where: { id: { in: transferibles.map((t) => t.valor.id) }, estado: EstadoValor.NOTIFICADO },
        data: { estado: EstadoValor.COACTIVO, transferenciaId: transferencia.id },
      });
      if (count !== transferibles.length) {
        throw new ConflictException('Algún valor cambió de estado mientras preparabas la transferencia; vuelve a simular');
      }
      await tx.cuentaCorriente.updateMany({
        where: { id: { in: transferibles.flatMap((t) => t.pendientes) }, estado: EstadoCuenta.PENDIENTE },
        data: { estado: EstadoCuenta.COACTIVO },
      });
      return { ...respuesta, ejecutado: true, transferenciaId: transferencia.id, numero: `${anio}-${numero}` };
    }, OPCIONES_TX);
  }

  listar() {
    return this.prisma.transferenciaCoactivo.findMany({
      select: { id: true, anio: true, numero: true, fecha: true, cantidad: true, monto: true, estado: true },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  }

  // Memorándum: cada valor con su deuda liquidada a la fecha de la transferencia.
  async obtener(id: number) {
    const t = await this.prisma.transferenciaCoactivo.findUnique({
      where: { id },
      include: { valores: { select: SELECT_VALOR, orderBy: [{ tipo: 'asc' }, { numero: 'asc' }] } },
    });
    if (!t) {
      throw new NotFoundException('La transferencia no existe');
    }
    const fecha = iso(t.fecha);
    const { ipm, tim } = await cargarTasas(this.prisma);
    return {
      id: t.id,
      anio: t.anio,
      numero: t.numero,
      fecha,
      cantidad: t.cantidad,
      monto: t.monto.toFixed(2),
      estado: t.estado,
      valores: t.valores.map((v) => {
        const cuotas = v.detalles.map((d) => d.cuentaCorriente).filter((c) => c.estado === EstadoCuenta.COACTIVO);
        return this.fila(v, cuotas, fecha, ipm, tim);
      }),
    };
  }

  private async preparar(tx: Tx, entrada: TransferenciaEntrada) {
    const fecha = hoyLima();
    const tipos = entrada.tipos?.length ? entrada.tipos : [TipoValor.OP, TipoValor.RD];
    const [valores, { ipm, tim }] = await Promise.all([
      tx.valorCab.findMany({
        where: {
          estado: { in: ESTADOS_VALOR_VIGENTE },
          tipo: { in: tipos },
          ...(entrada.valorIds?.length ? { id: { in: entrada.valorIds } } : {}),
        },
        select: SELECT_VALOR,
        orderBy: [{ tipo: 'asc' }, { anio: 'asc' }, { numero: 'asc' }],
      }),
      cargarTasas(tx),
    ]);

    const excluidos: Record<MotivoNoTransferible, number> = { noNotificado: 0, plazoVigente: 0, sinDeudaPendiente: 0 };
    const transferibles: { valor: ValorTransferible; pendientes: number[]; fila: ReturnType<TransferenciasService['fila']> }[] = [];
    for (const v of valores) {
      const pendientes = v.detalles.map((d) => d.cuentaCorriente).filter((c) => c.estado === EstadoCuenta.PENDIENTE);
      const motivo = motivoNoTransferible(
        { estado: v.estado, fechaExigible: v.fechaExigible ? iso(v.fechaExigible) : null },
        pendientes.length,
        fecha,
      );
      if (motivo) {
        excluidos[motivo]++;
        continue;
      }
      transferibles.push({ valor: v, pendientes: pendientes.map((c) => c.id), fila: this.fila(v, pendientes, fecha, ipm, tim) });
    }
    const monto = transferibles.reduce((a, t) => a.plus(t.fila.deuda), new D(0));
    const respuesta = {
      fecha,
      tipos,
      cantidad: transferibles.length,
      monto: monto.toFixed(2),
      excluidos,
      valores: transferibles.map((t) => t.fila),
      ejecutado: false,
    };
    return { respuesta, transferibles, fecha };
  }

  private fila(
    v: ValorTransferible,
    cuotas: ValorTransferible['detalles'][number]['cuentaCorriente'][],
    fecha: string,
    ipm: Awaited<ReturnType<typeof cargarTasas>>['ipm'],
    tim: Awaited<ReturnType<typeof cargarTasas>>['tim'],
  ) {
    const deuda = cuotas.reduce((a, c) => a.plus(liquidarCuenta(c, fecha, ipm, tim).total), new D(0));
    return {
      id: v.id,
      tipo: v.tipo,
      anio: v.anio,
      numero: v.numero,
      contribuyente: v.contribuyente,
      predio: v.predio,
      fechaNotificacion: v.fechaNotificacion ? iso(v.fechaNotificacion) : null,
      fechaExigible: v.fechaExigible ? iso(v.fechaExigible) : null,
      cuotas: cuotas.length,
      deuda: deuda.toFixed(2),
    };
  }
}
