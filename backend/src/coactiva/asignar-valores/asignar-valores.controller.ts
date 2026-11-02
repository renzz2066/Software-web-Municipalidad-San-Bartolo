import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AsignarValoresService } from './asignar-valores.service.js';
import { AsignarValoresDto } from './dto/asignar-valores.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';

@Controller('coactiva/asignar-valores')
@UseGuards(JwtAuthGuard, NivelGuard)
export class AsignarValoresController {
  constructor(private service: AsignarValoresService) {}

  @Get('memorandums')
  @RequireNivel('coactivo.asignar-valores')
  async getMemorandums() {
    return this.service.getMemorandums();
  }

  @Get('auxiliares')
  @RequireNivel('coactivo.asignar-valores')
  async getAuxiliares() {
    return this.service.getAuxiliares();
  }

  @Get('valores/:memorandumId')
  @RequireNivel('coactivo.asignar-valores')
  async getValoresByMemorandum(@Param('memorandumId') memorandumId: string) {
    return this.service.getValoresByMemorandum(parseInt(memorandumId, 10));
  }

  @Post('asignar')
  @RequireNivel('coactivo.asignar-valores')
  async asignarValores(@Body() dto: AsignarValoresDto, @Req() req: any) {
    return this.service.asignarValores(dto, req.user.id);
  }
}
