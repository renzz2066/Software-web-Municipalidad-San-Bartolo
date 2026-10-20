import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { contextoAuditoria, sqlContexto } from '../auditoria/auditoria-contexto.js';

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

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    // Nest inyecta el cliente extendido; los tipos públicos siguen siendo los de PrismaClient.
    return extenderConAuditoria(this) as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
