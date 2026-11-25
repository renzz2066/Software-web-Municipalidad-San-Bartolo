// Carga y cálculo por persona de la determinación v2 (specs/rentas-nucleo-v2.md, Fases 5 y 6). Lo usan
// la DJ (determinar y liquidar), la determinación anual masiva (J09), valores y fiscalización. Carga en
// bloque: unas pocas consultas para muchas personas, para que la masiva quepa en una transacción.
import { BadRequestException } from '@nestjs/common';
import { EstadoCuenta, EstadoDeterminacion, EstadoDj, EstadoRegistro, EstadoValor, GrupoCatalogo, Prisma, TipoPredio, TipoTributo } from '@prisma/client';
import type { CatalogosService } from '../../catalogos/catalogos.service.js';
import { numeroDj } from '../../declaraciones/dj.reglas.js';
import { asociacionEnAnio } from '../../predios/predio.reglas.js';
import { CONCEPTOS_ARBITRIO } from '../catalogos-construccion.js';
import { iso } from '../estado-cuenta/tasas.js';
import {
  arrastrar,
  exoneracionPredio,
  huellaDeterminado,
  mesDesde,
  rigeEn,
  usosDelMes,
  vigenteArbitrios,
  vigentePredial,
  type DeclaracionPredio,
  type Declarado,
  type Determinado,
  type InicioArbitrios,
  type Maestro,
  type MesArbitrio,
  type ParametrosV2,
  type PredioDelAnio,
  type PrevioPredio,
  type Resolucion,
} from './determinacion.reglas.js';
import type { CuentaActual } from './reliquidacion.reglas.js';

type Tx = Prisma.TransactionClient;
type Dec = Prisma.Decimal;

export const SIN_EFECTO_CUENTA: EstadoCuenta[] = [EstadoCuenta.ANULADO, EstadoCuenta.EXTORNADO];
// L09: un valor en coactivo también protege la cuota (además de los vigentes EMITIDO/NOTIFICADO).
export const VALOR_CON_TRAMITE: EstadoValor[] = [EstadoValor.EMITIDO, EstadoValor.NOTIFICADO, EstadoValor.COACTIVO];
const LOTE = 300;

export const n = (v: Prisma.Decimal | number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));
export const n2 = (v: Dec) => v.toFixed(2);

// Lo que se guarda en DeterminacionPredio.datos: lo declarado que se usó, para reconstruir el predio
// de ese año (la "copia por año" de Lurín sale de aquí).
export interface DatosGuardados {
  declarado: Declarado;
  maestro: Maestro;
  meses: MesArbitrio[];
  arancel: string | null;
  niveles: unknown[];
  obras?: unknown[]; // V05 (Fase 7): obras valorizadas
}

export interface DetalleGuardado {
  huella: string;
  cuotasPredial: { cuota: number; importe: string; derechoEmision: string; vence: string }[];
  cuotasArbitrios: { predioId: number; concepto: string; cuota: number; importe: string; vence: string }[];
  beneficios: string[];
  errores: string[];
  avisos: string[];
  anuladas?: number[];
  saldoAFavor?: { tributo: string; predioId: number | null; importe: string }[];
  reemplazaA?: number | null;
  masiva?: boolean;
}

// Lo común a todas las personas de una corrida: catálogos, reglas de la muni, feriados, tributos,
// parámetros por año y los predios ya leídos.
export interface Comun {
  maestros: Map<number, { maestro: Maestro; padron: Declarado; resoluciones: Resolucion[] }>;
  atributos: Map<string, { nombre: string; regimen?: string; deduccionUit?: number; porcentaje?: number }>;
  feriados: Set<string>;
  tributos: Map<string, number>;
  codigoTributo: Map<number, string>;
  cuotasArbitrios: number[][];
  inicioArbitrios: InicioArbitrios;
  parametros: Map<number, ParametrosV2>;
}

