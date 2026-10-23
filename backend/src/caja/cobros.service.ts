import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, EstadoValor, MedioPago, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { reservarCorrelativos } from '../rentas/correlativos.js';
import { cargarTasas, iso, liquidarCuenta } from '../rentas/estado-cuenta/tasas.js';
import { hoyLima } from '../rentas/fechas.js';
import {
  type CuotaACobrar,
  ESTADOS_COBRABLES,
  errorCobro,
  errorEstadoCuotas,
  errorOrdenConvenio,
  lineasPago,
  montoEnLetras,
  todoPagado,
  totalCoincide,
  totalRecibo,
} from './caja.reglas.js';

type Db = PrismaService | Prisma.TransactionClient;
type Tx = Prisma.TransactionClient;

const OPCIONES_TX = { maxWait: 10_000, timeout: 30_000 };
const VALOR_COBRABLE: EstadoValor[] = [EstadoValor.EMITIDO, EstadoValor.NOTIFICADO, EstadoValor.COACTIVO];

export interface SeleccionCobro {
  contribuyenteId: number;
  cuentaIds: number[];
}

export interface FiltrosRecibos {
  fecha?: string; // día de caja AAAA-MM-DD (por defecto hoy, salvo que se busque por número o contribuyente)
  numero?: string; // "2026-000004" o "4"
  contribuyenteId?: number;
  cajeroId?: number;
}

// Ver recibos de otros cajeros exige reportes o extornos; si no, solo los propios (K6, decisión 7).
const NIVELES_VER_TODOS = ['caja.reportes', 'caja.extornos'];
const MAX_RECIBOS = 200;

export interface EntradaCobro extends SeleccionCobro {
  medioPago: MedioPago;
  numOperacion?: string;
  totalEsperado: number;
}

const SELECT_PREDIO = {
  id: true,
  numero: true,
  manzana: true,
  lote: true,
  via: { select: { tipoVia: true, nombre: true } },
} as const;

const SELECT_CUENTA = {
  id: true,
  contribuyenteId: true,
  anioFiscal: true,
  cuota: true,
  importe: true,
  derechoEmision: true,
  fechaVencimiento: true,
  estado: true,
  tributo: { select: { codigo: true, nombre: true, tipo: true } },
  predio: { select: SELECT_PREDIO },
  // Una cuota FRACCION pertenece a un solo convenio; sin filtrar por estado, el recibo lo muestra
  // aunque el convenio ya esté CANCELADO.
  convenioDetalles: {
    select: { convenioId: true, cuotaNumero: true, convenio: { select: { numero: true } } },
    take: 1,
  },
} as const;

const n2 = (x: Prisma.Decimal) => x.toFixed(2);

// Cobro en ventanilla (specs/caja-v1.md, K1–K3). La deuda se liquida en el servidor a la fecha
// de caja (hoy, hora Lima); en una sola transacción: cuotas → CANCELADO, recibo REC + un pago por
// cuota, y la OP/RD o el convenio que queden pagados por completo → CANCELADO.
@Injectable()
export class CobrosService {
  constructor(private readonly prisma: PrismaService) {}

  // Vista previa: valida la selección y devuelve el total que se cobrará hoy. No escribe.
  async liquidar(seleccion: SeleccionCobro) {
    const { respuesta } = await this.preparar(this.prisma, seleccion);
    return respuesta;
  }

