import { Injectable, Logger } from '@nestjs/common';
import { AccionAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { contextoAuditoria } from './auditoria-contexto.js';
import { FiltroAuditoriaDto } from './dto/filtro-auditoria.dto.js';

const ZONA_LIMA = '-05:00'; // Perú no tiene horario de verano
const DIA_MS = 24 * 60 * 60 * 1000;

export interface EventoSesion {
  accion: typeof AccionAuditoria.LOGIN | typeof AccionAuditoria.LOGIN_FALLIDO | typeof AccionAuditoria.LOGOUT;
  usuarioId: number | null;
  usuarioNombre: string;
  registroId?: number | null;
  motivo?: string;
}

// CREATE/UPDATE/DELETE los registran los triggers de PostgreSQL.
// Aquí solo eventos sin tabla (sesiones) y la consulta. Sin update/delete: solo inserción.
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Fail-open (D5): si falla el INSERT, se loguea y el login sigue.
  // Nunca recibe la contraseña; usuarioNombre se recorta a 50.
  async registrarSesion(evento: EventoSesion): Promise<void> {
    const ctx = contextoAuditoria.getStore();
    try {
      await this.prisma.auditoria.create({
        data: {
          usuarioId: evento.usuarioId,
          usuarioNombre: evento.usuarioNombre.trim().slice(0, 50),
          accion: evento.accion,
          tabla: 'usuarios',
          registroId: evento.registroId != null ? String(evento.registroId) : null,
          modulo: 'auth',
          ip: ctx?.ip?.slice(0, 45) ?? null,
          userAgent: ctx?.userAgent?.slice(0, 255) ?? null,
          detalle: evento.motivo ? { motivo: evento.motivo } : undefined,
        },
      });
    } catch (error) {
      this.logger.error(`No se pudo registrar ${evento.accion}`, error instanceof Error ? error.stack : error);
    }
  }

  async listar(filtro: FiltroAuditoriaDto) {
    const { page, pageSize } = filtro;
    const where = construirFiltro(filtro);
    const [items, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { usuario: { select: { id: true, usuario: true, nombres: true, apellidos: true } } },
      }),
      this.prisma.auditoria.count({ where }),
    ]);
    // BigInt no es serializable a JSON
    return { items: items.map((a) => ({ ...a, id: a.id.toString() })), total, page, pageSize };
  }
}

export function construirFiltro(filtro: FiltroAuditoriaDto): Prisma.AuditoriaWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (filtro.desde) {
    createdAt.gte = inicioDe(filtro.desde);
  }
  if (filtro.hasta) {
    // Fecha sola = día completo inclusive; fecha-hora = tal cual
    createdAt.lt = esSoloFecha(filtro.hasta)
      ? new Date(inicioDe(filtro.hasta).getTime() + DIA_MS)
      : new Date(filtro.hasta);
  }
  return {
    usuarioId: filtro.usuarioId,
    tabla: filtro.tabla,
    accion: filtro.accion,
    registroId: filtro.registroId,
    ...(filtro.desde || filtro.hasta ? { createdAt } : {}),
  };
}

function esSoloFecha(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function inicioDe(valor: string): Date {
  return esSoloFecha(valor) ? new Date(`${valor}T00:00:00${ZONA_LIMA}`) : new Date(valor);
}