export interface Titular {
  contribuyenteId: number;
  fechaAdquisicion: string | null;
  fechaFin: string | null;
  estado: EstadoRegistro;
  porcentaje: number;
  condicion: string | null;
}

export interface Liquidada {
  id: number;
  anio: number;
  djId: number | null;
  dj: string | null; // número de la DJ que la originó
  huella: string | null;
  baseAfecta: Dec;
  liquidaPredial: boolean;
  predios: Map<number, PrevioPredio>;
}

export interface DjPendiente {
  id: number;
  numero: string;
  estado: EstadoDj;
  reabierta: boolean;
  // Años desde los que toca el predial y los arbitrios (para saber si toca un año).
  desde: number;
}

export interface ContextoPersona {
  contribuyenteId: number;
  decls: Map<number, DeclaracionPredio[]>;
  titularidad: Map<number, Titular>;
  liquidadas: Map<number, Liquidada>; // la determinación LIQUIDADA de cada año
  resolucionesPersona: Resolucion[];
  pendientes: DjPendiente[];
}

// Datos de un predio que reemplazan a los suyos sin escribirlos: la ficha de una fiscalización.
export type Sustitucion = Map<number, { maestro: Partial<Maestro>; declarado: Declarado }>;

export async function cargarComun(tx: Tx, catalogos: CatalogosService): Promise<Comun> {
  const [catalogoBeneficio, feriados, tributos, cuotasArbitrios, inicioArbitrios] = await Promise.all([
    tx.catalogo.findMany({ where: { grupo: GrupoCatalogo.BENEFICIO }, select: { codigo: true, nombre: true, atributos: true } }),
    tx.feriado.findMany({ select: { fecha: true } }),
    tx.tributo.findMany({ where: { codigo: { in: ['PREDIAL', ...CONCEPTOS_ARBITRIO] }, tipo: { in: [TipoTributo.PREDIAL, TipoTributo.ARBITRIOS] } }, select: { id: true, codigo: true } }),
    catalogos.valorRegla<number[][]>('arbitrios.cuotas', tx),
    catalogos.valorRegla<InicioArbitrios>('arbitrios.inicioAfectacion', tx),
  ]);
  if (tributos.length !== CONCEPTOS_ARBITRIO.length + 1) {
    throw new BadRequestException('Faltan tributos de rentas en la base: ejecuta "npx prisma db seed"');
  }
  return {
    maestros: new Map(),
    atributos: new Map(catalogoBeneficio.map((c) => [c.codigo, { nombre: c.nombre, ...((c.atributos ?? {}) as { regimen?: string; deduccionUit?: number; porcentaje?: number }) }])),
    feriados: new Set(feriados.map((f) => iso(f.fecha))),
    tributos: new Map(tributos.map((t) => [t.codigo, t.id])),
    codigoTributo: new Map(tributos.map((t) => [t.id, t.codigo])),
    cuotasArbitrios,
    inicioArbitrios,
    parametros: new Map(),
  };
}

const INCLUDE_ANEXO = {
  niveles: { orderBy: { orden: 'asc' } },
  obras: { orderBy: { orden: 'asc' } },
  usos: { orderBy: { orden: 'asc' } },
  rusticos: { orderBy: { orden: 'asc' } },
} satisfies Prisma.DjAnexoInclude;

type AnexoCargado = Prisma.DjAnexoGetPayload<{ include: typeof INCLUDE_ANEXO }>;

