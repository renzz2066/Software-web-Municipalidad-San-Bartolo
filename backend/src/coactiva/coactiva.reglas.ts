// Reglas puras de Cobranza Coactiva (specs/coactiva-recepcion-transferencia-v1.md, K3-K5). Sin Prisma: se prueban con vitest.
// Rentas transfiere (rentas-valores-v1, V7): el valor pasa a COACTIVO con `transferenciaId` y sus cuotas
// PENDIENTE a COACTIVO. Coactiva solo RECIBE: crea el expediente; no cambia el estado del valor ni sus fechas.
import { EstadoCuenta, EstadoValor, Prisma } from '@prisma/client';

export type MotivoNoRecibible = 'yaRecibido' | 'noTransferido' | 'sinDeudaCoactiva';

export const MENSAJE_NO_RECIBIBLE: Record<MotivoNoRecibible, string> = {
  yaRecibido: 'El valor ya fue recibido en coactiva (tiene expediente)',
  noTransferido: 'Solo se reciben valores transferidos por Rentas (estado COACTIVO con memorándum)',
  sinDeudaCoactiva: 'El valor no tiene cuotas pendientes en coactiva',
};

export function motivoNoRecibible(v: {
  estado: EstadoValor;
  transferenciaId: number | null;
  expedientes: number;
  cuotasCoactivo: number;
}): MotivoNoRecibible | null {
  if (v.expedientes > 0) return 'yaRecibido';
  if (v.estado !== EstadoValor.COACTIVO || v.transferenciaId == null) return 'noTransferido';
  if (v.cuotasCoactivo === 0) return 'sinDeudaCoactiva';
  return null;
}

// Mismo criterio que `motivoNoRecibible`, como filtro de BD para el listado.
export const WHERE_RECIBIBLE: Prisma.ValorCabWhereInput = {
  estado: EstadoValor.COACTIVO,
  transferenciaId: { not: null },
  expedientes: { none: {} },
  detalles: { some: { cuentaCorriente: { estado: EstadoCuenta.COACTIVO } } },
};

// Solo se asignan a un auxiliar valores ya recibidos (con expediente) y aún en coactiva.
export function motivoNoAsignable(v: { estado: EstadoValor; expedientes: number } | null): string | null {
  if (!v) return 'Valor no encontrado';
  if (v.estado !== EstadoValor.COACTIVO) return 'El valor ya no está en cobranza coactiva';
  if (v.expedientes === 0) return 'El valor aún no fue recibido en coactiva';
  return null;
}

// Siguiente número de expediente del año a partir del último registrado.
export function siguienteExpediente(ultimo: string | null | undefined): string {
  const n = ultimo ? Number.parseInt(ultimo, 10) : 0;
  return String((Number.isFinite(n) ? n : 0) + 1).padStart(6, '0');
}

// Ids únicos y en orden de llegada (un id repetido no debe generar dos intentos).
export const idsUnicos = (ids: number[]) => [...new Set(ids)];
