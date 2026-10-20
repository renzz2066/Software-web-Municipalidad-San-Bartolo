import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';

// Quién/desde dónde de la petición en curso. Lo arma el middleware (ip, userAgent)
// y lo completa el interceptor tras el JwtAuthGuard (usuario, módulo).
export interface ContextoAuditoria {
  usuarioId: number | null;
  usuarioNombre: string | null;
  modulo: string | null;
  ip: string | null;
  userAgent: string | null;
}

export const contextoAuditoria = new AsyncLocalStorage<ContextoAuditoria>();

export function contextoVacio(ip: string | null = null, userAgent: string | null = null): ContextoAuditoria {
  return { usuarioId: null, usuarioNombre: null, modulo: null, ip, userAgent };
}

// set_config local (true): con pooler en modo transacción, false filtraría
// el contexto a otras peticiones que reutilicen la conexión física.
export function sqlContexto(c: ContextoAuditoria): Prisma.Sql {
  const v = (valor: string | number | null) => (valor === null ? '' : String(valor));
  return Prisma.sql`SELECT
    set_config('app.usuario_id', ${v(c.usuarioId)}, true),
    set_config('app.usuario_nombre', ${v(c.usuarioNombre)}, true),
    set_config('app.modulo', ${v(c.modulo)}, true),
    set_config('app.ip', ${v(c.ip)}, true),
    set_config('app.user_agent', ${v(c.userAgent)}, true)`;
}
