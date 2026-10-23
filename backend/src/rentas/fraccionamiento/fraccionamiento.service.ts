import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { reservarCorrelativos } from '../correlativos.js';
import { cargarTasas, iso, liquidarCuenta } from '../estado-cuenta/tasas.js';
import { hoyLima } from '../fechas.js';
import { ESTADOS_VALOR_VIGENTE } from '../valores/valores.reglas.js';
import { cronograma, cuotaInicialMinima, errorAnulacionConvenio, errorConvenio } from './fraccionamiento.reglas.js';

const D = Prisma.Decimal;
type Tx = Prisma.TransactionClient;

export const TRIBUTO_FRACCION = 'FRACCION';

export interface ConvenioEntrada {
  contribuyenteId: number;
  cuentaIds: number[];
  cuotaInicial: number;
  numCuotas: number;
}

const SELECT_PREDIO = {
  id: true,
  numero: true,
  manzana: true,
  lote: true,
  via: { select: { tipoVia: true, nombre: true } },
  urbanizacion: { select: { nombre: true } },
} as const;

const SELECT_CUENTA = {
  id: true,
  anioFiscal: true,
  cuota: true,
  importe: true,
  derechoEmision: true,
  fechaVencimiento: true,
  estado: true,
  tributo: { select: { codigo: true, nombre: true, tipo: true } },
  predio: { select: SELECT_PREDIO },
} as const;

// Fraccionamiento (specs/rentas-valores-v1.md, V6). Simular no escribe; grabar en una transacción:
// deudas originales → FRACCIONADO (con su liquidación a la fecha en convenio_deudas) y una fila
// nueva en cuenta_corriente (tributo FRACCION) por cuota del cronograma, para que Caja la cobre.
@Injectable()
export class FraccionamientoService {
  constructor(private readonly prisma: PrismaService) {}

  // Deudas que se pueden incluir en un convenio: PENDIENTE y que no sean ya cuotas de otro convenio.
  async deudas(contribuyenteId: number) {
    const hoy = hoyLima();
    const [cuentas, { ipm, tim }] = await Promise.all([
      this.prisma.cuentaCorriente.findMany({
        where: { contribuyenteId, estado: EstadoCuenta.PENDIENTE, tributo: { codigo: { not: TRIBUTO_FRACCION } } },
        select: {
          ...SELECT_CUENTA,
          valorDetalles: {
            where: { valor: { estado: { in: ESTADOS_VALOR_VIGENTE } } },
            select: { valor: { select: { tipo: true, anio: true, numero: true } } },
            take: 1,
          },
        },
        orderBy: [{ anioFiscal: 'asc' }, { tributoId: 'asc' }, { predioId: 'asc' }, { cuota: 'asc' }],
      }),
      cargarTasas(this.prisma),
    ]);
    return {
      fecha: hoy,
      deudas: cuentas.map(({ valorDetalles, ...c }) => ({
        ...this.lineaDeuda(c, liquidarCuenta(c, hoy, ipm, tim)),
        valor: valorDetalles[0]?.valor ?? null,
      })),
    };
  }

  simular(entrada: ConvenioEntrada) {
    return this.prisma.$transaction(async (tx) => (await this.preparar(tx, entrada)).respuesta);
  }

  ejecutar(entrada: ConvenioEntrada) {
    return this.prisma.$transaction(async (tx) => {
      const { respuesta, plan, liquidadas, anio, fecha } = await this.preparar(tx, entrada);
      const ids = liquidadas.map((l) => l.id);

      // Toma las deudas solo si siguen PENDIENTE: dos convenios simultáneos no pueden incluir la misma.
      const { count } = await tx.cuentaCorriente.updateMany({
        where: { id: { in: ids }, estado: EstadoCuenta.PENDIENTE },
        data: { estado: EstadoCuenta.FRACCIONADO },
      });
      if (count !== ids.length) {
        throw new ConflictException('Alguna deuda cambió de estado mientras armabas el convenio; vuelve a simular');
      }

      const tributo = await tx.tributo.findUnique({ where: { codigo: TRIBUTO_FRACCION }, select: { id: true } });
      if (!tributo) {
        throw new BadRequestException('Falta el tributo FRACCION en la base: ejecuta "npx prisma db seed"');
      }
      const [correlativo] = await reservarCorrelativos(tx, 'CONV', anio);
      const numero = `${anio}-${correlativo}`;
      const convenio = await tx.convenioCab.create({
        data: {
          numero,
          contribuyenteId: entrada.contribuyenteId,
          fecha: new Date(fecha),
          montoTotal: respuesta.total,
          cuotaInicial: entrada.cuotaInicial,
          numCuotas: entrada.numCuotas,
          interesMensual: respuesta.interesMensual,
        },
        select: { id: true },
      });
      await tx.convenioDeuda.createMany({
        data: liquidadas.map((l) => ({
          convenioId: convenio.id,
          cuentaCorrienteId: l.id,
          insoluto: l.liq.insoluto,
          reajuste: l.liq.reajuste,
          mora: l.liq.mora,
          subtotal: l.liq.total,
        })),
      });
      const cuotas = await tx.cuentaCorriente.createManyAndReturn({
        data: plan.map((c) => ({
          contribuyenteId: entrada.contribuyenteId,
          tributoId: tributo.id,
          anioFiscal: anio,
          cuota: c.numero,
          importe: c.monto,
          fechaVencimiento: new Date(c.vencimiento),
        })),
        select: { id: true, cuota: true },
      });
      const cuentaPorNumero = new Map(cuotas.map((c) => [c.cuota, c.id]));
      await tx.convenioDet.createMany({
        data: plan.map((c) => ({
          convenioId: convenio.id,
          cuentaCorrienteId: cuentaPorNumero.get(c.numero)!,
          cuotaNumero: c.numero,
          amortizacion: c.amortizacion,
          interes: c.interes,
          monto: c.monto,
          fechaVencimiento: new Date(c.vencimiento),
        })),
      });
      return { ...respuesta, ejecutado: true, convenioId: convenio.id, numero };
    });
  }