export function declaradoDeAnexo(a: AnexoCargado): Declarado {
  return {
    areaTerreno: Number(a.areaTerreno),
    areaComun: n(a.areaComun),
    niveles: a.niveles.map((v) => ({
      nivel: v.nivel,
      anioConstruccion: v.anioConstruccion,
      clasificacion: v.clasificacion,
      material: v.material,
      estadoConservacion: v.estadoConservacion,
      categorias: v.categorias,
      areaPropia: Number(v.areaPropia),
      areaComun: n(v.areaComun),
      participacion: n(v.participacion),
    })),
    obras: a.obras.map((o) => ({
      descripcion: o.descripcion,
      cantidad: Number(o.cantidad),
      valorDeclarado: n(o.valorDeclarado),
      codigo: o.codigo,
      anioConstruccion: o.anioConstruccion,
      material: o.material,
      estadoConservacion: o.estadoConservacion,
    })),
    usos: a.usos.map((u) => ({
      uso: u.uso,
      subUso: u.subUso,
      area: Number(u.area),
      frontis: n(u.frontis),
      participacion: n(u.participacion),
      fechaInicio: u.fechaInicio ? iso(u.fechaInicio) : null,
      fechaFin: u.fechaFin ? iso(u.fechaFin) : null,
      predominante: u.predominante,
    })),
    rusticos: a.rusticos.map((r) => ({ categoria: r.categoria, clasificacion: r.clasificacion, hectareas: Number(r.hectareas) })),
  };
}

// Lo de cada persona: DJ que rigen (liquidadas, y `djId` si se está determinando), titularidad,
// determinaciones liquidadas hasta `hasta`, resoluciones y DJ pendientes. Suma al común los predios.
export async function cargarPersonas(tx: Tx, comun: Comun, ids: number[], op: { djId?: number | null; hasta: number; desde?: number }): Promise<Map<number, ContextoPersona>> {
  const personas = new Map<number, ContextoPersona>();
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    const [djs, pendientes, titulares, liquidadas, beneficios] = await Promise.all([
      tx.djPresentada.findMany({
        where: { contribuyenteId: { in: lote }, OR: [{ estado: EstadoDj.LIQUIDADA }, ...(op.djId ? [{ id: op.djId }] : [])] },
        select: { id: true, anio: true, numero: true, contribuyenteId: true, fechaPresentacion: true, anexos: { include: INCLUDE_ANEXO } },
      }),
      tx.djPresentada.findMany({
        where: { contribuyenteId: { in: lote }, estado: { in: [EstadoDj.PENDIENTE, EstadoDj.EN_REVISION] }, ...(op.djId ? { NOT: { id: op.djId } } : {}) },
        select: { id: true, anio: true, numero: true, contribuyenteId: true, estado: true, liquidadaAt: true, anexos: { select: { anioAfectacion: true, fechaAfectacionArbitrios: true } } },
      }),
      tx.predioContribuyente.findMany({ where: { contribuyenteId: { in: lote } } }),
      tx.determinacion.findMany({
        where: { contribuyenteId: { in: lote }, estado: EstadoDeterminacion.LIQUIDADA, anio: { lte: op.hasta, ...(op.desde ? { gte: op.desde } : {}) } },
        select: {
          id: true,
          anio: true,
          contribuyenteId: true,
          djId: true,
          baseAfecta: true,
          liquidaPredial: true,
          detalle: true,
          dj: { select: { anio: true, numero: true } },
          predios: { select: { predioId: true, origen: true, condicion: true, porcentaje: true, afectoPredial: true, datos: true } },
        },
      }),
      tx.contribuyenteBeneficio.findMany({ where: { contribuyenteId: { in: lote } } }),
    ]);
    for (const cid of lote) {
      personas.set(cid, { contribuyenteId: cid, decls: new Map(), titularidad: new Map(), liquidadas: new Map(), resolucionesPersona: [], pendientes: [] });
    }
    for (const d of djs) {
      const p = personas.get(d.contribuyenteId)!;
      for (const a of d.anexos) {
        const lista = p.decls.get(a.predioId) ?? [];
        lista.push({
          djId: d.id,
          origen: `DJ ${numeroDj(d.anio, d.numero)} · anexo ${a.numero}`,
          fechaPresentacion: iso(d.fechaPresentacion),
          orden: a.id,
          descargo: a.fechaDescargo !== null,
          anioAfectacion: a.anioAfectacion,
          fechaArbitrios: iso(a.fechaAfectacionArbitrios),
          porcentaje: Number(a.porcentaje),
          condicion: a.condicion,
          declarado: declaradoDeAnexo(a),
        });
        p.decls.set(a.predioId, lista);
      }
    }
    for (const d of pendientes) {
      personas.get(d.contribuyenteId)!.pendientes.push({
        id: d.id,
        numero: numeroDj(d.anio, d.numero),
        estado: d.estado,
        reabierta: d.liquidadaAt !== null,
        desde: Math.min(...d.anexos.map((a) => Math.min(a.anioAfectacion, Number(iso(a.fechaAfectacionArbitrios).slice(0, 4)))), 9999),
      });
    }
    for (const t of titulares) {
      personas.get(t.contribuyenteId)!.titularidad.set(t.predioId, {
        contribuyenteId: t.contribuyenteId,
        fechaAdquisicion: t.fechaAdquisicion ? iso(t.fechaAdquisicion) : null,
        fechaFin: t.fechaFin ? iso(t.fechaFin) : null,
        estado: t.estado,
        porcentaje: Number(t.porcentaje),
        condicion: t.condicion,
      });
    }
    for (const d of liquidadas) {
      personas.get(d.contribuyenteId)!.liquidadas.set(d.anio, {
        id: d.id,
        anio: d.anio,
        djId: d.djId,
        dj: d.dj ? numeroDj(d.dj.anio, d.dj.numero) : null,
        huella: (d.detalle as unknown as DetalleGuardado | null)?.huella ?? null,
        baseAfecta: d.baseAfecta,
        liquidaPredial: d.liquidaPredial,
        predios: new Map(
          d.predios.map((x) => {
            const datos = x.datos as unknown as DatosGuardados;
            return [x.predioId, { origen: x.origen, condicion: x.condicion, porcentaje: Number(x.porcentaje), afectoPredial: x.afectoPredial, declarado: datos.declarado, meses: datos.meses }];
          }),
        ),
      });
    }
    for (const b of beneficios) {
      const a = comun.atributos.get(b.codigo);
      personas.get(b.contribuyenteId)!.resolucionesPersona.push({
        regimen: a?.regimen,
        nombre: a?.nombre ?? b.codigo,
        resolucion: b.resolucion,
        porcentaje: a?.porcentaje ?? null,
        deduccionUit: a?.deduccionUit ?? null,
        anioDesde: b.anioDesde,
        anioHasta: b.anioHasta,
        vigente: b.vigente,
      });
    }
    const faltan = new Set<number>();
    for (const cid of lote) {
      const p = personas.get(cid)!;
      for (const id of [...p.decls.keys(), ...p.titularidad.keys(), ...[...p.liquidadas.values()].flatMap((l) => [...l.predios.keys()])]) {
        if (!comun.maestros.has(id)) faltan.add(id);
      }
    }
    await cargarMaestros(tx, comun, [...faltan]);
  }
  return personas;
}

