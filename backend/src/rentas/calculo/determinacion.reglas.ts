// Determinación v2 (specs/rentas-nucleo-v2.md, Fase 5; reglas V01–V07, L01–L07, J10, J11, J15, P14,
// P15, R03, R06 de docs/rentas/reglas-negocio.md). Lógica pura: recibe lo declarado ya elegido por año
// y los parámetros del año; no toca Prisma. Montos con Decimal.
import { Prisma } from '@prisma/client';
import { esHabil, masDias } from '../valores/plazos.js';
import { impuestoPredial, porcentajeDepreciacion, redondear, repartir, valorizarPiso, type ParametrosAnio } from './motor.js';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

export const CUOTAS_PREDIAL = 4; // L04: feb, may, ago, nov
const MESES_PREDIAL = [2, 5, 8, 11];
export const UNIDADES_TARIFA = ['PREDIO', 'M2', 'ML'] as const;
export type InicioArbitrios = 'MES_DEL_HECHO' | 'MES_SIGUIENTE';

const dos = (n: number) => String(n).padStart(2, '0');
const primeroDeMes = (anio: number, mes: number) => `${anio}-${dos(mes)}-01`;

// ---- Lo declarado ----

export interface NivelDatos {
  nivel: string;
  anioConstruccion: number | null;
  clasificacion: string;
  material: string;
  estadoConservacion: string;
  categorias: string;
  areaPropia: number;
  areaComun: number | null;
  participacion: number | null;
}

export interface UsoDatos {
  uso: string;
  subUso: string | null;
  area: number;
  frontis: number | null;
  participacion: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  predominante: boolean;
}

// V05: una obra complementaria. Con código se valoriza con la tabla del año; sin código, su valor
// declarado (como v1). Los campos opcionales faltan en lo guardado antes de la Fase 7.
export interface ObraDatos {
  descripcion: string;
  cantidad: number;
  valorDeclarado: number | null;
  codigo?: string | null;
  anioConstruccion?: number | null;
  material?: string | null;
  estadoConservacion?: string | null;
}

// La parte declarada del predio (DJ o padrón): áreas, construcción, obras y usos.
export interface Declarado {
  areaTerreno: number;
  areaComun: number | null; // terreno común ya atribuido al predio
  niveles: NivelDatos[];
  obras: ObraDatos[];
  usos: UsoDatos[];
  rusticos: { categoria: string; clasificacion: string | null; hectareas: number }[];
}

// La parte del maestro del predio (vigente al determinar): ubicación (D02, D03) y arbitrios (R02).
export interface Maestro {
  tipo: 'URBANO' | 'RUSTICO';
  viaId: number | null;
  urbanizacionId: number | null;
  zonaId: number | null;
  frecuenciaBarrido: string | null;
  ubicacionParque: string | null;
  frontis: number | null;
}

// Un anexo de DJ (v2) ya traído de la base, como lo usa la elección por año.
export interface DeclaracionPredio {
  djId: number;
  origen: string; // "DJ 26-0000003 · anexo 1"
  fechaPresentacion: string;
  orden: number; // id del anexo: desempata dos DJ del mismo día
  descargo: boolean;
  anioAfectacion: number; // J10: rige el predial desde este año
  fechaArbitrios: string; // J11: rige los arbitrios desde este día 1
  porcentaje: number;
  condicion: string | null;
  declarado: Declarado;
}

// J10 y J15: para el predial de un año rige el último anexo cuyo año de afectación ya llegó. Primero
// el año de afectación (una rectificatoria de 2024 no pisa una modificación que rige desde 2026),
// luego la presentación y el id.
export function vigentePredial(decls: DeclaracionPredio[], anio: number): DeclaracionPredio | null {
  return [...decls].filter((d) => d.anioAfectacion <= anio).sort(masReciente((d) => String(d.anioAfectacion).padStart(4, '0')))[0] ?? null;
}