  // Anula un convenio sin pagos: cuotas FRACCION → ANULADO y las deudas originales vuelven a PENDIENTE.
  async anular(id: number, motivo: string) {
    await this.prisma.$transaction(async (tx) => {
      const convenio = await tx.convenioCab.findUnique({
        where: { id },
        select: {
          estado: true,
          detalles: { select: { cuentaCorrienteId: true, cuentaCorriente: { select: { estado: true } } } },
          deudas: { select: { cuentaCorrienteId: true } },
        },
      });
      if (!convenio) {
        throw new NotFoundException('El convenio no existe');
      }
      const pagadas = convenio.detalles.filter((d) => d.cuentaCorriente.estado === EstadoCuenta.CANCELADO).length;
      const error = errorAnulacionConvenio(convenio.estado, pagadas, motivo);
      if (error) {
        throw new BadRequestException(error);
      }
      const { count } = await tx.convenioCab.updateMany({
        where: { id, estado: EstadoCuenta.FRACCIONADO },
        data: { estado: EstadoCuenta.ANULADO, motivoAnulacion: motivo.trim() },
      });
      if (count === 0) {
        throw new ConflictException('El convenio cambió de estado mientras lo editabas; recarga la página');
      }
      await tx.convenioDet.updateMany({ where: { convenioId: id }, data: { estado: EstadoCuenta.ANULADO } });
      await tx.cuentaCorriente.updateMany({
        where: { id: { in: convenio.detalles.map((d) => d.cuentaCorrienteId) }, estado: EstadoCuenta.PENDIENTE },
        data: { estado: EstadoCuenta.ANULADO },
      });
      await tx.cuentaCorriente.updateMany({
        where: { id: { in: convenio.deudas.map((d) => d.cuentaCorrienteId) }, estado: EstadoCuenta.FRACCIONADO },
        data: { estado: EstadoCuenta.PENDIENTE },
      });
    });
    return this.obtener(id);
  }

  async listar(contribuyenteId: number) {
    const convenios = await this.prisma.convenioCab.findMany({
      where: { contribuyenteId },
      select: {
        id: true,
        numero: true,
        fecha: true,
        montoTotal: true,
        cuotaInicial: true,
        numCuotas: true,
        estado: true,
        detalles: { select: { monto: true, cuentaCorriente: { select: { estado: true } } } },
      },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    });
    return convenios.map(({ detalles, fecha, ...c }) => ({
      ...c,
      fecha: iso(fecha),
      totalCronograma: detalles.reduce((a, d) => a.plus(d.monto), new D(0)).toFixed(2),
      cuotasPendientes: detalles.filter((d) => d.cuentaCorriente.estado === EstadoCuenta.PENDIENTE).length,
    }));
  }

