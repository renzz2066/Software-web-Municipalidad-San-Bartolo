import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { DeclaracionesService } from './declaraciones.service.js';
import { AnularDjDto, BuscarDjDto, DeclaracionDjDto } from './dto/declaracion.dto.js';

// DJ presentada (specs/rentas-nucleo-v2.md, Fase 4). C9: nivel de Registro Tributario.
// Sin DELETE (J04): se anula con motivo. Determinar y liquidar llegan en la Fase 5.
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.registro-tributario')
@Controller('declaraciones')
export class DeclaracionesController {
  constructor(private readonly declaraciones: DeclaracionesService) {}

  @Get()
  buscar(@Query() dto: BuscarDjDto) {
    return this.declaraciones.buscar(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.declaraciones.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  registrar(@Body() dto: DeclaracionDjDto) {
    return this.declaraciones.registrar(dto);
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: DeclaracionDjDto) {
    return this.declaraciones.actualizar(id, dto);
  }

  @Post(':id/anular')
  anular(@Param('id', ParseIntPipe) id: number, @Body() dto: AnularDjDto, @CurrentUser() user: AuthenticatedUser) {
    return this.declaraciones.anular(id, dto, user);
  }

  @Post(':id/reabrir')
  reabrir(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.declaraciones.reabrir(id, user);
  }
}