// J11: para los arbitrios de un mes rige el último anexo cuya fecha de arbitrios ya llegó.
export function vigenteArbitrios(decls: DeclaracionPredio[], anio: number, mes: number): DeclaracionPredio | null {
  const dia = primeroDeMes(anio, mes);
  return [...decls].filter((d) => d.fechaArbitrios <= dia).sort(masReciente((d) => d.fechaArbitrios))[0] ?? null;
}

function masReciente(clave: (d: DeclaracionPredio) => string) {
  return (a: DeclaracionPredio, b: DeclaracionPredio) =>
    clave(b).localeCompare(clave(a)) || b.fechaPresentacion.localeCompare(a.fechaPresentacion) || b.orden - a.orden;
}

// J15: un resultado por año, desde el primer año que toca la DJ hasta el actual. Una DJ que solo rige
// desde el año próximo no determina nada todavía (lo hará la determinación anual).
export function aniosADeterminar(anexos: Pick<DeclaracionPredio, 'anioAfectacion' | 'fechaArbitrios'>[], anioActual: number): number[] {
  if (anexos.length === 0) return [];
  const desde = Math.min(...anexos.map((a) => Math.min(a.anioAfectacion, Number(a.fechaArbitrios.slice(0, 4)))));
  const anios: number[] = [];
  for (let a = Math.max(desde, 1990); a <= anioActual; a++) anios.push(a);
  return anios;
}

// Mes (1-12) del año desde el que rige un hecho para los arbitrios (J11); fuera del año: 0 o 13.
export function mesDesde(fechaHecho: string, anio: number, inicio: InicioArbitrios): number {
  const y = Number(fechaHecho.slice(0, 4));
  const m = Number(fechaHecho.slice(5, 7)) + (inicio === 'MES_SIGUIENTE' ? 1 : 0);
  const absoluto = y * 12 + m;
  const base = anio * 12;
  return Math.min(13, Math.max(0, absoluto - base));
}

// R03: usos que rigen en el mes. Empiezan y terminan con la regla de la ordenanza (J11): con
// MES_SIGUIENTE, un uso que acaba el 15 de agosto paga agosto y no septiembre.
export function usosDelMes(usos: UsoDatos[], anio: number, mes: number, inicio: InicioArbitrios): UsoDatos[] {
  const activos = usos.filter((u) => {
    const empieza = u.fechaInicio ? mesDesde(u.fechaInicio, anio, inicio) : 0;
    const acaba = u.fechaFin ? mesDesde(u.fechaFin, anio, inicio) : 13;
    return empieza <= mes && mes < acaba;
  });
  if (activos.length) return activos;
  // Sin uso vigente ese mes (fechas sueltas): el predominante, para no dejar el predio sin arbitrios.
  const predominante = usos.find((u) => u.predominante) ?? usos[0];
  return predominante ? [predominante] : [];
}

// ---- J09: la última determinación pasa al año nuevo ----

// Lo que una determinación liquidada usó de un predio (DeterminacionPredio + sus datos).
export interface PrevioPredio {
  origen: string;
  condicion: string | null;
  porcentaje: number;
  afectoPredial: boolean;
  declarado: Declarado;
  meses: MesArbitrio[];
}

// J09 (actualización anual de valores): sigue lo que regía el 31 de diciembre del último año
// determinado. Quien lo tenía en diciembre lo tiene el 1 de enero (J10: paga el predial) y todo el
// año de arbitrios; quien lo dejó antes, no. Los parámetros son los del año nuevo.
export function arrastrar(p: PrevioPredio, anioPrevio: number, anio: number, inicio: InicioArbitrios): PrevioPredio | null {
  const diciembre = p.meses.find((m) => m.mes === 12);
  if (!diciembre) return null;
  return {
    origen: `Determinación ${anioPrevio}`,
    condicion: p.condicion,
    porcentaje: diciembre.porcentaje,
    afectoPredial: true,
    declarado: p.declarado,
    meses: Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, porcentaje: diciembre.porcentaje, usos: usosDelMes(p.declarado.usos, anio, i + 1, inicio) })),
  };
}

