import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CobranzaService } from './cobranza.service.js';
import {
  AnioDto,
  CrearGestionDto,
  FiltroPuntajesDto,
  HistorialGestionDto,
  ImportarLoteDto,
} from './dto/cobranza.dto.js';

// Priorización de cobranza (specs/prediccion-cobranza-v1.md).
// Todo exige el nivel; importar, además, rol ADMIN.
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('tablero.priorizacion-cobranza')
@Controller('cobranza')
export class CobranzaController {
  constructor(private readonly cobranza: CobranzaService) {}

  // Cuerpo = el CSV tal cual (Content-Type: text/csv; ver main.ts)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('lotes')
  importar(@Body() contenido: unknown, @Query() q: ImportarLoteDto) {
    return this.cobranza.importar(contenido, q.archivo, q.modelo);
  }

  @Get('lotes')
  lotes() {
    return this.cobranza.lotes();
  }

  @Get('resumen')
  resumen(@Query() q: AnioDto) {
    return this.cobranza.resumen(q.anio);
  }

  @Get('puntajes')
  listar(@Query() filtro: FiltroPuntajesDto) {
    return this.cobranza.listar(filtro);
  }

  @Get('puntajes/exportar')
  exportar(@Query() filtro: FiltroPuntajesDto) {
    return this.cobranza.exportar(filtro);
  }

  @Get('gestiones')
  historial(@Query() q: HistorialGestionDto) {
    return this.cobranza.historial(q);
  }

  @Post('gestiones')
  registrarGestion(@Body() dto: CrearGestionDto) {
    return this.cobranza.registrarGestion(dto);
  }

  @Get('contribuyentes/:id')
  porContribuyente(@Param('id', ParseIntPipe) id: number) {
    return this.cobranza.porContribuyente(id);
  }
}
