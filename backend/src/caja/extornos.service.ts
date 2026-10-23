import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, EstadoValor, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { iso } from '../rentas/estado-cuenta/tasas.js';
import { hoyLima } from '../rentas/fechas.js';
import { type CuotaCronogramaEstado, errorExtorno, errorExtornoConvenio, estadoValorRestaurado } from './caja.reglas.js';
import { CobrosService } from './cobros.service.js';

type Tx = Prisma.TransactionClient;

const OPCIONES_TX = { maxWait: 10_000, timeout: 30_000 };
export const NIVEL_EXTORNOS = 'caja.extornos';

// Extorno de un recibo completo (specs/caja-v1.md, K4 y decisión 7). Inverso del cobro, en una
// transacción: recibo y pagos → EXTORNADO, cada cuota vuelve al estado que tenía antes del cobro
// (PENDIENTE o COACTIVO) y el convenio o la OP/RD que el cobro había cancelado vuelven a vigentes.
@Injectable()
export class ExtornosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cobros: CobrosService,
  ) {}

  async extornar(id: number, motivo: string, usuario: AuthenticatedUser) {
    const hoy = hoyLima();
    await this.prisma.$transaction(async (tx) => {
      const recibo = await tx.recibo.findUnique({
        where: { id },
        select: {
          estado: true,
          cajeroId: true,
          fechaCaja: true,
          pagos: {
            select: {
              cuentaCorrienteId: true,
              estadoAnterior: true,
              cuentaCorriente: { select: { convenioDetalles: { select: { convenioId: true, cuotaNumero: true }, take: 1 } } },
            },
          },
        },
      });
      if (!recibo) {
        throw new NotFoundException('El recibo no existe');
      }
      const cierre = await tx.cierreCaja.findUnique({
        where: { cajeroId_fecha: { cajeroId: usuario.id, fecha: new Date(hoy) } },
        select: { id: true },
      });
      const error = errorExtorno(
        { estado: recibo.estado, cajeroId: recibo.cajeroId, fechaCaja: iso(recibo.fechaCaja) },
        { usuarioId: usuario.id, hoy, puedeExtornarAjenos: usuario.niveles.includes(NIVEL_EXTORNOS), cerroHoy: cierre !== null, motivo },
      );
      if (error) {
        throw new BadRequestException(error);
      }

      const cuentaIds = recibo.pagos.map((p) => p.cuentaCorrienteId);
      const delConvenio = recibo.pagos.flatMap((p) => p.cuentaCorriente.convenioDetalles);
      await this.validarOrdenConvenio(tx, delConvenio);

      const { count } = await tx.recibo.updateMany({
        where: { id, estado: EstadoCuenta.CANCELADO },
        data: {
          estado: EstadoCuenta.EXTORNADO,
          motivoExtorno: motivo.trim(),
          extornadoPorId: usuario.id,
          fechaExtorno: new Date(),
          fechaCajaExtorno: new Date(hoy),
        },
      });
      if (count === 0) {
        throw new ConflictException('El recibo ya fue extornado por otro usuario; recarga la página');
      }
      await tx.pago.updateMany({ where: { reciboId: id }, data: { estado: EstadoCuenta.EXTORNADO } });

      // Antes de devolver las cuotas: las que el cobro cancelaron también cancelaron su convenio/valor.
      await this.reabrirConveniosYValores(tx, cuentaIds);
      for (const estado of new Set(recibo.pagos.map((p) => p.estadoAnterior))) {
        const ids = recibo.pagos.filter((p) => p.estadoAnterior === estado).map((p) => p.cuentaCorrienteId);
        const r = await tx.cuentaCorriente.updateMany({ where: { id: { in: ids }, estado: EstadoCuenta.CANCELADO }, data: { estado } });
        if (r.count !== ids.length) {
          throw new ConflictException('Alguna cuota del recibo ya no está cancelada; revisa su estado de cuenta');
        }
      }
      await tx.convenioDet.updateMany({
        where: { cuentaCorrienteId: { in: cuentaIds }, estado: EstadoCuenta.CANCELADO },
        data: { estado: EstadoCuenta.PENDIENTE },
      });
    }, OPCIONES_TX);
    return this.cobros.obtener(id);
  }

  private async validarOrdenConvenio(tx: Tx, delRecibo: { convenioId: number; cuotaNumero: number }[]) {
    if (delRecibo.length === 0) return;
    const detalles = await tx.convenioDet.findMany({
      where: { convenioId: { in: [...new Set(delRecibo.map((c) => c.convenioId))] } },
      select: { convenioId: true, cuotaNumero: true, cuentaCorriente: { select: { estado: true } } },
    });
    const cronogramas = new Map<number, CuotaCronogramaEstado[]>();
    for (const d of detalles) {
      cronogramas.set(d.convenioId, [...(cronogramas.get(d.convenioId) ?? []), { cuotaNumero: d.cuotaNumero, estado: d.cuentaCorriente.estado }]);
    }
    const error = errorExtornoConvenio(delRecibo, cronogramas);
    if (error) {
      throw new BadRequestException(error);
    }
  }

  // Convenios CANCELADO con alguna de estas cuotas → FRACCIONADO, y sus deudas originales CANCELADO →
  // FRACCIONADO (decisión 9). OP/RD CANCELADO con alguna de estas cuotas (o de esas originales) → el
  // estado que tenían antes de pagarse (COACTIVO, NOTIFICADO o EMITIDO).
  private async reabrirConveniosYValores(tx: Tx, cuentaIds: number[]) {
    const convenios = await tx.convenioCab.findMany({
      where: { estado: EstadoCuenta.CANCELADO, detalles: { some: { cuentaCorrienteId: { in: cuentaIds } } } },
      select: { id: true, deudas: { select: { cuentaCorrienteId: true } } },
    });
    const originales = convenios.flatMap((c) => c.deudas.map((d) => d.cuentaCorrienteId));
    if (convenios.length) {
      await tx.convenioCab.updateMany({
        where: { id: { in: convenios.map((c) => c.id) }, estado: EstadoCuenta.CANCELADO },
        data: { estado: EstadoCuenta.FRACCIONADO },
      });
      await tx.cuentaCorriente.updateMany({
        where: { id: { in: originales }, estado: EstadoCuenta.CANCELADO },
        data: { estado: EstadoCuenta.FRACCIONADO },
      });
    }

    const valores = await tx.valorCab.findMany({
      where: { estado: EstadoValor.CANCELADO, detalles: { some: { cuentaCorrienteId: { in: [...cuentaIds, ...originales] } } } },
      select: { id: true, transferenciaId: true, fechaNotificacion: true },
    });
    for (const v of valores) {
      await tx.valorCab.updateMany({
        where: { id: v.id, estado: EstadoValor.CANCELADO },
        data: { estado: estadoValorRestaurado(v) },
      });
    }
  }
}