// ---- Beneficios (P14, P15, R06) ----

export interface Resolucion {
  regimen: string | undefined; // INAFECTACION | EXONERACION | DEDUCCION (catálogo BENEFICIO)
  nombre: string;
  resolucion: string;
  porcentaje?: number | null;
  deduccionUit?: number | null;
  anioDesde: number;
  anioHasta: number | null;
  vigente: boolean;
}

// Una resolución revocada sigue rigiendo hasta el año final que se le fijó; sin año final, no rige.
export function rigeEn(r: Pick<Resolucion, 'anioDesde' | 'anioHasta' | 'vigente'>, anio: number): boolean {
  if (r.anioDesde > anio) return false;
  if (r.anioHasta !== null && r.anioHasta < anio) return false;
  return r.vigente || r.anioHasta !== null;
}

// R06: % del predio que no paga (inafectación = 100; exoneración = su %). Gana el mayor.
export function exoneracionPredio(resoluciones: Resolucion[], anio: number): number {
  return resoluciones
    .filter((r) => rigeEn(r, anio) && (r.regimen === 'INAFECTACION' || r.regimen === 'EXONERACION'))
    .reduce((m, r) => Math.max(m, r.regimen === 'INAFECTACION' ? 100 : Number(r.porcentaje ?? 0)), 0);
}

// ---- Parámetros del año ----

export interface TarifaV2 {
  concepto: string;
  zonaId: number | null;
  uso: string | null;
  frecuencia: string | null;
  ubicacionParque: string | null;
  unidad: string; // PREDIO | M2 | ML
  tasa: Num;
}

export interface ParametrosV2 extends Pick<ParametrosAnio, 'anio' | 'valoresUnitarios' | 'depreciaciones' | 'aranceles'> {
  uit: Num | null; // null = falta la UIT del año
  incrementoPisos?: { desdePiso: number; pct: Num } | null; // V03 (Fase 7); null = no aplica
  factorObras?: Num | null; // V05: factor de oficialización del año
  valoresObras?: { codigo: string; unidad: string; valor: Num }[]; // V05
  derechoEmision: Num;
  escala: ParametrosAnio['escala'];
  tarifas: TarifaV2[];
  rusticos: { categoria: string; clasificacion: string | null; valorHa: Num }[];
  conceptos: readonly string[];
}

// L07: gana la tarifa más específica (zona > uso > frecuencia > parques); vacío = todos.
export function tarifaV2(p: { zonaId: number | null; uso: string; frecuencia: string | null; parque: string | null }, concepto: string, tarifas: TarifaV2[]) {
  const candidatas = tarifas.filter(
    (t) =>
      t.concepto === concepto &&
      (t.zonaId === null || t.zonaId === p.zonaId) &&
      (t.uso === null || t.uso === p.uso) &&
      (t.frecuencia === null || t.frecuencia === p.frecuencia) &&
      (t.ubicacionParque === null || t.ubicacionParque === p.parque),
  );
  const puntaje = (t: TarifaV2) => (t.zonaId !== null ? 8 : 0) + (t.uso !== null ? 4 : 0) + (t.frecuencia !== null ? 2 : 0) + (t.ubicacionParque !== null ? 1 : 0);
  let mejor: TarifaV2 | null = null;
  for (const t of candidatas) if (!mejor || puntaje(t) > puntaje(mejor)) mejor = t;
  return mejor;
}

// ---- Autoavalúo (V01–V07) ----

export interface NivelValorizado {
  nivel: string;
  area: string;
  valorUnitario: string;
  incremento: string; // V03: % sumado al valor unitario ("0.00" si no aplica)
  depreciacion: string;
  valor: string;
}

