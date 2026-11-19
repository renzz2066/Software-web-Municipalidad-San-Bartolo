// Descargo de oficio del transferente (specs/rentas-nucleo-v2.md, Fase 7). Al liquidar una adquisición,
// el transferente enlazado deja de ser titular; si su cuenta ya tenía el predio desde el año del hecho,
// se le genera una DJ de descargo PENDIENTE que sigue el camino normal (determinar, revisión J14, L09, L10).
import { EstadoCuenta, EstadoDeterminacion, EstadoDj, EstadoPersona, GrupoCatalogo, Prisma, TipoPersona } from '@prisma/client';
import { reservarCorrelativos } from '../rentas/correlativos.js';
import { MOTIVO, anioAfectacionPorDefecto, fechaArbitriosPorDefecto, numeroDj } from './dj.reglas.js';

type Tx = Prisma.TransactionClient;

const SIN_EFECTO_DJ: EstadoDj[] = [EstadoDj.ANULADA, EstadoDj.RECHAZADA];
const SIN_EFECTO_CUENTA: EstadoCuenta[] = [EstadoCuenta.ANULADO, EstadoCuenta.EXTORNADO];

export interface Comprador {
  id: number;
  tipoPersona: TipoPersona;
  tipoDoc: string | null;
  numDoc: string | null;
  nombreCompleto: string;
  direccion: string | null;
}

// Sub-motivo del descargo que corresponde al de la adquisición (A_COMPRAVENTA → T_COMPRAVENTA), si existe.
export function subMotivoDescargo(subMotivoCompra: string | null, disponibles: ReadonlySet<string>): string | null {
  if (!subMotivoCompra?.startsWith('A_')) return null;
  const t = `T_${subMotivoCompra.slice(2)}`;
  return disponibles.has(t) ? t : null;
}

// Fechas del anexo de descargo: el predial deja de afectar desde el año siguiente al hecho (J10) y los
// arbitrios según la regla de la muni (J11).
export function afectacionDescargo(fechaDescargo: string, hoy: string, inicio: 'MES_DEL_HECHO' | 'MES_SIGUIENTE') {
  return { anioAfectacion: anioAfectacionPorDefecto(fechaDescargo, hoy), fechaArbitrios: fechaArbitriosPorDefecto(fechaDescargo, inicio) };
}

// Hay que corregir la cuenta del transferente si el predio sigue en una determinación liquidada suya, o
// en su cuenta de arbitrios, desde el año del hecho; y si no presentó ya su propio descargo del predio.
export async function necesitaDescargo(tx: Tx, transferenteId: number, predioId: number, fechaDescargo: string): Promise<boolean> {
  const anio = Number(fechaDescargo.slice(0, 4));
  const [propio, determinaciones, arbitrios] = await Promise.all([
    tx.djAnexo.count({ where: { predioId, fechaDescargo: { not: null }, dj: { contribuyenteId: transferenteId, estado: { notIn: SIN_EFECTO_DJ } } } }),
    tx.determinacion.count({ where: { contribuyenteId: transferenteId, estado: EstadoDeterminacion.LIQUIDADA, anio: { gte: anio }, predios: { some: { predioId } } } }),
    tx.cuentaCorriente.count({ where: { contribuyenteId: transferenteId, predioId, anioFiscal: { gte: anio }, estado: { notIn: SIN_EFECTO_CUENTA } } }),
  ]);
  return propio === 0 && determinaciones + arbitrios > 0;
}

export interface DescargoOficio {
  transferenteId: number;
  predioId: number;
  fechaDescargo: string;
  condicion: string | null;
  porcentaje: Prisma.Decimal | number;
  comprador: Comprador;
  origen: { id: number; anio: number; numero: number; subMotivo: string | null };
  hoy: string;
  inicioArbitrios: 'MES_DEL_HECHO' | 'MES_SIGUIENTE';
}

// Registra la DJ de oficio (PENDIENTE). Devuelve su número, o null si la persona está inhabilitada
// (no declara: se avisa para corregirla a mano).
export async function crearDescargoDeOficio(tx: Tx, e: DescargoOficio): Promise<string | null> {
  const [persona, motivo, subMotivos] = await Promise.all([
    tx.contribuyente.findUniqueOrThrow({
      where: { id: e.transferenteId },
      select: {
        id: true,
        tipoPersona: true,
        tipoDoc: true,
        numDoc: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        nombres: true,
        razonSocial: true,
        nombreCompleto: true,
        estado: true,
        ubigeo: true,
        direccionId: true,
        direccionFiscal: true,
        domicilioTexto: true,
        documentos: { orderBy: { orden: 'asc' }, select: { tipoDoc: true, numDoc: true } },
        contactos: { orderBy: { orden: 'asc' }, select: { tipo: true, valor: true } },
        relacionados: { where: { vigente: true }, orderBy: { orden: 'asc' }, select: { tipo: true, tipoDoc: true, numDoc: true, nombreCompleto: true, direccion: true } },
      },
    }),
    tx.catalogo.findUnique({ where: { grupo_codigo: { grupo: GrupoCatalogo.MOTIVO_DJ, codigo: MOTIVO.VENTA } }, select: { atributos: true } }),
    tx.catalogo.findMany({ where: { grupo: GrupoCatalogo.SUB_MOTIVO_DJ, activo: true, codigo: { startsWith: 'T_' } }, select: { codigo: true } }),
  ]);
  if (persona.estado === EstadoPersona.INHABILITADO) return null;
  const { estado: _e, ...copia } = persona;
  const { anioAfectacion, fechaArbitrios } = afectacionDescargo(e.fechaDescargo, e.hoy, e.inicioArbitrios);
  const anio = Number(e.hoy.slice(0, 4));
  const [numero] = await reservarCorrelativos(tx, 'DJ', anio);
  const origen = numeroDj(e.origen.anio, e.origen.numero);
  const subMotivo = subMotivoDescargo(e.origen.subMotivo, new Set(subMotivos.map((s) => s.codigo)));
  await tx.djPresentada.create({
    data: {
      anio,
      numero: Number(numero),
      contribuyenteId: e.transferenteId,
      motivo: MOTIVO.VENTA,
      subMotivo,
      tipo: (motivo?.atributos as { tipo?: string } | null)?.tipo ?? 'DECLARATIVA',
      fechaPresentacion: new Date(e.hoy),
      persona: copia as unknown as Prisma.InputJsonValue,
      generadaDesdeId: e.origen.id,
      observacion: `De oficio: descargo por la adquisición de ${e.comprador.nombreCompleto} (DJ ${origen})`.slice(0, 250),
      anexos: {
        create: {
          numero: 1,
          predioId: e.predioId,
          subMotivo,
          condicion: e.condicion ?? 'PROPIETARIO_UNICO',
          porcentaje: e.porcentaje,
          fechaDescargo: new Date(e.fechaDescargo),
          anioAfectacion,
          fechaAfectacionArbitrios: new Date(fechaArbitrios),
          areaTerreno: 0,
          observacion: `Generado desde la DJ ${origen}`,
          adquirientes: {
            create: {
              orden: 1,
              rol: 'ADQUIRIENTE',
              tipoPersona: e.comprador.tipoPersona,
              tipoDoc: e.comprador.tipoDoc,
              numDoc: e.comprador.numDoc,
              nombreCompleto: e.comprador.nombreCompleto.slice(0, 120),
              direccion: e.comprador.direccion?.slice(0, 250) ?? null,
              personaId: e.comprador.id,
            },
          },
        },
      },
    },
  });
  return numeroDj(anio, Number(numero));
}