async function cargarMaestros(tx: Tx, comun: Comun, ids: number[]) {
  for (let i = 0; i < ids.length; i += LOTE * 3) {
    const predios = await tx.predio.findMany({
      where: { id: { in: ids.slice(i, i + LOTE * 3) } },
      select: {
        id: true,
        tipo: true,
        viaId: true,
        urbanizacionId: true,
        zonaId: true,
        frecuenciaBarrido: true,
        ubicacionParque: true,
        frontis: true,
        areaTerreno: true,
        areaConstruida: true,
        usoPredio: true,
        pisos: { orderBy: { nivel: 'asc' } },
        otrasInstalaciones: { orderBy: { id: 'asc' } },
        beneficios: true,
      },
    });
    for (const p of predios) {
      // Padrón (v1): los datos actuales del predio, como los usaba el cálculo v1.
      const padron: Declarado = {
        areaTerreno: Number(p.areaTerreno ?? 0),
        areaComun: null,
        niveles: p.pisos.map((pi) => ({
          nivel: pi.nivel,
          anioConstruccion: pi.anioConstruccion,
          clasificacion: pi.clasificacion ?? '',
          material: pi.material ?? '',
          estadoConservacion: pi.estadoConservacion ?? '',
          categorias: pi.categorias ?? '',
          areaPropia: Number(pi.areaConstruida ?? 0),
          areaComun: null,
          participacion: null,
        })),
        obras: p.otrasInstalaciones.map((o) => ({ descripcion: o.descripcion, cantidad: Number(o.cantidad ?? 1), valorDeclarado: n(o.valor) })),
        usos: [
          {
            uso: p.usoPredio ?? '',
            subUso: null,
            area: Number(p.areaConstruida ?? 0) || Number(p.areaTerreno ?? 0),
            frontis: null,
            participacion: null,
            fechaInicio: null,
            fechaFin: null,
            predominante: true,
          },
        ],
        rusticos: [],
      };
      comun.maestros.set(p.id, {
        maestro: {
          tipo: p.tipo,
          viaId: p.viaId,
          urbanizacionId: p.urbanizacionId,
          zonaId: p.zonaId,
          frecuenciaBarrido: p.frecuenciaBarrido,
          ubicacionParque: p.ubicacionParque,
          frontis: n(p.frontis),
        },
        padron,
        resoluciones: p.beneficios.map((b) => ({
          regimen: comun.atributos.get(b.codigo)?.regimen,
          nombre: comun.atributos.get(b.codigo)?.nombre ?? b.codigo,
          resolucion: b.resolucion,
          porcentaje: Number(b.porcentaje),
          anioDesde: b.anioDesde,
          anioHasta: b.anioHasta,
          vigente: b.vigente,
        })),
      });
    }
  }
}