export interface ObraValorizada {
  descripcion: string;
  codigo: string | null; // null = valor declarado
  cantidad: string;
  valorUnitario: string | null;
  factor: string | null;
  depreciacion: string | null;
  valor: string;
}

export type Valor =
  | { ok: true; terreno: Dec; construccion: Dec; obras: Dec; autoavaluo: Dec; arancel: string | null; niveles: NivelValorizado[]; detalleObras: ObraValorizada[] }
  | { ok: false; error: string };

// V03: número de piso de un nivel ("5", "05", "P5"); sótanos, azoteas, mezzanines y semisótanos no son pisos.
export function numeroPiso(nivel: string): number | null {
  const m = /^P?0*(\d{1,3})$/.exec(nivel.trim().toUpperCase());
  return m ? Number(m[1]) : null;
}

// V03: % de incremento del valor unitario del nivel (la RM de valores unitarios suele fijar +5% desde el 5.º piso).
export function incrementoNivel(nivel: string, inc: ParametrosV2['incrementoPisos']): Dec {
  if (!inc || !(inc.desdePiso > 0)) return new D(0);
  const piso = numeroPiso(nivel);
  return piso !== null && piso >= inc.desdePiso ? new D(inc.pct) : new D(0);
}

// V05: valor × cantidad × factor de oficialización, depreciado con la tabla del año (la clasificación
// es la del primer nivel del predio; sin niveles, casa habitación). Sin código: el valor declarado.
export function valorizarObra(
  o: ObraDatos,
  clasificacion: string,
  params: Pick<ParametrosV2, 'anio' | 'depreciaciones' | 'factorObras' | 'valoresObras'>,
): { ok: true; obra: ObraValorizada; valor: Dec } | { ok: false; error: string } {
  const cantidad = new D(o.cantidad).toFixed(2);
  if (!o.codigo) {
    const valor = redondear(o.valorDeclarado ?? 0);
    return { ok: true, valor, obra: { descripcion: o.descripcion, codigo: null, cantidad, valorUnitario: null, factor: null, depreciacion: null, valor: valor.toFixed(2) } };
  }
  const e = (m: string) => ({ ok: false as const, error: `obra "${o.descripcion}" (${o.codigo}): ${m}` });
  const vu = params.valoresObras?.find((v) => v.codigo === o.codigo);
  if (!vu) return e(`no hay valor de obras complementarias ${params.anio} para ese código`);
  if (params.factorObras == null || !new D(params.factorObras).gt(0)) return e(`falta el factor de oficialización ${params.anio} (Maestros → UIT)`);
  if (o.anioConstruccion == null || !o.material || !o.estadoConservacion) return e('indica año, material y estado de conservación para depreciarla');
  const antiguedad = Math.max(0, params.anio - o.anioConstruccion);
  const dep = porcentajeDepreciacion(params.depreciaciones, { clasificacion, material: o.material, estadoConservacion: o.estadoConservacion }, antiguedad);
  if (dep === null) return e(`no hay depreciación ${params.anio} para ${clasificacion}, ${o.material} y ${o.estadoConservacion}`);
  const factor = new D(params.factorObras);
  const valor = redondear(new D(o.cantidad).times(vu.valor).times(factor).times(new D(100).minus(dep)).div(100));
  const obra = { descripcion: o.descripcion, codigo: o.codigo, cantidad, valorUnitario: new D(vu.valor).toFixed(2), factor: factor.toFixed(4), depreciacion: dep.toFixed(2), valor: valor.toFixed(2) };
  return { ok: true, valor, obra };
}

