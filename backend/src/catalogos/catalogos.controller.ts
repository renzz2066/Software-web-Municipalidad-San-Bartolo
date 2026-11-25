import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { CatalogosService } from './catalogos.service.js';
import { ActualizarCatalogoDto, CrearCatalogoDto, GuardarReglaDto, ListarCatalogoDto } from './dto/catalogo.dto.js';

// Lectura: la usan los formularios de Rentas. Escritura: solo Maestros (C9: se reusan los niveles).
const LECTORES = ['rentas.maestros', 'rentas.registro-tributario', 'rentas.calculo-masivo', 'rentas.fiscalizacion'];

@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.maestros')
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get()
  @RequireNivel(...LECTORES)
  listar(@Query() dto: ListarCatalogoDto) {
    return this.catalogos.listar(dto);
  }

  // Antes de ':id' para que ParseIntPipe no reciba "grupos" o "reglas".
  @Get('grupos')
  @RequireNivel(...LECTORES)
  grupos() {
    return this.catalogos.grupos();
  }

  @Get('reglas')
  @RequireNivel(...LECTORES)
  reglas() {
    return this.catalogos.reglas();
  }

  @Put('reglas/:clave')
  guardarRegla(@Param('clave') clave: string, @Body() dto: GuardarReglaDto) {
    return this.catalogos.guardarRegla(clave, dto);
  }

  @Post()
  crear(@Body() dto: CrearCatalogoDto) {
    return this.catalogos.crear(dto);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarCatalogoDto) {
    return this.catalogos.actualizar(id, dto);
  }
}