export async function parametrosDelAnio(tx: Tx, comun: Comun, anio: number): Promise<ParametrosV2> {
  const cache = comun.parametros.get(anio);
  if (cache) return cache;
  const [uit, escala, aranceles, valoresUnitarios, depreciaciones, tarifas, rusticos, valoresObras] = await Promise.all([
    tx.uit.findUnique({ where: { anio } }),
    tx.escalaPredial.findMany({ where: { anio }, orderBy: { tramo: 'asc' } }),
    tx.arancel.findMany({ where: { anio } }),
    tx.valorUnitario.findMany({ where: { anio } }),
    tx.depreciacion.findMany({ where: { anio } }),
    tx.tarifaArbitrio.findMany({ where: { anio }, orderBy: { id: 'asc' } }),
    tx.arancelRustico.findMany({ where: { anio } }),
    tx.valorObra.findMany({ where: { anio } }),
  ]);
  const p: ParametrosV2 = {
    anio,
    uit: uit?.valor ?? null,
    // V03 y V05 (Fase 7): sin dato del año, no hay incremento y las obras con código no se valorizan.
    incrementoPisos: uit?.incrementoDesdePiso && uit.incrementoPisoPct ? { desdePiso: uit.incrementoDesdePiso, pct: uit.incrementoPisoPct } : null,
    factorObras: uit?.factorOficializacion ?? null,
    valoresObras,
    derechoEmision: uit?.derechoEmision ?? 0,
    escala,
    aranceles,
    valoresUnitarios,
    depreciaciones,
    tarifas,
    rusticos,
    conceptos: CONCEPTOS_ARBITRIO,
  };
  comun.parametros.set(anio, p);
  return p;
}

// Lo que rige de la persona para predial y arbitrios del año (P14, P15).
export function resolucionesDelAnio(persona: ContextoPersona, anio: number) {
  const rige = (regimen: string) => persona.resolucionesPersona.find((r) => r.regimen === regimen && rigeEn(r, anio)) ?? null;
  return { inafecto: rige('INAFECTACION'), deduccion: rige('DEDUCCION'), exoneracion: rige('EXONERACION') };
}