export function valorizar(predioId: number, m: Maestro, d: Declarado, params: ParametrosV2): Valor {
  const e = (msg: string): Valor => ({ ok: false, error: `Predio #${predioId}: ${msg}` });
  let terreno: Dec;
  let arancel: string | null = null;
  if (m.tipo === 'RUSTICO') {
    // V07: hectáreas × arancel rústico del año por categoría (y clasificación, si la tabla la distingue).
    if (d.rusticos.length === 0) return e('un predio rústico necesita sus hectáreas por categoría');
    terreno = new D(0);
    for (const r of d.rusticos) {
      const fila =
        params.rusticos.find((a) => a.categoria === r.categoria && a.clasificacion !== null && a.clasificacion === r.clasificacion) ??
        params.rusticos.find((a) => a.categoria === r.categoria && a.clasificacion === null);
      if (!fila) return e(`no hay arancel rústico ${params.anio} para la categoría ${r.categoria}${r.clasificacion ? ` (${r.clasificacion})` : ''}`);
      terreno = terreno.plus(new D(r.hectareas).times(fila.valorHa));
    }
    terreno = redondear(terreno);
  } else {
    // V01 y V06: área (propia + común atribuida) × arancel de la vía del año; sin arancel no se valoriza.
    if (!m.viaId) return e('falta la vía de su dirección');
    const a =
      params.aranceles.find((x) => x.viaId === m.viaId && x.urbanizacionId === m.urbanizacionId) ??
      params.aranceles.find((x) => x.viaId === m.viaId && x.urbanizacionId === null);
    if (!a) return e(`no hay arancel ${params.anio} para su vía`);
    arancel = new D(a.valorM2).toFixed(2);
    terreno = redondear(new D(d.areaTerreno).plus(d.areaComun ?? 0).times(a.valorM2));
  }

  // V01–V04: cada nivel con su valor unitario (con el incremento por piso, V03) y depreciación; el
  // área común entra por su %.
  const niveles: NivelValorizado[] = [];
  let construccion = new D(0);
  for (const n of d.niveles) {
    const area = new D(n.areaPropia).plus(new D(n.areaComun ?? 0).times(n.participacion ?? 0).div(100));
    const r = valorizarPiso(
      { ...n, areaConstruida: area.toDecimalPlaces(2, D.ROUND_HALF_UP).toNumber() },
      { anio: params.anio, valoresUnitarios: params.valoresUnitarios, depreciaciones: params.depreciaciones },
      incrementoNivel(n.nivel, params.incrementoPisos),
    );
    if ('error' in r) return e(`nivel ${n.nivel}: ${r.error}`);
    niveles.push({
      nivel: n.nivel,
      area: area.toFixed(2),
      valorUnitario: r.valorUnitario.toFixed(2),
      incremento: r.incremento.toFixed(2),
      depreciacion: r.depreciacion.toFixed(2),
      valor: r.valor.toFixed(2),
    });
    construccion = construccion.plus(r.valor);
  }
  // V05: obras con código a valor oficial; sin código, su valor declarado.
  const clasificacion = d.niveles[0]?.clasificacion || 'CASA_HABITACION';
  const detalleObras: ObraValorizada[] = [];
  let obras = new D(0);
  for (const o of d.obras) {
    const r = valorizarObra(o, clasificacion, params);
    if (!r.ok) return e(r.error);
    detalleObras.push(r.obra);
    obras = obras.plus(r.valor);
  }
  obras = redondear(obras);
  return { ok: true, terreno, construccion, obras, autoavaluo: redondear(terreno.plus(construccion).plus(obras)), arancel, niveles, detalleObras };
}

// ---- Determinación de un año (HR + PU/PR + arbitrios por mes) ----

export interface MesArbitrio {
  mes: number;
  porcentaje: number;
  usos: UsoDatos[];
}

export interface PredioDelAnio {
  predioId: number;
  origen: string;
  condicion: string | null;
  porcentaje: number;
  afectoPredial: boolean; // J10: contribuyente al 1 de enero
  maestro: Maestro;
  declarado: Declarado;
  meses: MesArbitrio[]; // meses afectos a arbitrios, con lo que regía ese mes
  exoneracion: number; // R06
}

