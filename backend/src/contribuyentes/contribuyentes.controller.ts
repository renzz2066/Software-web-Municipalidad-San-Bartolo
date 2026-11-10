import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { ContribuyentesService } from './contribuyentes.service.js';
import { IdentidadService } from './identidad/identidad.service.js';
import {
  BuscarContribuyentesDto,
  BuscarUbigeosDto,
  ConsultarIdentidadDto,
  CreateContribuyenteDto,
  UpdateContribuyenteDto,
} from './dto/contribuyente.dto.js';

// Baja = PATCH {estado: 'BAJA'}; no hay DELETE (AGENTS.md regla 3).
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

  // Autocompletar por documento (specs/consulta-identidad-v1.md): DEBE ir antes de ':id', si no
  // ParseIntPipe recibe "identidad" y contesta 400 en vez de consultar el padrón.
  @Get('identidad')
  consultarIdentidad(@Query() dto: ConsultarIdentidadDto) {
    return this.identidad.consultar(dto);
  }

  // Buscador del campo ubigeo: DEBE ir antes de ':id', si no ParseIntPipe recibe "ubigeos".
  @Get('ubigeos')
  buscarUbigeos(@Query() dto: BuscarUbigeosDto) {
    return this.contribuyentes.buscarUbigeos(dto);
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
