import { Body, Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { TipoTasaMora } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { NivelGuard } from '../../auth/guards/nivel.guard.js';
import { RequireNivel } from '../../auth/decorators/nivel.decorator.js';
import {
  AbrirAnioDto,
  ArancelesDto,
  DepreciacionesDto,
  EscalaDto,
  FeriadosDto,
  FiscalizadorDto,
  InfraccionesDto,
  ParametroFraccionamientoDto,
  TarifasArbitriosDto,
  TasasMoraDto,
  UitDto,
  UrbanizacionDto,
  ValoresUnitariosDto,
  ViaDto,
  ZonaDto,
} from './dto/maestros.dto.js';
import { MaestrosService } from './maestros.service.js';

// Parámetros del año: GET lista, PUT reemplaza el conjunto completo del año (en $transaction).
@UseGuards(JwtAuthGuard, NivelGuard)
@RequireNivel('rentas.maestros')
@Controller('rentas/maestros')
export class MaestrosController {
  constructor(private readonly maestros: MaestrosService) {}

  @Get('resumen/:anio')
  resumen(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.resumen(anio);
  }

  @Post('abrir-anio')
  abrirAnio(@Body() dto: AbrirAnioDto) {
    return this.maestros.abrirAnio(dto);
  }

  @Put('uit/:anio')
  guardarUit(@Param('anio', ParseIntPipe) anio: number, @Body() dto: UitDto) {
    return this.maestros.guardarUit(anio, dto);
  }

  @Get('escala-predial/:anio')
  listarEscala(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.listarEscala(anio);
  }

  @Put('escala-predial/:anio')
  guardarEscala(@Param('anio', ParseIntPipe) anio: number, @Body() dto: EscalaDto) {
    return this.maestros.guardarEscala(anio, dto);
  }

  @Get('aranceles/:anio')
  listarAranceles(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.listarAranceles(anio);
  }

  @Put('aranceles/:anio')
  guardarAranceles(@Param('anio', ParseIntPipe) anio: number, @Body() dto: ArancelesDto) {
    return this.maestros.guardarAranceles(anio, dto);
  }

  @Get('valores-unitarios/:anio')
  listarValoresUnitarios(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.listarValoresUnitarios(anio);
  }

  @Put('valores-unitarios/:anio')
  guardarValoresUnitarios(@Param('anio', ParseIntPipe) anio: number, @Body() dto: ValoresUnitariosDto) {
    return this.maestros.guardarValoresUnitarios(anio, dto);
  }

  @Get('depreciaciones/:anio')
  listarDepreciaciones(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.listarDepreciaciones(anio);
  }

  @Put('depreciaciones/:anio')
  guardarDepreciaciones(@Param('anio', ParseIntPipe) anio: number, @Body() dto: DepreciacionesDto) {
    return this.maestros.guardarDepreciaciones(anio, dto);
  }

  @Get('tarifas-arbitrios/:anio')
  listarTarifas(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.listarTarifas(anio);
  }

  @Put('tarifas-arbitrios/:anio')
  guardarTarifas(@Param('anio', ParseIntPipe) anio: number, @Body() dto: TarifasArbitriosDto) {
    return this.maestros.guardarTarifas(anio, dto);
  }

  @Get('tasas-mora/:tipo')
  listarTasasMora(@Param('tipo', new ParseEnumPipe(TipoTasaMora)) tipo: TipoTasaMora) {
    return this.maestros.listarTasasMora(tipo);
  }

  @Put('tasas-mora/:tipo')
  guardarTasasMora(@Param('tipo', new ParseEnumPipe(TipoTasaMora)) tipo: TipoTasaMora, @Body() dto: TasasMoraDto) {
    return this.maestros.guardarTasasMora(tipo, dto);
  }

  @Get('feriados/:anio')
  listarFeriados(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.listarFeriados(anio);
  }

  @Put('feriados/:anio')
  guardarFeriados(@Param('anio', ParseIntPipe) anio: number, @Body() dto: FeriadosDto) {
    return this.maestros.guardarFeriados(anio, dto);
  }

  @Get('fraccionamiento/:anio')
  obtenerFraccionamiento(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.obtenerFraccionamiento(anio);
  }

  @Put('fraccionamiento/:anio')
  guardarFraccionamiento(@Param('anio', ParseIntPipe) anio: number, @Body() dto: ParametroFraccionamientoDto) {
    return this.maestros.guardarFraccionamiento(anio, dto);
  }

  // Fiscalización (specs/rentas-fiscalizacion-v1.md, decisiones 2 y 5). La lista también la usa
  // la apertura de expedientes.
  @Get('fiscalizadores')
  @RequireNivel('rentas.maestros', 'rentas.fiscalizacion')
  listarFiscalizadores() {
    return this.maestros.listarFiscalizadores();
  }

  @Post('fiscalizadores')
  crearFiscalizador(@Body() dto: FiscalizadorDto) {
    return this.maestros.crearFiscalizador(dto);
  }

  @Patch('fiscalizadores/:id')
  actualizarFiscalizador(@Param('id', ParseIntPipe) id: number, @Body() dto: FiscalizadorDto) {
    return this.maestros.actualizarFiscalizador(id, dto);
  }

  @Get('infracciones/:anio')
  @RequireNivel('rentas.maestros', 'rentas.fiscalizacion', 'rentas.registro-tributario')
  listarInfracciones(@Param('anio', ParseIntPipe) anio: number) {
    return this.maestros.listarInfracciones(anio);
  }

  @Put('infracciones/:anio')
  guardarInfracciones(@Param('anio', ParseIntPipe) anio: number, @Body() dto: InfraccionesDto) {
    return this.maestros.guardarInfracciones(anio, dto);
  }

  // Solo lectura: también lo usa el filtro por zona de la emisión de valores.
  @Get('zonas')
  @RequireNivel('rentas.maestros', 'rentas.control-recaudacion')
  listarZonas() {
    return this.maestros.listarZonas();
  }

  @Post('zonas')
  crearZona(@Body() dto: ZonaDto) {
    return this.maestros.crearZona(dto);
  }

  @Patch('zonas/:id')
  actualizarZona(@Param('id', ParseIntPipe) id: number, @Body() dto: ZonaDto) {
    return this.maestros.actualizarZona(id, dto);
  }

  @Get('urbanizaciones')
  listarUrbanizaciones() {
    return this.maestros.listarUrbanizaciones();
  }

  @Post('urbanizaciones')
  crearUrbanizacion(@Body() dto: UrbanizacionDto) {
    return this.maestros.crearUrbanizacion(dto);
  }

  @Patch('urbanizaciones/:id')
  actualizarUrbanizacion(@Param('id', ParseIntPipe) id: number, @Body() dto: UrbanizacionDto) {
    return this.maestros.actualizarUrbanizacion(id, dto);
  }

  @Get('vias')
  listarVias() {
    return this.maestros.listarVias();
  }

  @Post('vias')
  crearVia(@Body() dto: ViaDto) {
    return this.maestros.crearVia(dto);
  }

  @Patch('vias/:id')
  actualizarVia(@Param('id', ParseIntPipe) id: number, @Body() dto: ViaDto) {
    return this.maestros.actualizarVia(id, dto);
  }
}