export interface Persona {
  inafecto: Resolucion | null; // P14
  deduccion: Resolucion | null; // P15
  exoneracion: Resolucion | null;
}

export interface CuotaPredial {
  cuota: number;
  importe: Dec;
  derechoEmision: Dec;
  vence: string;
}

export interface CuotaArbitrio {
  predioId: number;
  concepto: string;
  cuota: number;
  importe: Dec;
  vence: string;
}

export interface ArbitrioMes {
  predioId: number;
  uso: string;
  mes: number;
  concepto: string;
  importe: Dec; // 4 decimales
}

export interface PredioDeterminado {
  predioId: number;
  origen: string;
  condicion: string | null;
  porcentaje: number;
  afectoPredial: boolean;
  exoneracion: number;
  valor: Valor | null; // null = no estaba afecto al predial ese año (no se valoriza)
  valorAfecto: Dec;
  arbitrios: Dec;
}

export interface Determinado {
  anio: number;
  baseImponible: Dec;
  deduccion: Dec;
  baseAfecta: Dec;
  impuesto: Dec;
  derechoEmision: Dec;
  arbitrios: Dec;
  predialCalculable: boolean;
  beneficios: string[];
  predios: PredioDeterminado[];
  arbitriosMes: ArbitrioMes[];
  cuotasPredial: CuotaPredial[];
  cuotasArbitrios: CuotaArbitrio[];
  errores: string[];
  avisos: string[];
}

export interface OpcionesAnio {
  cuotasArbitrios: number[][]; // regla arbitrios.cuotas (L07)
  feriados: ReadonlySet<string>;
}

