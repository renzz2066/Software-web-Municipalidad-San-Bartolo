import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoValor, Prisma, TipoPersona, TipoValor } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { reservarCorrelativos } from '../correlativos.js';
import { cargarTasas, iso, liquidarCuenta } from '../estado-cuenta/tasas.js';
import { hoyLima } from '../fechas.js';
import { masDias } from '../valores/plazos.js';
import { esExtemporanea, montoMulta, porcentajeMulta, vencePlazoDJ } from './multas.reglas.js';

type Tx = Prisma.TransactionClient;
type Db = PrismaService | Tx;

const OPCIONES_TX = { maxWait: 10_000, timeout: 30_000 };
export const TRIBUTO_MULTA = 'MULTA';
export const INFRACCION_OMISION = '178.1'; // declarar cifras falsas u omitir (fiscalización)
export const INFRACCION_DJ_TARDIA = '176.1'; // no declarar en plazo (DJ extemporánea)

export interface MultaPrevista {
  anio: number; // año de la infracción
  codigo: string;
  descripcion: string;
  porcentaje: string;
  base: string; // UIT o tributo omitido sobre el que se aplica
  monto: string;
}

// Multas tributarias (specs/rentas-fiscalizacion-v1.md, F6–F7, decisión 5): la multa nace como una
// fila de cuenta corriente (tributo MULTA, cuota 0, vence en la fecha de la infracción: desde ahí
// corre el interés, art. 181) y su Resolución de Multa (RM, serie propia), con la infracción aplicada.
@Injectable()
export class MultasService {
  constructor(private readonly prisma: PrismaService) {}

  // La infracción del catálogo de ese año; si el año no tiene catálogo, la del último año anterior.
  async infraccion(db: Db, codigo: string, anio: number) {
    const i =
      (await db.infraccion.findFirst({ where: { codigo, anio: { lte: anio } }, orderBy: { anio: 'desc' } })) ??
      (await db.infraccion.findFirst({ where: { codigo }, orderBy: { anio: 'asc' } }));
    if (!i) {
      throw new BadRequestException(`No hay la infracción ${codigo} en Maestros → Fiscalización`);
    }
    return i;
  }

  // 178.1 de una fiscalización: una multa por año con tributo omitido (50 % del omitido).
  async prever178(db: Db, tipoPersona: TipoPersona, omitidos: { anio: number; omitido: Prisma.Decimal }[]): Promise<MultaPrevista[]> {
    const previstas: MultaPrevista[] = [];
    for (const { anio, omitido } of omitidos) {
      if (!omitido.isPositive() || omitido.isZero()) continue;
      const i = await this.infraccion(db, INFRACCION_OMISION, anio);
      previstas.push({
        anio,
        codigo: i.codigo,
        descripcion: i.descripcion,
        porcentaje: porcentajeMulta(i, tipoPersona).toFixed(2),
        base: omitido.toFixed(2),
        monto: montoMulta(i, tipoPersona, 0, omitido).toFixed(2),
      });
    }
    return previstas;
  }

