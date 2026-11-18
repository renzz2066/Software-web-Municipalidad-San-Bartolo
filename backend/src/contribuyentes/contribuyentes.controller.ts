import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { ContribuyentesService } from './contribuyentes.service.js';
import { IdentidadService } from './identidad/identidad.service.js';
import {
  BeneficioDto,
  BuscarContribuyentesDto,
  BuscarUbigeosDto,
  CambiarEstadoDto,
  ConsultarIdentidadDto,
  CreateContribuyenteDto,
  PorDocumentoDto,
  RevocarBeneficioDto,
  UpdateContribuyenteDto,
} from './dto/contribuyente.dto.js';

// Personas v2 (specs/rentas-nucleo-v2.md, Fase 1). Inhabilitar = PATCH :id/estado (P01).
// DELETE solo para un error de digitación sin historia (P04), por un supervisor.
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.registro-tributario')
@Controller('contribuyentes')
export class ContribuyentesController {
  constructor(
    private readonly contribuyentes: ContribuyentesService,
    private readonly identidad: IdentidadService,
  ) {}

  @Get()
  buscar(@Query() dto: BuscarContribuyentesDto) {
    return this.contribuyentes.buscar(dto);
  }

  // Las rutas fijas DEBEN ir antes de ':id', si no ParseIntPipe recibe el texto y contesta 400.
  @Get('identidad')
  consultarIdentidad(@Query() dto: ConsultarIdentidadDto) {
    return this.identidad.consultar(dto);
  }

  @Get('ubigeos')
  buscarUbigeos(@Query() dto: BuscarUbigeosDto) {
    return this.contribuyentes.buscarUbigeos(dto);
  }

  @Get('por-documento')
  porDocumento(@Query() dto: PorDocumentoDto) {
    return this.contribuyentes.porDocumento(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contribuyentes.findOne(id);
  }

  @Get(':id/resumen')
  resumen(@Param('id', ParseIntPipe) id: number) {
    return this.contribuyentes.resumen(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateContribuyenteDto) {
    return this.contribuyentes.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContribuyenteDto) {
    return this.contribuyentes.update(id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoDto) {
    return this.contribuyentes.cambiarEstado(id, dto);
  }

  @Post(':id/aprobar-excepcion')
  aprobarExcepcion(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.contribuyentes.aprobarExcepcion(id, user);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.contribuyentes.eliminar(id, user);
  }

  @Post(':id/beneficios')
  agregarBeneficio(@Param('id', ParseIntPipe) id: number, @Body() dto: BeneficioDto) {
    return this.contribuyentes.agregarBeneficio(id, dto);
  }

  @Patch(':id/beneficios/:beneficioId/revocar')
  revocarBeneficio(
    @Param('id', ParseIntPipe) id: number,
    @Param('beneficioId', ParseIntPipe) beneficioId: number,
    @Body() dto: RevocarBeneficioDto,
  ) {
    return this.contribuyentes.revocarBeneficio(id, beneficioId, dto);
  }
}
