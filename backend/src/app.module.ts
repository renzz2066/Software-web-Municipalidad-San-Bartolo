import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { NivelesModule } from './niveles/niveles.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { RentasModule } from './rentas/rentas.module.js';
import { AuditoriaContextoMiddleware } from './auditoria/auditoria-contexto.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditoriaModule,
    UsersModule,
    RolesModule,
    NivelesModule,
    AuthModule,
    RentasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditoriaContextoMiddleware).forRoutes('*path');
  }
}
