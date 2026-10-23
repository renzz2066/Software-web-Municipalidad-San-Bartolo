// Reglas puras de Caja (specs/caja-v1.md). Sin Prisma: se prueban con vitest.
// - Solo se cobran cuotas completas en PENDIENTE o COACTIVO (decisiones 3 y 6), con un medio de
//   pago por recibo y n.° de operación salvo en efectivo (decisión 5).
// - Las cuotas de un convenio se pagan en orden: la k exige la k−1 pagada o en el mismo cobro (decisión 4).
// - Extorno del recibo completo: el cajero, sus recibos del día antes de cerrar; el resto, solo con
//   `caja.extornos` (decisión 7). Tras su cierre, un cajero no cobra ni extorna ese día (K5).
import { EstadoCuenta, EstadoValor, MedioPago, Prisma } from '@prisma/client';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;
type Num = Dec | number | string;

const r2 = (x: Dec) => x.toDecimalPlaces(2, D.ROUND_HALF_UP);

export const ESTADOS_COBRABLES: EstadoCuenta[] = [EstadoCuenta.PENDIENTE, EstadoCuenta.COACTIVO];
export const MEDIOS_HABILITADOS: MedioPago[] = [MedioPago.EFECTIVO, MedioPago.TARJETA, MedioPago.TRANSFERENCIA, MedioPago.DEPOSITO];
export const MAX_CUOTAS_POR_RECIBO = 100;

export interface DatosCobro {
  cuentaIds: number[];
  medioPago: MedioPago;
  numOperacion?: string | null;
  cerroHoy: boolean; // el cajero ya cerró su caja de hoy
}

export function errorCobro(d: DatosCobro): string | null {
  if (d.cerroHoy) return 'Ya cerraste tu caja de hoy: no puedes cobrar hasta mañana';
  if (d.cuentaIds.length === 0) return 'Elige al menos una cuota';
  if (d.cuentaIds.length > MAX_CUOTAS_POR_RECIBO) return `Un recibo admite hasta ${MAX_CUOTAS_POR_RECIBO} cuotas`;
  if (new Set(d.cuentaIds).size !== d.cuentaIds.length) return 'Hay cuotas repetidas en el cobro';
  if (!MEDIOS_HABILITADOS.includes(d.medioPago)) return 'Medio de pago no habilitado';
  if (d.medioPago !== MedioPago.EFECTIVO && !d.numOperacion?.trim()) return 'Indica el n.° de operación del pago';
  return null;
}

export interface CuotaACobrar {
  id: number;
  estado: EstadoCuenta;
  liquidacion: { insoluto: Dec; reajuste: Dec; mora: Dec; derechoEmision: Dec; total: Dec }; // a la fecha del cobro
  convenio?: { convenioId: number; cuotaNumero: number } | null; // cuota FRACCION
}

export interface CuotaCronogramaEstado {
  cuotaNumero: number;
  estado: EstadoCuenta;
}

export function errorEstadoCuotas(cuotas: Pick<CuotaACobrar, 'id' | 'estado'>[]): string | null {
  const otra = cuotas.find((c) => !ESTADOS_COBRABLES.includes(c.estado));
  return otra ? `La cuota ${otra.id} ya no está pendiente (${otra.estado.toLowerCase()}); vuelve a consultar` : null;
}

// Cada convenio con cuotas elegidas: toda cuota anterior a la mayor elegida debe estar pagada o elegida.
export function errorOrdenConvenio(cuotas: CuotaACobrar[], cronogramas: Map<number, CuotaCronogramaEstado[]>): string | null {
  const elegidas = new Map<number, Set<number>>();
  for (const c of cuotas) {
    if (!c.convenio) continue;
    const s = elegidas.get(c.convenio.convenioId) ?? new Set<number>();
    s.add(c.convenio.cuotaNumero);
    elegidas.set(c.convenio.convenioId, s);
  }
  for (const [convenioId, numeros] of elegidas) {
    const mayor = Math.max(...numeros);
    const faltante = (cronogramas.get(convenioId) ?? [])
      .filter((x) => x.cuotaNumero < mayor && x.estado !== EstadoCuenta.CANCELADO && !numeros.has(x.cuotaNumero))
      .sort((a, b) => a.cuotaNumero - b.cuotaNumero)[0];
    if (faltante) {
      const nombre = faltante.cuotaNumero === 0 ? 'la cuota inicial' : `la cuota ${faltante.cuotaNumero}`;
      return `Las cuotas del convenio se pagan en orden: falta ${nombre}`;
    }
  }
  return null;
}

export interface LineaPago {
  cuentaId: number;
  importe: Dec;
  reajuste: Dec;
  mora: Dec;
  derechoEmision: Dec;
  subtotal: Dec;
  estadoAnterior: EstadoCuenta;
}

export function lineasPago(cuotas: CuotaACobrar[]): LineaPago[] {
  return cuotas.map((c) => ({
    cuentaId: c.id,
    importe: c.liquidacion.insoluto,
    reajuste: c.liquidacion.reajuste,
    mora: c.liquidacion.mora,
    derechoEmision: c.liquidacion.derechoEmision,
    subtotal: c.liquidacion.total,
    estadoAnterior: c.estado,
  }));
}

export const totalRecibo = (lineas: Pick<LineaPago, 'subtotal'>[]): Dec => r2(lineas.reduce((a, l) => a.plus(l.subtotal), new D(0)));

// El total que vio el cajero debe ser el que el servidor liquida al cobrar (K1); si no, 409.
export const totalCoincide = (esperado: Num, calculado: Num) => r2(new D(esperado)).eq(r2(new D(calculado)));

