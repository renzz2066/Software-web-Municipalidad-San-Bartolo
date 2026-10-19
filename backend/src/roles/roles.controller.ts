import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { CreateRolDto } from './dto/create-rol.dto.js';
import { SetAccesosDto } from './dto/create-rol.dto.js';
import { UpdateRolDto } from './dto/update-rol.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../auth/guards/nivel.guard.js';
import { RequireNivel } from '../auth/decorators/nivel.decorator.js';

@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('accesibilidad.roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @RequireNivel('accesibilidad.roles', 'accesibilidad.accesos-por-rol')
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRolDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRolDto) {
    return this.rolesService.update(id, dto);
  }

  @RequireNivel('accesibilidad.accesos-por-rol')
  @Get(':id/accesos')
  getAccesos(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.getAccesos(id);
  }

  @RequireNivel('accesibilidad.accesos-por-rol')
  @Put(':id/accesos')
  @HttpCode(HttpStatus.OK)
  setAccesos(@Param('id', ParseIntPipe) id: number, @Body() dto: SetAccesosDto) {
    return this.rolesService.setAccesos(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.rolesService.remove(id);
  }
}
