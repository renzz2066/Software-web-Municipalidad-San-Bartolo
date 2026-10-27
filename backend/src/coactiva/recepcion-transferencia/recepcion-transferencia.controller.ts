import { Controller, Get, Post, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { RecepcionTransferenciaService } from './recepcion-transferencia.service.js';
import { FiltroValoresDto, TransferenciaIndividualDto, TransferenciaMasivaDto } from './dto/recepcion-transferencia.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';

@Controller('coactiva/recepcion-transferencia')
@UseGuards(JwtAuthGuard, NivelGuard)
export class RecepcionTransferenciaController {
  constructor(private service: RecepcionTransferenciaService) {}

  @Get('valores')
  @RequireNivel('coactivo.recepcion')
  async getValores(@Query() filtros: FiltroValoresDto) {
    return this.service.getValores(filtros);
  }

  @Get('valores/:id')
  @RequireNivel('coactivo.recepcion')
  async getValor(@Param('id') id: string) {
    return this.service.getValor(parseInt(id, 10));
  }

  @Post('valores/:id/transferir')
  @RequireNivel('coactivo.recepcion')
  async transferirIndividual(@Param('id') id: string, @Body() dto: TransferenciaIndividualDto, @Req() req: any) {
    return this.service.transferirIndividual(parseInt(id, 10), dto, req.user.id);
  }

  @Post('valores/transferir-masivo')
  @RequireNivel('coactivo.recepcion')
  async transferirMasivo(@Body() dto: TransferenciaMasivaDto, @Req() req: any) {
    return this.service.transferirMasivo(dto, req.user.id);
  }

  @Get('memorandums')
  @RequireNivel('coactivo.recepcion')
  async getMemorandums() {
    return this.service.getMemorandums();
  }

  @Get('ejecutores')
  @RequireNivel('coactivo.recepcion')
  async getEjecutores() {
    return this.service.getEjecutores();
  }

  @Get('auxiliares')
  @RequireNivel('coactivo.recepcion')
  async getAuxiliares() {
    return this.service.getAuxiliares();
  }

  @Get('tipos-gestion')
  @RequireNivel('coactivo.recepcion')
  async getTiposGestion() {
    return this.service.getTiposGestion();
  }
}