export function determinarAnio(params: ParametrosV2, predios: PredioDelAnio[], persona: Persona, op: OpcionesAnio): Determinado {
  const anio = params.anio;
  const errores: string[] = [];
  const avisos: string[] = [];
  const beneficios: string[] = [];

  // ---- Predial (L01–L06) ----
  const afectos = predios.filter((p) => p.afectoPredial);
  const determinados: PredioDeterminado[] = predios.map((p) => {
    const valor = p.afectoPredial ? valorizar(p.predioId, p.maestro, p.declarado, params) : null;
    if (valor && !valor.ok) errores.push(valor.error);
    const valorAfecto =
      valor?.ok === true ? redondear(valor.autoavaluo.times(p.porcentaje).div(100).times(new D(100).minus(p.exoneracion)).div(100)) : new D(0);
    if (p.afectoPredial && p.exoneracion > 0) beneficios.push(`Predio #${p.predioId}: ${p.exoneracion === 100 ? 'inafecto' : `exonerado ${p.exoneracion}%`} (R06)`);
    return { predioId: p.predioId, origen: p.origen, condicion: p.condicion, porcentaje: p.porcentaje, afectoPredial: p.afectoPredial, exoneracion: p.exoneracion, valor, valorAfecto, arbitrios: new D(0) };
  });
  const predialCalculable = afectos.length === 0 || (errores.length === 0 && params.uit !== null && params.escala.length > 0);
  if (afectos.length && (params.uit === null || params.escala.length === 0)) errores.push(`Faltan la UIT o la escala predial ${anio}: complétalas en Maestros`);

  const baseImponible = determinados.reduce((t, p) => t.plus(p.valorAfecto), new D(0));
  let deduccion = new D(0);
  let impuesto = new D(0);
  let derechoEmision = new D(0);
  const cuotasPredial: CuotaPredial[] = [];
  if (predialCalculable && afectos.length) {
    const uit = new D(params.uit!);
    if (persona.inafecto) {
      // P14: el inafecto del art. 17 no paga el impuesto (ni el derecho de emisión).
      beneficios.push(`Inafecto: ${persona.inafecto.nombre} (${persona.inafecto.resolucion}, P14)`);
    } else {
      if (persona.deduccion) {
        // P15: 50 UIT si tiene un solo predio (destinado a su vivienda; lo acredita la resolución).
        if (afectos.length === 1) {
          deduccion = D.min(baseImponible, uit.times(persona.deduccion.deduccionUit ?? 50));
          beneficios.push(`Deducción de ${persona.deduccion.deduccionUit ?? 50} UIT: ${persona.deduccion.nombre} (${persona.deduccion.resolucion}, P15)`);
          const p = afectos[0];
          const vivienda = p.declarado.usos.some((u) => u.uso === 'CASA');
          if (!vivienda) avisos.push(`P15: el predio #${p.predioId} no declara uso de casa habitación; verifica que sea su vivienda`);
        } else {
          avisos.push(`P15: tiene ${afectos.length} predios en ${anio}; la deducción solo corresponde con un solo predio`);
        }
      }
      const baseAfectaTmp = baseImponible.minus(deduccion);
      // Con la deducción que cubre toda la base no hay impuesto (ni mínimo): queda el derecho de emisión.
      impuesto = baseAfectaTmp.gt(0) ? impuestoPredial(baseAfectaTmp, { uit, escala: params.escala }) : new D(0);
      if (persona.exoneracion) {
        const pct = Number(persona.exoneracion.porcentaje ?? 0);
        impuesto = redondear(impuesto.times(new D(100).minus(pct)).div(100));
        beneficios.push(`Exoneración ${pct}%: ${persona.exoneracion.nombre} (${persona.exoneracion.resolucion})`);
      }
      derechoEmision = new D(params.derechoEmision);
      const vence = vencimientosPredial(anio, op.feriados);
      repartir(impuesto, CUOTAS_PREDIAL).forEach((importe, i) => {
        const emision = i === 0 ? derechoEmision : new D(0);
        if (importe.gt(0) || emision.gt(0)) cuotasPredial.push({ cuota: i + 1, importe, derechoEmision: emision, vence: vence[i] });
      });
    }
  }
  const baseAfecta = D.max(baseImponible.minus(deduccion), new D(0));

  // ---- Arbitrios por predio × uso × mes (L07, R02, R03) ----
  const arbitriosMes: ArbitrioMes[] = [];
  if (predios.some((p) => p.meses.length) && params.tarifas.length === 0) {
    avisos.push(`No hay tarifas de arbitrios ${anio}: los arbitrios quedan en 0 (regístralas en Maestros)`);
  }
  // Un aviso por predio y concepto, no uno por mes.
  const sinTarifa = new Set<string>();
  const sinFrontis = new Set<string>();
  for (const p of predios) {
    for (const m of p.meses) {
      const areaTotal = m.usos.reduce((t, u) => t + u.area, 0);
      for (const u of m.usos) {
        const parte = u.participacion != null ? new D(u.participacion).div(100) : areaTotal > 0 ? new D(u.area).div(areaTotal) : new D(1).div(m.usos.length);
        for (const concepto of params.conceptos) {
          const t = tarifaV2({ zonaId: p.maestro.zonaId, uso: u.uso, frecuencia: p.maestro.frecuenciaBarrido, parque: p.maestro.ubicacionParque }, concepto, params.tarifas);
          if (!t) {
            if (params.tarifas.length) sinTarifa.add(`${concepto} (uso ${u.uso})`);
            continue;
          }
          let base: Dec;
          if (t.unidad === 'M2') base = new D(u.area);
          else if (t.unidad === 'ML') {
            const frontis = u.frontis ?? (p.maestro.frontis !== null ? new D(p.maestro.frontis).times(parte).toNumber() : null);
            if (frontis === null) {
              sinFrontis.add(`Predio #${p.predioId}: ${concepto} se cobra por metro de frontis y el predio no lo tiene (queda en 0; regístralo en el maestro del predio)`);
              continue;
            }
            base = new D(frontis);
          } else base = parte;
          const mensual = new D(t.tasa).times(base).times(m.porcentaje).div(100).div(12).toDecimalPlaces(4, D.ROUND_HALF_UP);
          if (mensual.gt(0)) arbitriosMes.push({ predioId: p.predioId, uso: u.uso, mes: m.mes, concepto, importe: mensual });
        }
      }
    }
  }
  for (const s of sinTarifa) avisos.push(`Sin tarifa ${anio} para ${s}: ese concepto no se cobra`);
  avisos.push(...sinFrontis);
  const cuotasArbitrios = agruparArbitrios(arbitriosMes, op.cuotasArbitrios, anio, op.feriados);
  const arbitrios = cuotasArbitrios.reduce((t, c) => t.plus(c.importe), new D(0));
  for (const d of determinados) {
    d.arbitrios = cuotasArbitrios.filter((c) => c.predioId === d.predioId).reduce((t, c) => t.plus(c.importe), new D(0));
  }

  return {
    anio,
    baseImponible,
    deduccion,
    baseAfecta,
    impuesto,
    derechoEmision,
    arbitrios,
    predialCalculable,
    beneficios,
    predios: determinados,
    arbitriosMes,
    cuotasPredial,
    cuotasArbitrios,
    errores,
    avisos,
  };
}

