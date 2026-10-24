import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { DeclaracionDto } from './dto/declaracion.dto.js';
import { PrediosService } from './predios.service.js';

// El predio solo cambia mediante una declaración jurada (C3); no hay PATCH ni DELETE directos.
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
}