  async cobrar(entrada: EntradaCobro, usuario: AuthenticatedUser) {
    const hoy = hoyLima();
    const { id } = await this.prisma.$transaction(async (tx) => {
      const cerroHoy = await this.cerroHoy(tx, usuario.id, hoy);
      const error = errorCobro({ ...entrada, cerroHoy });
      if (error) {
        throw new BadRequestException(error);
      }
      const { respuesta, cuotas } = await this.preparar(tx, entrada, hoy);
      if (!totalCoincide(entrada.totalEsperado, respuesta.total)) {
        throw new ConflictException(`La deuda cambió: hoy el total es S/ ${respuesta.total}. Vuelve a consultar antes de cobrar`);
      }

      // Toma cada cuota solo si sigue en el estado leído: dos cajeros no cobran la misma, y el
      // estado previo guardado en el pago es exacto (el extorno vuelve ahí).
      for (const estado of ESTADOS_COBRABLES) {
        const ids = cuotas.filter((c) => c.estado === estado).map((c) => c.id);
        if (ids.length === 0) continue;
        const { count } = await tx.cuentaCorriente.updateMany({
          where: { id: { in: ids }, estado },
          data: { estado: EstadoCuenta.CANCELADO },
        });
        if (count !== ids.length) {
          throw new ConflictException('Alguna cuota se cobró o cambió de estado mientras la elegías; vuelve a consultar');
        }
      }

      const anio = Number(hoy.slice(0, 4));
      const [numero] = await reservarCorrelativos(tx, 'REC', anio);
      const lineas = lineasPago(cuotas);
      const recibo = await tx.recibo.create({
        data: {
          anio,
          numero,
          contribuyenteId: entrada.contribuyenteId,
          cajeroId: usuario.id,
          fechaCaja: new Date(hoy),
          total: totalRecibo(lineas),
          medioPago: entrada.medioPago,
          numOperacion: entrada.medioPago === MedioPago.EFECTIVO ? null : entrada.numOperacion?.trim(),
        },
        select: { id: true },
      });
      await tx.pago.createMany({
        data: lineas.map((l) => ({
          reciboId: recibo.id,
          cuentaCorrienteId: l.cuentaId,
          contribuyenteId: entrada.contribuyenteId,
          importe: l.importe,
          reajuste: l.reajuste,
          moraPagada: l.mora,
          derechoEmision: l.derechoEmision,
          subtotal: l.subtotal,
          estadoAnterior: l.estadoAnterior,
        })),
      });
      await this.cancelarPagados(tx, cuotas.map((c) => c.id));
      return recibo;
    }, OPCIONES_TX);
    return this.obtener(id);
  }

