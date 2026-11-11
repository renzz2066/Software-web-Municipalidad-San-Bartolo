import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { contextoAuditoria, sqlContexto } from '../auditoria/auditoria-contexto.js';
import { MuniService } from '../muni/muni.service.js';

const ESCRITURAS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

// Cliente que entrega a PostgreSQL el contexto de auditoría (specs/auditoria-v1.md).
// Los triggers registran el cambio; aquí solo se fija set_config en la MISMA tx:
// - escritura suelta → tx interactiva propia: set_config + la operación.
// - $transaction interactivo → set_config como primera sentencia del tx.
// El tx que reciben los callbacks es del cliente base: no se re-envuelve.
function extenderConAuditoria(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = contextoAuditoria.getStore();
          if (!ctx || model === 'Auditoria' || !ESCRITURAS.has(operation)) {
            return query(args);
          }
          const delegado = model.charAt(0).toLowerCase() + model.slice(1);
          return base.$transaction(async (tx) => {
            await tx.$executeRaw(sqlContexto(ctx));
            return (tx as any)[delegado][operation](args);
          });
        },
      },
    },
    client: {
      $transaction(arg: unknown, opciones?: unknown) {
        if (typeof arg !== 'function') {
          // La forma batch no permite fijar el contexto antes de cada sentencia.
          throw new Error('Usa $transaction(async (tx) => ...): la forma batch no se audita');
        }
        const ctx = contextoAuditoria.getStore();
        return base.$transaction(async (tx) => {
          if (ctx) {
            await tx.$executeRaw(sqlContexto(ctx));
          }
          return (arg as (tx: unknown) => Promise<unknown>)(tx);
        }, opciones as any);
      },
    },
  });
}

type ClienteMuni = ReturnType<typeof extenderConAuditoria>;

// Multi-muni (specs/multi-muni-v1.md): un cliente por base, creado al primer uso.
// PrismaService es un Proxy que en cada acceso delega al cliente de la muni de la
// petición (MuniMiddleware → AsyncLocalStorage): los servicios de dominio no cambian.
// Intencional: los tipos públicos son los de PrismaClient; el Proxy los resuelve en runtime.
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export interface PrismaService extends PrismaClient {}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly clientes = new Map<string, ClienteMuni>();

  constructor(private readonly munis: MuniService) {
    return new Proxy(this, {
      get(destino, prop, receptor) {
        if (prop in destino) return Reflect.get(destino, prop, receptor);
        const cliente = destino.clienteActual() as unknown as Record<string | symbol, unknown>;
        const valor = cliente[prop];
        return typeof valor === 'function' ? valor.bind(cliente) : valor;
      },
    });
  }

  clienteActual(): ClienteMuni {
    const muni = this.munis.actual();
    let cliente = this.clientes.get(muni.slug);
    if (!cliente) {
      cliente = extenderConAuditoria(new PrismaClient({ datasourceUrl: muni.databaseUrl }));
      this.clientes.set(muni.slug, cliente);
    }
    return cliente;
  }

  // Solo la muni por defecto se conecta al arrancar; las demás al primer uso.
  async onModuleInit() {
    await this.clienteActual().$connect();
  }

  async onModuleDestroy() {
    await Promise.all([...this.clientes.values()].map((c) => c.$disconnect()));
  }
}