  // Crea la multa en cuenta corriente y su RM; devuelve el id del valor.
  async emitir(
    tx: Tx,
    m: {
      contribuyenteId: number;
      predioId: number | null;
      anio: number;
      infraccionId: number;
      monto: Prisma.Decimal;
      fechaInfraccion: string;
      fiscalizacionId?: number;
      declaracionId?: number;
    },
  ) {
    const tributo = await tx.tributo.findUnique({ where: { codigo: TRIBUTO_MULTA }, select: { id: true } });
    if (!tributo) {
      throw new BadRequestException('Falta el tributo MULTA en la base: ejecuta "npx prisma db seed"');
    }
    const cuenta = await tx.cuentaCorriente.create({
      data: {
        contribuyenteId: m.contribuyenteId,
        predioId: m.predioId,
        tributoId: tributo.id,
        anioFiscal: m.anio,
        cuota: 0,
        importe: m.monto,
        fechaVencimiento: new Date(m.fechaInfraccion),
      },
      select: { id: true, anioFiscal: true, cuota: true, importe: true, derechoEmision: true, fechaVencimiento: true, estado: true, tributo: { select: { tipo: true } } },
    });
    const hoy = hoyLima();
    const { ipm, tim } = await cargarTasas(tx);
    const l = liquidarCuenta(cuenta, hoy, ipm, tim);
    const [numero] = await reservarCorrelativos(tx, 'RM', Number(hoy.slice(0, 4)));
    const valor = await tx.valorCab.create({
      data: {
        tipo: TipoValor.RM,
        anio: Number(hoy.slice(0, 4)),
        numero,
        contribuyenteId: m.contribuyenteId,
        predioId: m.predioId,
        totalDeuda: l.total,
        fechaEmision: new Date(hoy),
        infraccionId: m.infraccionId,
        fiscalizacionId: m.fiscalizacionId ?? null,
        declaracionId: m.declaracionId ?? null,
        detalles: { create: [{ cuentaCorrienteId: cuenta.id, importe: l.insoluto, reajuste: l.reajuste, mora: l.mora, subtotal: l.total }] },
      },
      select: { id: true },
    });
    return valor.id;
  }

  // F7: la DJ extemporánea propone la 176.1 (% de la UIT del año en que se cometió); quien registra
  // la emite o la descarta con motivo. Solo una vez por DJ.
  async decidirDJ(declaracionId: number, accion: 'EMITIR' | 'DESCARTAR', motivo?: string) {
    return this.prisma.$transaction(async (tx) => {
      const dj = await tx.declaracionJurada.findUnique({
        where: { id: declaracionId },
        select: {
          id: true,
          motivo: true,
          fecha: true,
          fechaHecho: true,
          multaDescartada: true,
          predioId: true,
          contribuyente: { select: { id: true, tipoPersona: true } },
          multas: { where: { estado: { not: EstadoValor.ANULADO } }, select: { id: true } },
        },
      });
      if (!dj) {
        throw new NotFoundException('La declaración no existe');
      }
      if (dj.multas.length || dj.multaDescartada) {
        throw new ConflictException('La multa de esta declaración ya se emitió o se descartó');
      }
      const feriados = new Set((await tx.feriado.findMany({ select: { fecha: true } })).map((f) => iso(f.fecha)));
      const hecho = dj.fechaHecho ? iso(dj.fechaHecho) : null;
      if (!hecho || !esExtemporanea(dj.motivo, hecho, iso(dj.fecha), feriados)) {
        throw new BadRequestException('La declaración no está fuera de plazo (o su motivo no tiene plazo): no corresponde multa');
      }
      if (accion === 'DESCARTAR') {
        const m = motivo?.trim() ?? '';
        if (m.length < 10) {
          throw new BadRequestException('Indica por qué no corresponde la multa (mínimo 10 caracteres)');
        }
        await tx.declaracionJurada.update({ where: { id: dj.id }, data: { multaDescartada: m.slice(0, 200) } });
        return { declaracionId: dj.id, valorId: null };
      }
      // Se comete el día siguiente al vencimiento del plazo.
      const fechaInfraccion = masDias(vencePlazoDJ(dj.motivo, hecho, feriados)!, 1);
      const anio = Number(fechaInfraccion.slice(0, 4));
      const [i, uit] = await Promise.all([
        this.infraccion(tx, INFRACCION_DJ_TARDIA, anio),
        tx.uit.findUnique({ where: { anio }, select: { valor: true } }),
      ]);
      if (!uit) {
        throw new BadRequestException(`Falta la UIT ${anio} en Maestros para calcular la multa`);
      }
      const valorId = await this.emitir(tx, {
        contribuyenteId: dj.contribuyente.id,
        predioId: dj.predioId,
        anio,
        infraccionId: i.id,
        monto: montoMulta(i, dj.contribuyente.tipoPersona, uit.valor),
        fechaInfraccion,
        declaracionId: dj.id,
      });
      return { declaracionId: dj.id, valorId };
    }, OPCIONES_TX);
  }
}