// Lo que rige para cada predio de la persona en el año, en este orden (J15: entran también los no
// declarados en la DJ, porque la base es el total, L01):
// 1) su último anexo de DJ (liquidada, o la que se determina) que ya rige ese año (J10, J11);
// 2) lo que usó la determinación liquidada de ese año (la "copia por año" del predio) o, si el año
//    aún no se determinó, la del último año determinado tal como estaba en diciembre (J09);
// 3) el padrón: titular al 1 de enero (predial) o en el mes (arbitrios), con los datos del predio.
// Si otra DJ terminó su titularidad (p. ej. el comprador lo descargó como transferente), deja de regir.
export function prediosDelAnio(comun: Comun, persona: ContextoPersona, anio: number, sustituir?: Sustitucion): PredioDelAnio[] {
  const previa = previaDelAnio(comun, persona, anio);
  const ids = [...new Set([...persona.decls.keys(), ...persona.titularidad.keys(), ...previa.keys()])].sort((a, b) => a - b);
  const inicio = comun.inicioArbitrios;
  const lista: PredioDelAnio[] = [];
  for (const predioId of ids) {
    const m = comun.maestros.get(predioId);
    if (!m) continue;
    const decls = persona.decls.get(predioId) ?? [];
    const t = persona.titularidad.get(predioId);
    const p = previa.get(predioId);
    // Fin de la titularidad en el padrón. No pesa sobre un anexo presentado después (volvió a adquirirlo).
    const fin = t?.fechaFin ?? null;
    const terminoAntes = (presentado: string | null) => fin !== null && (presentado === null || presentado <= fin);
    const finAnio = fin ? Number(fin.slice(0, 4)) : null;
    const finMes = fin ? mesDesde(fin, anio, inicio) : 13;

    let predial: { origen: string; porcentaje: number; condicion: string | null; declarado: Declarado } | null = null;
    const d = vigentePredial(decls, anio);
    if (d) {
      predial = d.descargo ? null : { origen: d.origen, porcentaje: d.porcentaje, condicion: d.condicion, declarado: d.declarado };
      if (predial && terminoAntes(d.fechaPresentacion) && finAnio! < anio) predial = null;
    } else if (p) {
      predial = p.afectoPredial ? { origen: p.origen, porcentaje: p.porcentaje, condicion: p.condicion, declarado: p.declarado } : null;
      if (predial && finAnio !== null && finAnio < anio) predial = null;
    } else if (t && asociacionEnAnio(t, anio).contribuyenteDelAnio) {
      predial = { origen: 'Padrón', porcentaje: t.porcentaje, condicion: t.condicion, declarado: m.padron };
    }

    const meses: MesArbitrio[] = [];
    let declaradoArbitrios: Declarado | null = null;
    let origenArbitrios: string | null = null;
    for (let mes = 1; mes <= 12; mes++) {
      const da = vigenteArbitrios(decls, anio, mes);
      if (mes >= finMes && (!da || terminoAntes(da.fechaPresentacion))) continue;
      if (da) {
        if (!da.descargo) {
          meses.push({ mes, porcentaje: da.porcentaje, usos: usosDelMes(da.declarado.usos, anio, mes, inicio) });
          declaradoArbitrios = da.declarado;
          origenArbitrios ??= da.origen;
        }
      } else if (p) {
        const previo = p.meses.find((x) => x.mes === mes);
        if (previo) {
          meses.push(previo);
          declaradoArbitrios ??= p.declarado;
          origenArbitrios ??= p.origen;
        }
      } else if (t) {
        const empieza = t.fechaAdquisicion ? mesDesde(t.fechaAdquisicion, anio, inicio) : 0;
        const finDesconocido = t.estado !== EstadoRegistro.ACTIVO && !t.fechaFin;
        if (!finDesconocido && empieza <= mes) {
          meses.push({ mes, porcentaje: t.porcentaje, usos: usosDelMes(m.padron.usos, anio, mes, inicio) });
          origenArbitrios ??= 'Padrón';
        }
      }
    }
    if (!predial && meses.length === 0) continue;
    // Fiscalización: la ficha reemplaza lo declarado (y la ubicación) sin escribir nada.
    const s = sustituir?.get(predioId);
    lista.push({
      predioId,
      origen: (s ? 'Ficha de fiscalización' : (predial?.origen ?? origenArbitrios ?? 'Padrón')).slice(0, 60),
      condicion: predial?.condicion ?? t?.condicion ?? null,
      porcentaje: predial?.porcentaje ?? meses[0].porcentaje,
      afectoPredial: Boolean(predial),
      maestro: s ? { ...m.maestro, ...s.maestro } : m.maestro,
      declarado: s?.declarado ?? predial?.declarado ?? declaradoArbitrios ?? m.padron,
      meses: s ? meses.map((x) => ({ ...x, usos: usosDelMes(s.declarado.usos, anio, x.mes, inicio) })) : meses,
      exoneracion: exoneracionPredio(m.resoluciones, anio),
    });
  }
  return lista;
}

