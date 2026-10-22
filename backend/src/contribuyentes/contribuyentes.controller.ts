import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { ContribuyentesService } from './contribuyentes.service.js';
import { BuscarContribuyentesDto, CreateContribuyenteDto, UpdateContribuyenteDto } from './dto/contribuyente.dto.js';

// Baja = PATCH {estado: 'BAJA'}; no hay DELETE (AGENTS.md regla 3).
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.registro-tributario')
@Controller('contribuyentes')
export class ContribuyentesController {
  constructor(private readonly contribuyentes: ContribuyentesService) {}

  @Get()
  buscar(@Query() dto: BuscarContribuyentesDto) {
    return this.contribuyentes.buscar(dto);
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
}
