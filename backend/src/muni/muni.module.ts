import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BaseNoDisponibleFilter } from './base-no-disponible.filter.js';
import { MuniController } from './muni.controller.js';
import { MuniService } from './muni.service.js';

@Global()
@Module({
  controllers: [MuniController],
  providers: [MuniService, { provide: APP_FILTER, useClass: BaseNoDisponibleFilter }],
  exports: [MuniService],
})
export class MuniModule {}