// (2) del orden: la determinación liquidada del año o, si no hay, la del último año arrastrada (J09).
function previaDelAnio(comun: Comun, persona: ContextoPersona, anio: number): Map<number, PrevioPredio> {
  const delAnio = persona.liquidadas.get(anio);
  if (delAnio) return delAnio.predios;
  const anterior = Math.max(...[...persona.liquidadas.keys()].filter((a) => a < anio), -1);
  const base = persona.liquidadas.get(anterior);
  const previa = new Map<number, PrevioPredio>();
  if (!base) return previa;
  for (const [predioId, p] of base.predios) {
    const arrastrado = arrastrar(p, anterior, anio, comun.inicioArbitrios);
    if (arrastrado) previa.set(predioId, arrastrado);
  }
  return previa;
}

// Cuenta corriente vigente de muchas personas en un año (sin anuladas ni extornadas), con si está en un valor.
export async function cuentasActuales(tx: Tx, ids: number[], anio: number, tributoIds: number[]): Promise<Map<number, CuentaActual[]>> {
  const porPersona = new Map<number, CuentaActual[]>();
  for (let i = 0; i < ids.length; i += LOTE) {
    const filas = await tx.cuentaCorriente.findMany({
      where: { contribuyenteId: { in: ids.slice(i, i + LOTE) }, anioFiscal: anio, tributoId: { in: tributoIds }, estado: { notIn: SIN_EFECTO_CUENTA } },
      select: {
        id: true,
        contribuyenteId: true,
        tributoId: true,
        predioId: true,
        cuota: true,
        importe: true,
        derechoEmision: true,
        estado: true,
        ajusteDeId: true,
        valorDetalles: { where: { valor: { estado: { in: VALOR_CON_TRAMITE } } }, select: { id: true }, take: 1 },
      },
      orderBy: [{ cuota: 'asc' }, { id: 'asc' }],
    });
    for (const { valorDetalles, contribuyenteId, ...f } of filas) {
      const lista = porPersona.get(contribuyenteId) ?? [];
      lista.push({ ...f, enValor: valorDetalles.length > 0 });
      porPersona.set(contribuyenteId, lista);
    }
  }
  return porPersona;
}

export function detalleDe(r: Determinado): DetalleGuardado {
  return {
    huella: huellaDeterminado(r),
    cuotasPredial: r.cuotasPredial.map((c) => ({ cuota: c.cuota, importe: n2(c.importe), derechoEmision: n2(c.derechoEmision), vence: c.vence })),
    cuotasArbitrios: r.cuotasArbitrios.map((c) => ({ predioId: c.predioId, concepto: c.concepto, cuota: c.cuota, importe: n2(c.importe), vence: c.vence })),
    beneficios: r.beneficios,
    errores: r.errores,
    avisos: r.avisos,
  };
}

