import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { DeclaracionesService } from './declaraciones.service.js';
import {
  AnularDjDto,
  BuscarDjDto,
  DeclaracionDjDto,
  DeterminacionesContribuyenteDto,
  LiquidarDjDto,
  MultaDjDto,
  RevisionDjDto,
} from './dto/declaracion.dto.js';

// DJ presentada (specs/rentas-nucleo-v2.md, Fases 4 y 5). C9: nivel de Registro Tributario.
// Sin DELETE (J04): se anula con motivo; si ya generó cuenta, la anulación la extorna.
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.registro-tributario')
@Controller('declaraciones')
export class DeclaracionesController {
  constructor(private readonly declaraciones: DeclaracionesService) {}

  @Get()
  buscar(@Query() dto: BuscarDjDto) {
    return this.declaraciones.buscar(dto);
  }

  // HR por año de una persona (antes de :id para que no lo tome como número).
  @Get('determinaciones')
  determinacionesContribuyente(@Query() dto: DeterminacionesContribuyenteDto) {
    return this.declaraciones.determinacionesContribuyente(dto.contribuyenteId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.declaraciones.findOne(id);
  }

  @Get(':id/determinacion')
  determinaciones(@Param('id', ParseIntPipe) id: number) {
    return this.declaraciones.determinaciones(id);
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
  @HttpCode(HttpStatus.OK)
  anular(@Param('id', ParseIntPipe) id: number, @Body() dto: AnularDjDto, @CurrentUser() user: AuthenticatedUser) {
    return this.declaraciones.anular(id, dto, user);
  }

  @Post(':id/reabrir')
  @HttpCode(HttpStatus.OK)
  reabrir(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.declaraciones.reabrir(id, user);
  }

  // C6: calcula y guarda la determinación de cada año que toca la DJ (J15); si baja un período
  // liquidado, la DJ queda en revisión (J14).
  @Post(':id/determinar')
  @HttpCode(HttpStatus.OK)
  determinar(@Param('id', ParseIntPipe) id: number) {
    return this.declaraciones.determinar(id);
  }

  // C7: qué haría la liquidación con la cuenta corriente, sin escribir nada.
  @Post(':id/previa-liquidacion')
  @HttpCode(HttpStatus.OK)
  previaLiquidacion(@Param('id', ParseIntPipe) id: number, @Body() dto: LiquidarDjDto) {
    return this.declaraciones.previaLiquidacion(id, dto);
  }

  // C7 ("Generar Cta."): años y tributos elegidos (L08), todo en una transacción (L12).
  @Post(':id/liquidar')
  @HttpCode(HttpStatus.OK)
  liquidar(@Param('id', ParseIntPipe) id: number, @Body() dto: LiquidarDjDto, @CurrentUser() user: AuthenticatedUser) {
    return this.declaraciones.liquidar(id, dto, user);
  }

  // J14/J17: un supervisor distinto de quien la registró aprueba o rechaza la revisión.
  @Post(':id/revision')
  @HttpCode(HttpStatus.OK)
  revision(@Param('id', ParseIntPipe) id: number, @Body() dto: RevisionDjDto, @CurrentUser() user: AuthenticatedUser) {
    return this.declaraciones.revision(id, dto, user);
  }

  // J08: multa 176.1 de una DJ fuera de plazo (se emite o se descarta con motivo).
  @Post(':id/multa')
  @HttpCode(HttpStatus.OK)
  multa(@Param('id', ParseIntPipe) id: number, @Body() dto: MultaDjDto) {
    return this.declaraciones.multa(id, dto);
  }
}