  async obtener(id: number) {
    const convenio = await this.prisma.convenioCab.findUnique({
      where: { id },
      include: {
        contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true, direccionFiscal: true } },
        deudas: { select: { id: true, insoluto: true, reajuste: true, mora: true, subtotal: true, cuentaCorriente: { select: SELECT_CUENTA } } },
        detalles: {
          select: {
            id: true,
            cuotaNumero: true,
            amortizacion: true,
            interes: true,
            monto: true,
            fechaVencimiento: true,
            cuentaCorriente: { select: { id: true, estado: true } },
          },
          orderBy: { cuotaNumero: 'asc' },
        },
      },
    });
    if (!convenio) {
      throw new NotFoundException('El convenio no existe');
    }
    const n = (x: Prisma.Decimal) => x.toFixed(2);
    return {
      id: convenio.id,
      numero: convenio.numero,
      fecha: iso(convenio.fecha),
      estado: convenio.estado,
      motivoAnulacion: convenio.motivoAnulacion,
      montoTotal: n(convenio.montoTotal),
      cuotaInicial: n(convenio.cuotaInicial),
      numCuotas: convenio.numCuotas,
      interesMensual: convenio.interesMensual.toString(),
      contribuyente: convenio.contribuyente,
      deudas: convenio.deudas
        .map((d) => ({
          id: d.id,
          anio: d.cuentaCorriente.anioFiscal,
          cuota: d.cuentaCorriente.cuota,
          tributo: d.cuentaCorriente.tributo,
          predio: d.cuentaCorriente.predio,
          estadoCuenta: d.cuentaCorriente.estado,
          insoluto: n(d.insoluto),
          reajuste: n(d.reajuste),
          mora: n(d.mora),
          subtotal: n(d.subtotal),
        }))
        .sort((a, b) => a.anio - b.anio || a.tributo.codigo.localeCompare(b.tributo.codigo) || a.cuota - b.cuota),
      cronograma: convenio.detalles.map((d) => ({
        numero: d.cuotaNumero,
        vencimiento: iso(d.fechaVencimiento),
        amortizacion: n(d.amortizacion),
        interes: n(d.interes),
        monto: n(d.monto),
        estado: d.cuentaCorriente.estado,
      })),
      totalIntereses: n(convenio.detalles.reduce((a, d) => a.plus(d.interes), new D(0))),
      totalAPagar: n(convenio.detalles.reduce((a, d) => a.plus(d.monto), new D(0))),
    };
  }

  private async preparar(tx: Tx, entrada: ConvenioEntrada) {
    const ids = [...new Set(entrada.cuentaIds)];
    if (ids.length === 0) {
      throw new BadRequestException('Elige al menos una deuda');
    }
    const fecha = hoyLima();
    const anio = Number(fecha.slice(0, 4));
    const [cuentas, limites, { ipm, tim }] = await Promise.all([
      tx.cuentaCorriente.findMany({ where: { id: { in: ids }, contribuyenteId: entrada.contribuyenteId }, select: SELECT_CUENTA }),
      tx.parametroFraccionamiento.findUnique({ where: { anio } }),
      cargarTasas(tx),
    ]);
    const invalidas = ids.filter((id) => {
      const c = cuentas.find((x) => x.id === id);
      return !c || c.estado !== EstadoCuenta.PENDIENTE || c.tributo.codigo === TRIBUTO_FRACCION;
    });
    if (invalidas.length) {
      throw new BadRequestException(`Hay ${invalidas.length} deuda(s) que no se pueden fraccionar (ya no están pendientes o no son de este contribuyente)`);
    }

    const liquidadas = cuentas.map((c) => ({ id: c.id, cuenta: c, liq: liquidarCuenta(c, fecha, ipm, tim) }));
    const total = liquidadas.reduce((a, l) => a.plus(l.liq.total), new D(0));
    const error = errorConvenio(limites, anio, { total, cuotaInicial: entrada.cuotaInicial, numCuotas: entrada.numCuotas });
    if (error) {
      throw new BadRequestException(error);
    }
    const interes = limites!.interesMensual;
    const plan = cronograma(total, entrada.cuotaInicial, entrada.numCuotas, interes, fecha);
    const totalIntereses = plan.reduce((a, c) => a.plus(c.interes), new D(0));

    const respuesta = {
      fecha,
      anio,
      total: total.toFixed(2),
      cuotaInicial: new D(entrada.cuotaInicial).toFixed(2),
      cuotaInicialMinima: cuotaInicialMinima(total, limites!.cuotaInicialMinPct).toFixed(2),
      numCuotas: entrada.numCuotas,
      cuotasMax: limites!.cuotasMax,
      interesMensual: interes.toString(),
      ordenanza: limites!.ordenanza,
      totalIntereses: totalIntereses.toFixed(2),
      totalAPagar: total.plus(totalIntereses).toFixed(2),
      deudas: liquidadas.map((l) => this.lineaDeuda(l.cuenta, l.liq)),
      cronograma: plan.map((c) => ({
        numero: c.numero,
        vencimiento: c.vencimiento,
        amortizacion: c.amortizacion.toFixed(2),
        interes: c.interes.toFixed(2),
        monto: c.monto.toFixed(2),
      })),
      ejecutado: false,
    };
    return { respuesta, plan, liquidadas, anio, fecha };
  }

  private lineaDeuda(
    c: Prisma.CuentaCorrienteGetPayload<{ select: typeof SELECT_CUENTA }>,
    l: { insoluto: Prisma.Decimal; reajuste: Prisma.Decimal; mora: Prisma.Decimal; derechoEmision: Prisma.Decimal; total: Prisma.Decimal; diasAtraso: number },
  ) {
    return {
      id: c.id,
      anio: c.anioFiscal,
      cuota: c.cuota,
      tributo: c.tributo,
      predio: c.predio,
      vencimiento: c.fechaVencimiento ? iso(c.fechaVencimiento) : null,
      diasAtraso: l.diasAtraso,
      insoluto: l.insoluto.toFixed(2),
      reajuste: l.reajuste.toFixed(2),
      mora: l.mora.toFixed(2),
      derechoEmision: l.derechoEmision.toFixed(2),
      total: l.total.toFixed(2),
    };
  }
}
