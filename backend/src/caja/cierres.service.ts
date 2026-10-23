import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { iso } from '../rentas/estado-cuenta/tasas.js';
import { hoyLima } from '../rentas/fechas.js';
import { errorCierre, type ReciboResumen, resumenCierre } from './caja.reglas.js';

type Db = PrismaService | Prisma.TransactionClient;

const OPCIONES_TX = { maxWait: 10_000, timeout: 30_000 };
export const NIVEL_REPORTES = 'caja.reportes';

const SELECT_RESUMEN = {
  medioPago: true,
  total: true,
  pagos: { select: { subtotal: true, cuentaCorriente: { select: { tributo: { select: { codigo: true, nombre: true } } } } } },
} as const;

const SELECT_USUARIO = { id: true, usuario: true, nombres: true, apellidos: true } as const;
const nombre = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`.trim();

function fechaValida(fecha: string | undefined): string {
  const f = fecha ?? hoyLima();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || Number.isNaN(Date.parse(f))) {
    throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD');
  }
  return f;
}

// Cierre diario por cajero (specs/caja-v1.md, K5, decisiones 7 y 8): lo que cobró ese día de caja
// (aunque luego se haya extornado) menos lo que él extornó ese día, por medio y por tributo, con
// arqueo opcional del efectivo. El cierre es una foto: no se recalcula ni se reabre.
@Injectable()
export class CierresService {
  constructor(private readonly prisma: PrismaService) {}

  // Resumen del día del usuario: el cierre guardado si ya cerró, o el cálculo en vivo si no.
  async resumen(fechaParam: string | undefined, usuario: AuthenticatedUser) {
    const fecha = fechaValida(fechaParam);
    const [cierre, pendientes] = await Promise.all([
      this.prisma.cierreCaja.findUnique({ where: { cajeroId_fecha: { cajeroId: usuario.id, fecha: new Date(fecha) } }, select: { id: true } }),
      this.diasSinCerrar(usuario.id, hoyLima()),
    ]);
    if (cierre) {
      return { ...(await this.obtener(cierre.id, usuario)), diasSinCerrar: pendientes };
    }
    const [r, cajero] = await Promise.all([
      this.calcular(this.prisma, usuario.id, fecha),
      this.prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id }, select: SELECT_USUARIO }),
    ]);
    return {
      id: null,
      fecha,
      cerrado: false,
      cajero: { id: cajero.id, usuario: cajero.usuario, nombre: nombre(cajero) },
      cantidadRecibos: r.cantidadRecibos,
      cantidadExtornos: r.cantidadExtornos,
      total: r.total.toFixed(2),
      totalesPorMedio: r.totalesPorMedio,
      totalesPorTributo: r.totalesPorTributo,
      efectivoEsperado: r.efectivoEsperado.toFixed(2),
      efectivoDeclarado: null,
      diferencia: null,
      cerradoEn: null,
      diasSinCerrar: pendientes,
    };
  }

  async cerrar(fechaParam: string | undefined, efectivoDeclarado: number | undefined, usuario: AuthenticatedUser) {
    const fecha = fechaValida(fechaParam);
    const { id } = await this.prisma.$transaction(async (tx) => {
      const ya = await tx.cierreCaja.findUnique({ where: { cajeroId_fecha: { cajeroId: usuario.id, fecha: new Date(fecha) } }, select: { id: true } });
      const error = errorCierre(fecha, hoyLima(), ya !== null);
      if (error) {
        throw new BadRequestException(error);
      }
      const r = await this.calcular(tx, usuario.id, fecha, efectivoDeclarado);
      try {
        const cierre = await tx.cierreCaja.create({
          data: {
            cajeroId: usuario.id,
            fecha: new Date(fecha),
            cantidadRecibos: r.cantidadRecibos,
            cantidadExtornos: r.cantidadExtornos,
            total: r.total,
            totalesPorMedio: r.totalesPorMedio,
            totalesPorTributo: r.totalesPorTributo,
            efectivoDeclarado: efectivoDeclarado ?? null,
            diferencia: r.diferencia,
          },
          select: { id: true },
        });
        await tx.recibo.updateMany({
          where: { cajeroId: usuario.id, fechaCaja: new Date(fecha), cierreId: null },
          data: { cierreId: cierre.id },
        });
        return cierre;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Tu caja de ese día ya se cerró en otra pestaña; recarga la página');
        }
        throw e;
      }
    }, OPCIONES_TX);
    return this.obtener(id, usuario);
  }

  // Cierres de un día (K6): los cerrados y los cajeros con movimientos que aún no cierran.
  async listar(fechaParam: string | undefined) {
    const fecha = fechaValida(fechaParam);
    const dia = new Date(fecha);
    const [cierres, conCobros, conExtornos] = await Promise.all([
      this.prisma.cierreCaja.findMany({
        where: { fecha: dia },
        select: {
          id: true,
          cantidadRecibos: true,
          cantidadExtornos: true,
          total: true,
          diferencia: true,
          createdAt: true,
          cajero: { select: SELECT_USUARIO },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.recibo.findMany({ where: { fechaCaja: dia }, distinct: ['cajeroId'], select: { cajero: { select: SELECT_USUARIO } } }),
      this.prisma.recibo.findMany({
        where: { fechaCajaExtorno: dia, extornadoPorId: { not: null } },
        distinct: ['extornadoPorId'],
        select: { extornadoPor: { select: SELECT_USUARIO } },
      }),
    ]);
    const cerrados = new Set(cierres.map((c) => c.cajero.id));
    const conMovimientos = new Map([...conCobros.map((r) => r.cajero), ...conExtornos.flatMap((r) => (r.extornadoPor ? [r.extornadoPor] : []))].map((u) => [u.id, u]));
    return {
      fecha,
      cierres: cierres.map((c) => ({
        id: c.id,
        cajero: { id: c.cajero.id, usuario: c.cajero.usuario, nombre: nombre(c.cajero) },
        cantidadRecibos: c.cantidadRecibos,
        cantidadExtornos: c.cantidadExtornos,
        total: c.total.toFixed(2),
        diferencia: c.diferencia?.toFixed(2) ?? null,
        cerradoEn: c.createdAt.toISOString(),
      })),
      sinCerrar: [...conMovimientos.values()]
        .filter((u) => !cerrados.has(u.id))
        .map((u) => ({ id: u.id, usuario: u.usuario, nombre: nombre(u) })),
      total: cierres.reduce((a, c) => a.plus(c.total), new Prisma.Decimal(0)).toFixed(2),
    };
  }

  // Detalle imprimible: el propio cajero o quien tiene caja.reportes.
  async obtener(id: number, usuario: AuthenticatedUser) {
    const c = await this.prisma.cierreCaja.findUnique({ where: { id }, include: { cajero: { select: SELECT_USUARIO } } });
    if (!c) {
      throw new NotFoundException('El cierre no existe');
    }
    if (c.cajeroId !== usuario.id && !usuario.niveles.includes(NIVEL_REPORTES)) {
      throw new ForbiddenException('Solo puedes ver tus propios cierres');
    }
    const declarado = c.efectivoDeclarado;
    return {
      id: c.id,
      fecha: iso(c.fecha),
      cerrado: true,
      cajero: { id: c.cajero.id, usuario: c.cajero.usuario, nombre: nombre(c.cajero) },
      cantidadRecibos: c.cantidadRecibos,
      cantidadExtornos: c.cantidadExtornos,
      total: c.total.toFixed(2),
      totalesPorMedio: c.totalesPorMedio as Record<string, string>,
      totalesPorTributo: c.totalesPorTributo as { codigo: string; nombre: string; total: string }[],
      efectivoEsperado: ((c.totalesPorMedio as Record<string, string>).EFECTIVO ?? '0.00') as string,
      efectivoDeclarado: declarado?.toFixed(2) ?? null,
      diferencia: c.diferencia?.toFixed(2) ?? null,
      cerradoEn: c.createdAt.toISOString(),
    };
  }

  private async calcular(db: Db, cajeroId: number, fecha: string, efectivoDeclarado?: number) {
    const dia = new Date(fecha);
    const [cobrados, extornados] = await Promise.all([
      db.recibo.findMany({ where: { cajeroId, fechaCaja: dia }, select: SELECT_RESUMEN }),
      db.recibo.findMany({ where: { extornadoPorId: cajeroId, fechaCajaExtorno: dia, estado: EstadoCuenta.EXTORNADO }, select: SELECT_RESUMEN }),
    ]);
    const aResumen = (r: (typeof cobrados)[number]): ReciboResumen => ({
      medioPago: r.medioPago,
      total: r.total,
      lineas: r.pagos.map((p) => ({ tributo: p.cuentaCorriente.tributo, subtotal: p.subtotal })),
    });
    return resumenCierre(cobrados.map(aResumen), extornados.map(aResumen), efectivoDeclarado);
  }

  // Decisión 8: días anteriores con cobros sin cerrar → solo aviso, no bloquea.
  private async diasSinCerrar(cajeroId: number, hoy: string) {
    const filas = await this.prisma.recibo.findMany({
      where: { cajeroId, cierreId: null, fechaCaja: { lt: new Date(hoy) } },
      distinct: ['fechaCaja'],
      select: { fechaCaja: true },
      orderBy: { fechaCaja: 'asc' },
    });
    return filas.map((f) => iso(f.fechaCaja));
  }
}
