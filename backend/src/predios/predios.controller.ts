import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { DeclaracionDto } from './dto/declaracion.dto.js';
import { BuscarPrediosDto, MaestroPredioDto, PersonasAnioDto, PredioBeneficioDto, RevocarPredioBeneficioDto } from './dto/predio.dto.js';
import { PrediosService } from './predios.service.js';

// Ubicación, área y construcción del predio solo cambian con una DJ. El maestro (Fase 3: nombre,
// linderos, coordenadas, datos de arbitrios y condición de los titulares) se edita aparte. Sin DELETE.
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.registro-tributario')
@Controller('predios')
export class PrediosController {
  constructor(private readonly predios: PrediosService) {}

  // También la usa la ficha de inspección de Fiscalización (specs/rentas-fiscalizacion-v1.md, F3).
  @Get('catalogos')
  @RequireNivel('rentas.registro-tributario', 'rentas.fiscalizacion')
  catalogos() {
    return this.predios.catalogos();
  }

  // Para elegir el predio del anexo de una DJ (Fase 4): código, catastro, nombre o dirección.
  @Get()
  buscar(@Query() dto: BuscarPrediosDto) {
    return this.predios.buscar(dto);
  }

  @Post('declaraciones')
  @HttpCode(HttpStatus.CREATED)
  declarar(@Body() dto: DeclaracionDto) {
    return this.predios.declarar(dto);
  }

  @Get('declaraciones/:id')
  findDeclaracion(@Param('id', ParseIntPipe) id: number) {
    return this.predios.findDeclaracion(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.predios.findOne(id);
  }

  @Patch(':id/maestro')
  actualizarMaestro(@Param('id', ParseIntPipe) id: number, @Body() dto: MaestroPredioDto) {
    return this.predios.actualizarMaestro(id, dto);
  }

  @Get(':id/personas')
  personas(@Param('id', ParseIntPipe) id: number, @Query() dto: PersonasAnioDto) {
    return this.predios.personasPorAnio(id, dto.anio);
  }

  @Post(':id/beneficios')
  agregarBeneficio(@Param('id', ParseIntPipe) id: number, @Body() dto: PredioBeneficioDto) {
    return this.predios.agregarBeneficio(id, dto);
  }

  @Patch(':id/beneficios/:beneficioId/revocar')
  revocarBeneficio(
    @Param('id', ParseIntPipe) id: number,
    @Param('beneficioId', ParseIntPipe) beneficioId: number,
    @Body() dto: RevocarPredioBeneficioDto,
  ) {
    return this.predios.revocarBeneficio(id, beneficioId, dto);
  }
}