// L07 y L06: los meses se agrupan en las cuotas de la regla; cada cuota se redondea y la última del
// predio y concepto absorbe el redondeo, para que la suma sea el total del año.
export function agruparArbitrios(meses: ArbitrioMes[], grupos: number[][], anio: number, feriados: ReadonlySet<string>): CuotaArbitrio[] {
  const porClave = new Map<string, ArbitrioMes[]>();
  for (const m of meses) {
    const k = `${m.predioId}|${m.concepto}`;
    porClave.set(k, [...(porClave.get(k) ?? []), m]);
  }
  const vence = grupos.map((g) => ultimoHabil(anio, g[Math.floor(g.length / 2)], feriados));
  const cuotas: CuotaArbitrio[] = [];
  for (const filas of porClave.values()) {
    const { predioId, concepto } = filas[0];
    const total = redondear(filas.reduce((t, f) => t.plus(f.importe), new D(0)));
    const brutas = grupos.map((g) => filas.filter((f) => g.includes(f.mes)).reduce((t, f) => t.plus(f.importe), new D(0)));
    const conMonto = brutas.map((b, i) => ({ i, b })).filter((x) => x.b.gt(0));
    let acumulado = new D(0);
    conMonto.forEach(({ i, b }, j) => {
      const importe = j === conMonto.length - 1 ? total.minus(acumulado) : redondear(b);
      acumulado = acumulado.plus(importe);
      if (importe.gt(0)) cuotas.push({ predioId, concepto, cuota: i + 1, importe, vence: vence[i] });
    });
  }
  return cuotas.sort((a, b) => a.predioId - b.predioId || a.concepto.localeCompare(b.concepto) || a.cuota - b.cuota);
}

// L11: vence el último día hábil del mes (los feriados son del año, en Maestros).
export function ultimoHabil(anio: number, mes: number, feriados: ReadonlySet<string>): string {
  let f = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  while (!esHabil(f, feriados)) f = masDias(f, -1);
  return f;
}

export function vencimientosPredial(anio: number, feriados: ReadonlySet<string>): string[] {
  return MESES_PREDIAL.map((m) => ultimoHabil(anio, m, feriados));
}

// Huella de lo que se liquidaría: si cambia entre determinar y liquidar, hay que volver a determinar.
export function huellaDeterminado(d: Determinado): string {
  return JSON.stringify({
    b: d.baseAfecta.toFixed(2),
    p: d.cuotasPredial.map((c) => [c.cuota, c.importe.toFixed(2), c.derechoEmision.toFixed(2), c.vence]),
    a: d.cuotasArbitrios.map((c) => [c.predioId, c.concepto, c.cuota, c.importe.toFixed(2), c.vence]),
    e: d.errores,
  });
}
