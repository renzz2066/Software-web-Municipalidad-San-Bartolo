import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { DireccionesService } from './direcciones.service.js';
import { ActualizarDireccionDto, BuscarDireccionesDto, CrearDireccionDto, EstadoDireccionDto } from './dto/direccion.dto.js';

// Direcciones únicas (specs/rentas-nucleo-v2.md, Fase 2). C9: se reusa el nivel de Registro Tributario.
// Sin DELETE: una dirección se da de baja (PATCH :id/estado). Editar o dar de baja: supervisor.
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.registro-tributario')
@Controller('direcciones')
export class DireccionesController {
  constructor(private readonly direcciones: DireccionesService) {}

  @Get()
  buscar(@Query() dto: BuscarDireccionesDto) {
    return this.direcciones.buscar(dto);
  }

  // Antes de ':id' para que ParseIntPipe no reciba "config".
  @Get('config')
  config() {
    return this.direcciones.config();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.direcciones.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() dto: CrearDireccionDto) {
    return this.direcciones.crear(dto);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarDireccionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.direcciones.actualizar(id, dto, user);
  }

  @Patch(':id/estado')
  cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: EstadoDireccionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.direcciones.cambiarEstado(id, dto, user);
  }
}