export interface PorGuardar {
  contribuyenteId: number;
  djId: number | null;
  estado: EstadoDeterminacion;
  r: Determinado;
  entradas: PredioDelAnio[];
  detalle: DetalleGuardado;
  liquidaPredial?: boolean;
  liquidaArbitrios?: boolean;
  liquidadaAt?: Date | null;
}

// Guarda muchas determinaciones (HR + PU/PR + arbitrios por mes) en pocas consultas. Devuelve el id
// de cada una por persona y año.
export async function guardarDeterminaciones(tx: Tx, items: PorGuardar[]): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  const clave = (cid: number, anio: number) => `${cid}|${anio}`;
  for (let i = 0; i < items.length; i += LOTE) {
    const lote = items.slice(i, i + LOTE);
    const creadas = await tx.determinacion.createManyAndReturn({
      data: lote.map((x) => ({
        contribuyenteId: x.contribuyenteId,
        anio: x.r.anio,
        djId: x.djId,
        estado: x.estado,
        baseImponible: x.r.baseImponible,
        deduccion: x.r.deduccion,
        baseAfecta: x.r.baseAfecta,
        impuesto: x.r.impuesto,
        derechoEmision: x.r.derechoEmision,
        arbitrios: x.r.arbitrios,
        predialCalculable: x.r.predialCalculable,
        liquidaPredial: x.liquidaPredial ?? false,
        liquidaArbitrios: x.liquidaArbitrios ?? false,
        liquidadaAt: x.liquidadaAt ?? null,
        detalle: x.detalle as unknown as Prisma.InputJsonValue,
      })),
      select: { id: true, contribuyenteId: true, anio: true },
    });
    for (const c of creadas) ids.set(clave(c.contribuyenteId, c.anio), c.id);

    const predios: Prisma.DeterminacionPredioCreateManyInput[] = [];
    const arbitrios: Prisma.DeterminacionArbitrioCreateManyInput[] = [];
    for (const x of lote) {
      const determinacionId = ids.get(clave(x.contribuyenteId, x.r.anio))!;
      const entradas = new Map(x.entradas.map((e) => [e.predioId, e]));
      for (const p of x.r.predios) {
        const entrada = entradas.get(p.predioId)!;
        const ok = p.valor?.ok === true ? p.valor : null;
        const datos: DatosGuardados = {
          declarado: entrada.declarado,
          maestro: entrada.maestro,
          meses: entrada.meses,
          arancel: ok?.arancel ?? null,
          niveles: ok?.niveles ?? [],
          obras: ok?.detalleObras ?? [],
        };
        predios.push({
          determinacionId,
          predioId: p.predioId,
          tipo: entrada.maestro.tipo === 'RUSTICO' ? TipoPredio.RUSTICO : TipoPredio.URBANO,
          origen: p.origen,
          condicion: p.condicion,
          porcentaje: p.porcentaje,
          afectoPredial: p.afectoPredial,
          exoneracion: p.exoneracion,
          terreno: ok?.terreno ?? null,
          construccion: ok?.construccion ?? null,
          obras: ok?.obras ?? null,
          autoavaluo: ok?.autoavaluo ?? null,
          valorAfecto: p.valorAfecto,
          arbitrios: p.arbitrios,
          error: p.valor && !p.valor.ok ? p.valor.error.slice(0, 250) : null,
          datos: datos as unknown as Prisma.InputJsonValue,
        });
      }
      for (const a of x.r.arbitriosMes) {
        arbitrios.push({ determinacionId, predioId: a.predioId, uso: a.uso.slice(0, 10), mes: a.mes, concepto: a.concepto, importe: a.importe });
      }
    }
    for (let j = 0; j < predios.length; j += 2000) await tx.determinacionPredio.createMany({ data: predios.slice(j, j + 2000) });
    for (let j = 0; j < arbitrios.length; j += 5000) await tx.determinacionArbitrio.createMany({ data: arbitrios.slice(j, j + 5000) });
  }
  return ids;
}
