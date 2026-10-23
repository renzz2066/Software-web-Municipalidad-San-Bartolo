import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoCuenta, EstadoValor, Prisma, TipoTributo } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { vencimientos } from '../calculo/motor.js';
import { hoyLima } from '../fechas.js';
import { liquidar } from './liquidacion.js';
import { cargarTasas, iso } from './tasas.js';

const D = Prisma.Decimal;
// FRACCIONADO no: esa deuda la reemplazan las cuotas del convenio (tributo FRACCION); sumarla la duplicaría.
const ESTADOS: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.COACTIVO];

const ETIQUETA_VALOR: Partial<Record<EstadoValor, string>> = { EMITIDO: 'emitido', NOTIFICADO: 'notificado', COACTIVO: 'en coactivo' };

function situacion(c: {
  estado: EstadoCuenta;
  valorDetalles: { valor: { tipo: string; anio: number; numero: string; estado: EstadoValor } }[];
  convenioDetalles: { cuotaNumero: number; convenio: { numero: string } }[];
}): string | null {
  const conv = c.convenioDetalles[0];
  if (conv) return `Convenio ${conv.convenio.numero} · ${conv.cuotaNumero === 0 ? 'cuota inicial' : `cuota ${conv.cuotaNumero}`}`;
  const v = c.valorDetalles[0]?.valor;
  if (v) return `${v.tipo} ${v.anio}-${v.numero} · ${ETIQUETA_VALOR[v.estado] ?? v.estado.toLowerCase()}`;
  return c.estado === EstadoCuenta.COACTIVO ? 'En coactivo' : null;
}

// Estado de cuenta a una fecha (C6): la mora y el reajuste se calculan al vuelo, no se guardan.
// Lo consumen la ficha, la impresión y, más adelante, Caja y Coactiva.
@Injectable()
export class EstadoCuentaService {
  constructor(private readonly prisma: PrismaService) {}

  async generar(contribuyenteId: number, fechaParam?: string) {
    const fecha = fechaParam ?? hoyLima();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)) || fecha < '2000-01-01') {
      throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD');
    }

    const contribuyente = await this.prisma.contribuyente.findUnique({
      where: { id: contribuyenteId },
      select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true, direccionFiscal: true, codigoLegacy: true },
    });
    if (!contribuyente) {
      throw new NotFoundException('El contribuyente no existe');
    }

    const [cuentas, { ipm, tim }] = await Promise.all([
      this.prisma.cuentaCorriente.findMany({
        where: { contribuyenteId, estado: { in: ESTADOS } },
        select: {
          id: true,
          anioFiscal: true,
          cuota: true,
          importe: true,
          derechoEmision: true,
          fechaVencimiento: true,
          estado: true,
          tributo: { select: { codigo: true, nombre: true, tipo: true } },
          predio: {
            select: { id: true, numero: true, manzana: true, lote: true, via: { select: { tipoVia: true, nombre: true } } },
          },
          // Situación (specs/rentas-valores-v1.md, V9): valor que la cobra o convenio al que pertenece.
          valorDetalles: {
            where: { valor: { estado: { in: [EstadoValor.EMITIDO, EstadoValor.NOTIFICADO, EstadoValor.COACTIVO] } } },
            select: { valor: { select: { tipo: true, anio: true, numero: true, estado: true } } },
            take: 1,
          },
          convenioDetalles: {
            where: { convenio: { estado: EstadoCuenta.FRACCIONADO } },
            select: { cuotaNumero: true, convenio: { select: { numero: true } } },
            take: 1,
          },
        },
        orderBy: [{ anioFiscal: 'asc' }, { tributoId: 'asc' }, { predioId: 'asc' }, { cuota: 'asc' }],
      }),
      cargarTasas(this.prisma),
    ]);

    let totales = { insoluto: new D(0), reajuste: new D(0), mora: new D(0), derechoEmision: new D(0), total: new D(0) };
    const porAnio = new Map<number, Prisma.Decimal>();
    const lineas = cuentas.map((c) => {
      const esPredial = c.tributo.tipo === TipoTributo.PREDIAL;
      const vencimientoCuota1 = vencimientos(c.anioFiscal)[0];
      const l = liquidar(
        {
          esPredial,
          cuota: c.cuota,
          anio: c.anioFiscal,
          importe: c.importe,
          derechoEmision: c.derechoEmision,
          fechaVencimiento: c.fechaVencimiento ? iso(c.fechaVencimiento) : `${c.anioFiscal}-12-31`,
          vencimientoCuota1,
          generaMora: c.estado !== EstadoCuenta.FRACCIONADO,
        },
        fecha,
        ipm,
        tim,
      );
      totales = {
        insoluto: totales.insoluto.plus(l.insoluto),
        reajuste: totales.reajuste.plus(l.reajuste),
        mora: totales.mora.plus(l.mora),
        derechoEmision: totales.derechoEmision.plus(l.derechoEmision),
        total: totales.total.plus(l.total),
      };
      porAnio.set(c.anioFiscal, (porAnio.get(c.anioFiscal) ?? new D(0)).plus(l.total));
      return {
        id: c.id,
        anio: c.anioFiscal,
        tributo: c.tributo,
        predio: c.predio,
        cuota: c.cuota,
        vencimiento: c.fechaVencimiento ? iso(c.fechaVencimiento) : null,
        estado: c.estado,
        situacion: situacion(c),
        diasAtraso: l.diasAtraso,
        insoluto: l.insoluto.toFixed(2),
        reajuste: l.reajuste.toFixed(2),
        mora: l.mora.toFixed(2),
        derechoEmision: l.derechoEmision.toFixed(2),
        total: l.total.toFixed(2),
      };
    });

    const avisos: string[] = [];
    if (lineas.some((l) => l.diasAtraso > 0) && tim.length === 0) {
      avisos.push('No hay TIM registrada en Maestros: la mora se muestra en 0.');
    }
    const aniosSinIpm = [...new Set(lineas.filter((l) => l.tributo.tipo === TipoTributo.PREDIAL && l.cuota >= 2).map((l) => l.anio))].filter(
      (a) => !ipm.some((t) => t.vigenciaDesde === `${a}-02-01`),
    );
    if (aniosSinIpm.length) {
      avisos.push(`Falta el IPM de febrero de ${aniosSinIpm.join(', ')}: las cuotas 2-4 del predial no se reajustan.`);
    }

    return {
      fecha,
      generado: new Date().toISOString(),
      contribuyente,
      lineas,
      totales: Object.fromEntries(Object.entries(totales).map(([k, v]) => [k, v.toFixed(2)])),
      porAnio: [...porAnio.entries()].map(([anio, total]) => ({ anio, total: total.toFixed(2) })),
      avisos,
    };
  }
}