  async obtener(id: number) {
    const r = await this.prisma.recibo.findUnique({
      where: { id },
      include: {
        contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true, direccionFiscal: true, codigoLegacy: true } },
        cajero: { select: { id: true, usuario: true, nombres: true, apellidos: true } },
        extornadoPor: { select: { usuario: true, nombres: true, apellidos: true } },
        pagos: {
          select: {
            id: true,
            importe: true,
            reajuste: true,
            moraPagada: true,
            derechoEmision: true,
            subtotal: true,
            estado: true,
            cuentaCorriente: { select: SELECT_CUENTA },
          },
        },
      },
    });
    if (!r) {
      throw new NotFoundException('El recibo no existe');
    }
    const nombre = (u: { nombres: string; apellidos: string } | null) => (u ? `${u.nombres} ${u.apellidos}`.trim() : null);
    return {
      id: r.id,
      numero: `${r.anio}-${r.numero}`,
      fecha: r.fecha.toISOString(),
      fechaCaja: iso(r.fechaCaja),
      estado: r.estado,
      medioPago: r.medioPago,
      numOperacion: r.numOperacion,
      total: n2(r.total),
      totalEnLetras: montoEnLetras(r.total),
      contribuyente: r.contribuyente,
      cajero: { id: r.cajero.id, usuario: r.cajero.usuario, nombre: nombre(r.cajero) },
      extorno:
        r.estado === EstadoCuenta.EXTORNADO
          ? { motivo: r.motivoExtorno, fecha: r.fechaExtorno?.toISOString() ?? null, por: nombre(r.extornadoPor) }
          : null,
      lineas: r.pagos
        .map((p) => {
          const c = p.cuentaCorriente;
          const conv = c.convenioDetalles[0];
          return {
            id: p.id,
            anio: c.anioFiscal,
            cuota: c.cuota,
            tributo: c.tributo,
            predio: c.predio,
            convenio: conv ? { numero: conv.convenio.numero, cuotaNumero: conv.cuotaNumero } : null,
            insoluto: n2(p.importe),
            reajuste: n2(p.reajuste),
            mora: n2(p.moraPagada),
            derechoEmision: n2(p.derechoEmision),
            total: n2(p.subtotal),
          };
        })
        .sort((a, b) => a.anio - b.anio || a.tributo.codigo.localeCompare(b.tributo.codigo) || a.cuota - b.cuota),
    };
  }

  async listar(f: FiltrosRecibos, usuario: AuthenticatedUser) {
    const where: Prisma.ReciboWhereInput = {};
    if (f.numero) {
      const [a, n] = f.numero.includes('-') ? f.numero.split('-') : [null, f.numero];
      if (!/^\d{1,7}$/.test(n) || (a !== null && !/^\d{4}$/.test(a))) {
        throw new BadRequestException('El número de recibo debe tener la forma 2026-000123 o 123');
      }
      where.numero = n.padStart(6, '0');
      if (a) where.anio = Number(a);
    }
    if (f.contribuyenteId) where.contribuyenteId = f.contribuyenteId;
    if (f.fecha || (!f.numero && !f.contribuyenteId)) {
      const fecha = f.fecha ?? hoyLima();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
        throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD');
      }
      where.fechaCaja = new Date(fecha);
    }
    const verTodos = usuario.niveles.some((n) => NIVELES_VER_TODOS.includes(n));
    if (!verTodos) where.cajeroId = usuario.id;
    else if (f.cajeroId) where.cajeroId = f.cajeroId;

    const recibos = await this.prisma.recibo.findMany({
      where,
      select: {
        id: true,
        anio: true,
        numero: true,
        fecha: true,
        fechaCaja: true,
        total: true,
        medioPago: true,
        estado: true,
        cajeroId: true,
        cajero: { select: { usuario: true } },
        contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
        _count: { select: { pagos: true } },
      },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: MAX_RECIBOS,
    });
    return recibos.map(({ anio, numero, fecha, fechaCaja, total, cajero, _count, ...r }) => ({
      ...r,
      numero: `${anio}-${numero}`,
      fecha: fecha.toISOString(),
      fechaCaja: iso(fechaCaja),
      total: n2(total),
      cajero: cajero.usuario,
      cuotas: _count.pagos,
    }));
  }

  private async cerroHoy(db: Db, cajeroId: number, hoy: string) {
    const cierre = await db.cierreCaja.findUnique({ where: { cajeroId_fecha: { cajeroId, fecha: new Date(hoy) } }, select: { id: true } });
    return cierre !== null;
  }

  // Lee y liquida a `fecha` las cuotas elegidas; valida que sean del contribuyente, cobrables y en orden.
  private async preparar(db: Db, seleccion: SeleccionCobro, fecha = hoyLima()) {
    const ids = [...new Set(seleccion.cuentaIds)];
    const [cuentas, { ipm, tim }] = await Promise.all([
      db.cuentaCorriente.findMany({ where: { id: { in: ids } }, select: SELECT_CUENTA }),
      cargarTasas(db),
    ]);
    if (cuentas.length !== ids.length || cuentas.some((c) => c.contribuyenteId !== seleccion.contribuyenteId)) {
      throw new BadRequestException('Alguna cuota no existe o no pertenece a este contribuyente');
    }
    const errorEstado = errorEstadoCuotas(cuentas);
    if (errorEstado) {
      throw new ConflictException(errorEstado);
    }

    const cuotas: CuotaACobrar[] = cuentas.map((c) => {
      const l = liquidarCuenta(c, fecha, ipm, tim);
      const conv = c.convenioDetalles[0];
      return {
        id: c.id,
        estado: c.estado,
        liquidacion: { insoluto: l.insoluto, reajuste: l.reajuste, mora: l.mora, derechoEmision: l.derechoEmision, total: l.total },
        convenio: conv ? { convenioId: conv.convenioId, cuotaNumero: conv.cuotaNumero } : null,
      };
    });
    const convenioIds = [...new Set(cuotas.flatMap((c) => (c.convenio ? [c.convenio.convenioId] : [])))];
    const cronogramas = new Map<number, { cuotaNumero: number; estado: EstadoCuenta }[]>();
    if (convenioIds.length) {
      const detalles = await db.convenioDet.findMany({
        where: { convenioId: { in: convenioIds } },
        select: { convenioId: true, cuotaNumero: true, cuentaCorriente: { select: { estado: true } } },
      });
      for (const d of detalles) {
        cronogramas.set(d.convenioId, [...(cronogramas.get(d.convenioId) ?? []), { cuotaNumero: d.cuotaNumero, estado: d.cuentaCorriente.estado }]);
      }
    }
    const errorOrden = errorOrdenConvenio(cuotas, cronogramas);
    if (errorOrden) {
      throw new BadRequestException(errorOrden);
    }

    const porId = new Map(cuentas.map((c) => [c.id, c]));
    const lineas = cuotas
      .map((q) => {
        const c = porId.get(q.id)!;
        const conv = c.convenioDetalles[0];
        return {
          id: c.id,
          anio: c.anioFiscal,
          cuota: c.cuota,
          tributo: c.tributo,
          predio: c.predio,
          estado: c.estado,
          vencimiento: c.fechaVencimiento ? iso(c.fechaVencimiento) : null,
          convenio: conv ? { numero: conv.convenio.numero, cuotaNumero: conv.cuotaNumero } : null,
          insoluto: n2(q.liquidacion.insoluto),
          reajuste: n2(q.liquidacion.reajuste),
          mora: n2(q.liquidacion.mora),
          derechoEmision: n2(q.liquidacion.derechoEmision),
          total: n2(q.liquidacion.total),
        };
      })
      .sort((a, b) => a.anio - b.anio || a.tributo.codigo.localeCompare(b.tributo.codigo) || a.cuota - b.cuota);
    const avisos = cuotas.some((c) => c.estado === EstadoCuenta.COACTIVO)
      ? ['Hay cuotas en cobranza coactiva: se cobran sin costas (decisión 6).']
      : [];
    return {
      cuotas,
      respuesta: { fecha, contribuyenteId: seleccion.contribuyenteId, lineas, total: n2(totalRecibo(lineasPago(cuotas))), avisos },
    };
  }

  // K3: convenios con todo el cronograma pagado → CANCELADO, y sus deudas originales FRACCIONADO →
  // CANCELADO (decisión 9); luego, las OP/RD cuyas cuotas quedaron todas pagadas → CANCELADO.
  private async cancelarPagados(tx: Tx, cuentaIds: number[]) {
    await tx.convenioDet.updateMany({ where: { cuentaCorrienteId: { in: cuentaIds } }, data: { estado: EstadoCuenta.CANCELADO } });

    const convenios = await tx.convenioCab.findMany({
      where: { estado: EstadoCuenta.FRACCIONADO, detalles: { some: { cuentaCorrienteId: { in: cuentaIds } } } },
      select: { id: true, detalles: { select: { cuentaCorriente: { select: { estado: true } } } }, deudas: { select: { cuentaCorrienteId: true } } },
    });
    const pagados = convenios.filter((c) => todoPagado(c.detalles.map((d) => d.cuentaCorriente.estado)));
    const originales = pagados.flatMap((c) => c.deudas.map((d) => d.cuentaCorrienteId));
    if (pagados.length) {
      await tx.convenioCab.updateMany({
        where: { id: { in: pagados.map((c) => c.id) }, estado: EstadoCuenta.FRACCIONADO },
        data: { estado: EstadoCuenta.CANCELADO },
      });
      await tx.cuentaCorriente.updateMany({
        where: { id: { in: originales }, estado: EstadoCuenta.FRACCIONADO },
        data: { estado: EstadoCuenta.CANCELADO },
      });
    }

    // Una deuda original fraccionada puede estar en una OP/RD: también cuenta para cancelar el valor.
    const tocadas = [...cuentaIds, ...originales];
    const valores = await tx.valorCab.findMany({
      where: { estado: { in: VALOR_COBRABLE }, detalles: { some: { cuentaCorrienteId: { in: tocadas } } } },
      select: { id: true, detalles: { select: { cuentaCorriente: { select: { estado: true } } } } },
    });
    const valoresPagados = valores.filter((v) => todoPagado(v.detalles.map((d) => d.cuentaCorriente.estado))).map((v) => v.id);
    if (valoresPagados.length) {
      await tx.valorCab.updateMany({
        where: { id: { in: valoresPagados }, estado: { in: VALOR_COBRABLE } },
        data: { estado: EstadoValor.CANCELADO },
      });
    }
  }
}