// Un valor (OP/RD) o un convenio queda pagado cuando todas sus cuotas están CANCELADO (K3).
export const todoPagado = (estados: EstadoCuenta[]) => estados.length > 0 && estados.every((e) => e === EstadoCuenta.CANCELADO);

// Estado al que vuelve un valor CANCELADO cuando se extorna uno de sus pagos (K4).
export function estadoValorRestaurado(v: { transferenciaId: number | null; fechaNotificacion: string | Date | null }): EstadoValor {
  if (v.transferenciaId != null) return EstadoValor.COACTIVO;
  return v.fechaNotificacion ? EstadoValor.NOTIFICADO : EstadoValor.EMITIDO;
}

export interface ReciboExtornable {
  estado: EstadoCuenta;
  cajeroId: number;
  fechaCaja: string; // AAAA-MM-DD
}

export interface ContextoExtorno {
  usuarioId: number;
  hoy: string; // AAAA-MM-DD, hora Lima
  puedeExtornarAjenos: boolean; // nivel caja.extornos
  cerroHoy: boolean; // quien extorna ya cerró su caja de hoy
  motivo: string;
}

export function errorExtorno(r: ReciboExtornable, ctx: ContextoExtorno): string | null {
  const motivo = ctx.motivo?.trim() ?? '';
  if (motivo.length < 5) return 'Indica el motivo del extorno (mínimo 5 caracteres)';
  if (motivo.length > 200) return 'El motivo admite hasta 200 caracteres';
  if (r.estado !== EstadoCuenta.CANCELADO) return 'El recibo ya está extornado';
  if (ctx.cerroHoy) return 'Ya cerraste tu caja de hoy: no puedes extornar hasta mañana';
  const propioDelDia = r.cajeroId === ctx.usuarioId && r.fechaCaja === ctx.hoy;
  if (!propioDelDia && !ctx.puedeExtornarAjenos) {
    return 'Solo puedes extornar tus recibos de hoy; para otros recibos pide el extorno a un supervisor';
  }
  return null;
}

export interface ReciboResumen {
  medioPago: MedioPago;
  total: Num;
  lineas: { tributo: { codigo: string; nombre: string }; subtotal: Num }[];
}

export interface ResumenCierre {
  cantidadRecibos: number;
  cantidadExtornos: number;
  total: Dec;
  totalesPorMedio: Record<string, string>;
  totalesPorTributo: { codigo: string; nombre: string; total: string }[];
  efectivoEsperado: Dec;
  diferencia: Dec | null; // efectivo declarado − esperado: + sobrante, − faltante
}

// Cierre del día de un cajero (K5): lo que cobró menos lo que extornó ese día, por medio y por tributo.
export function resumenCierre(cobrados: ReciboResumen[], extornados: ReciboResumen[], efectivoDeclarado?: Num | null): ResumenCierre {
  const porMedio = new Map<string, Dec>();
  const porTributo = new Map<string, { codigo: string; nombre: string; total: Dec }>();
  const acumular = (r: ReciboResumen, signo: 1 | -1) => {
    porMedio.set(r.medioPago, (porMedio.get(r.medioPago) ?? new D(0)).plus(new D(r.total).times(signo)));
    for (const l of r.lineas) {
      const t = porTributo.get(l.tributo.codigo) ?? { ...l.tributo, total: new D(0) };
      t.total = t.total.plus(new D(l.subtotal).times(signo));
      porTributo.set(l.tributo.codigo, t);
    }
  };
  cobrados.forEach((r) => acumular(r, 1));
  extornados.forEach((r) => acumular(r, -1));

  const total = r2([...porMedio.values()].reduce((a, x) => a.plus(x), new D(0)));
  const efectivoEsperado = r2(porMedio.get(MedioPago.EFECTIVO) ?? new D(0));
  return {
    cantidadRecibos: cobrados.length,
    cantidadExtornos: extornados.length,
    total,
    totalesPorMedio: Object.fromEntries([...porMedio.entries()].sort().map(([m, v]) => [m, r2(v).toFixed(2)])),
    totalesPorTributo: [...porTributo.values()]
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .map((t) => ({ codigo: t.codigo, nombre: t.nombre, total: r2(t.total).toFixed(2) })),
    efectivoEsperado,
    diferencia: efectivoDeclarado == null ? null : r2(new D(efectivoDeclarado)).minus(efectivoEsperado),
  };
}

// Total en letras para el recibo (K2): "CIENTO VEINTE CON 50/100 SOLES".
const UNIDADES = [
  '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
  'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS',
  'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function menorMil(n: number): string {
  if (n === 100) return 'CIEN';
  const resto = n % 100;
  const decenas = resto < 30 ? UNIDADES[resto] : DECENAS[Math.floor(resto / 10)] + (resto % 10 ? ` Y ${UNIDADES[resto % 10]}` : '');
  return [CENTENAS[Math.floor(n / 100)], decenas].filter(Boolean).join(' ');
}

// Delante de MIL / MILLONES: "VEINTIÚN MIL", "TREINTA Y UN MIL".
const apocope = (s: string) => s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');

function enteroEnLetras(n: number): string {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor(n / 1000) % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${apocope(menorMil(millones))} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocope(menorMil(miles))} MIL`);
  if (n % 1000) partes.push(menorMil(n % 1000));
  return partes.join(' ');
}

export function montoEnLetras(monto: Num): string {
  const m = r2(new D(monto));
  if (m.isNegative() || m.gte(1_000_000_000)) throw new Error('Monto fuera de rango para el recibo');
  const entero = m.floor();
  const centimos = m.minus(entero).times(100).toNumber();
  return `${enteroEnLetras(entero.toNumber())} CON ${String(centimos).padStart(2, '0')}/100 SOLES`;
}
