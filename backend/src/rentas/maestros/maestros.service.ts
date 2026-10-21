import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoTasaMora, TipoTributo } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AbrirAnioDto,
  ArancelesDto,
  DepreciacionesDto,
  EscalaDto,
  TarifasArbitriosDto,
  TasasMoraDto,
  UitDto,
  UrbanizacionDto,
  ValoresUnitariosDto,
  ViaDto,
  ZonaDto,
} from './dto/maestros.dto.js';
import { anioValido, indiceDuplicado, validarEscala } from './maestros.reglas.js';

type Tx = Prisma.TransactionClient;

// Parámetros anuales que se copian al abrir un año (la UIT no: cambia cada año).
const TABLAS_COPIABLES = ['escalaPredial', 'aranceles', 'valoresUnitarios', 'depreciaciones', 'tarifasArbitrios'] as const;

@Injectable()
export class MaestrosService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Resumen del año ----

  async resumen(anio: number) {
    this.validarAnio(anio);
    const [uit, escalaPredial, aranceles, valoresUnitarios, depreciaciones, tarifasArbitrios, bloqueado] =
      await Promise.all([
        this.prisma.uit.findUnique({ where: { anio } }),
        this.prisma.escalaPredial.count({ where: { anio } }),
        this.prisma.arancel.count({ where: { anio } }),
        this.prisma.valorUnitario.count({ where: { anio } }),
        this.prisma.depreciacion.count({ where: { anio } }),
        this.prisma.tarifaArbitrio.count({ where: { anio } }),
        this.anioConDeuda(this.prisma, anio),
      ]);
    return {
      anio,
      uit,
      conteos: { escalaPredial, aranceles, valoresUnitarios, depreciaciones, tarifasArbitrios },
      bloqueado,
    };
  }

  // ---- UIT ----

  async guardarUit(anio: number, dto: UitDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarEditable(tx, anio);
      const data = { valor: dto.valor, ordenanza: this.texto(dto.ordenanza) };
      return tx.uit.upsert({ where: { anio }, update: data, create: { anio, ...data } });
    });
  }

  // ---- Escala predial ----

  listarEscala(anio: number) {
    this.validarAnio(anio);
    return this.prisma.escalaPredial.findMany({ where: { anio }, orderBy: { tramo: 'asc' } });
  }

  async guardarEscala(anio: number, dto: EscalaDto) {
    const error = validarEscala(dto.items);
    if (error) {
      throw new BadRequestException(error);
    }
    const ordenanza = this.texto(dto.ordenanza);
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarEditable(tx, anio);
      await tx.escalaPredial.deleteMany({ where: { anio } });
      await tx.escalaPredial.createMany({
        data: dto.items.map((t) => ({
          anio,
          tramo: t.tramo,
          desdeUit: t.desdeUit,
          hastaUit: t.hastaUit ?? null,
          tasa: t.tasa,
          ordenanza,
        })),
      });
      return tx.escalaPredial.findMany({ where: { anio }, orderBy: { tramo: 'asc' } });
    });
  }

  // ---- Aranceles ----

  listarAranceles(anio: number) {
    this.validarAnio(anio);
    return this.prisma.arancel.findMany({
      where: { anio },
      include: { via: true, urbanizacion: true },
      orderBy: [{ via: { nombre: 'asc' } }, { id: 'asc' }],
    });
  }

  async guardarAranceles(anio: number, dto: ArancelesDto) {
    this.sinDuplicados(dto.items, (a) => `${a.viaId}|${a.urbanizacionId ?? '*'}`, 'Hay una vía repetida en la misma urbanización');
    const ordenanza = this.texto(dto.ordenanza);
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarEditable(tx, anio);
      await tx.arancel.deleteMany({ where: { anio } });
      await tx.arancel.createMany({
        data: dto.items.map((a) => ({
          anio,
          viaId: a.viaId,
          urbanizacionId: a.urbanizacionId ?? null,
          valorM2: a.valorM2,
          ordenanza,
        })),
      });
      return tx.arancel.findMany({ where: { anio }, include: { via: true, urbanizacion: true } });
    });
  }

  // ---- Valores unitarios ----

  listarValoresUnitarios(anio: number) {
    this.validarAnio(anio);
    return this.prisma.valorUnitario.findMany({
      where: { anio },
      orderBy: [{ componente: 'asc' }, { categoria: 'asc' }],
    });
  }

  async guardarValoresUnitarios(anio: number, dto: ValoresUnitariosDto) {
    this.sinDuplicados(dto.items, (v) => `${v.componente}|${v.categoria}`, 'Hay un componente y categoría repetidos');
    const ordenanza = this.texto(dto.ordenanza);
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarEditable(tx, anio);
      await tx.valorUnitario.deleteMany({ where: { anio } });
      await tx.valorUnitario.createMany({
        data: dto.items.map((v) => ({ anio, componente: v.componente, categoria: v.categoria, valor: v.valor, ordenanza })),
      });
      return tx.valorUnitario.findMany({ where: { anio }, orderBy: [{ componente: 'asc' }, { categoria: 'asc' }] });
    });
  }

  // ---- Depreciación ----

  listarDepreciaciones(anio: number) {
    this.validarAnio(anio);
    return this.prisma.depreciacion.findMany({
      where: { anio },
      orderBy: [{ clasificacion: 'asc' }, { material: 'asc' }, { antiguedadHasta: 'asc' }, { estadoConservacion: 'asc' }],
    });
  }

  async guardarDepreciaciones(anio: number, dto: DepreciacionesDto) {
    const items = dto.items.map((d) => ({
      ...d,
      clasificacion: d.clasificacion.trim().toUpperCase(),
      material: d.material.trim().toUpperCase(),
      estadoConservacion: d.estadoConservacion.trim().toUpperCase(),
    }));
    this.sinDuplicados(
      items,
      (d) => `${d.clasificacion}|${d.material}|${d.antiguedadHasta}|${d.estadoConservacion}`,
      'Hay una fila de depreciación repetida',
    );
    const ordenanza = this.texto(dto.ordenanza);
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarEditable(tx, anio);
      await tx.depreciacion.deleteMany({ where: { anio } });
      await tx.depreciacion.createMany({ data: items.map((d) => ({ anio, ...d, ordenanza })) });
      return tx.depreciacion.findMany({ where: { anio } });
    });
  }

  // ---- Tarifas de arbitrios (zona + uso; null = todas) ----

  listarTarifas(anio: number) {
    this.validarAnio(anio);
    return this.prisma.tarifaArbitrio.findMany({
      where: { anio },
      include: { zona: true },
      orderBy: [{ concepto: 'asc' }, { zonaId: 'asc' }, { uso: 'asc' }],
    });
  }

  async guardarTarifas(anio: number, dto: TarifasArbitriosDto) {
    const items = dto.items.map((t) => ({
      concepto: t.concepto.trim().toUpperCase(),
      zonaId: t.zonaId ?? null,
      uso: this.texto(t.uso)?.toUpperCase() ?? null,
      tasa: t.tasa,
    }));
    this.sinDuplicados(items, (t) => `${t.concepto}|${t.zonaId ?? '*'}|${t.uso ?? '*'}`, 'Hay una tarifa repetida (concepto, zona y uso)');
    const ordenanza = this.texto(dto.ordenanza);
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarEditable(tx, anio);
      await tx.tarifaArbitrio.deleteMany({ where: { anio } });
      await tx.tarifaArbitrio.createMany({ data: items.map((t) => ({ anio, ...t, ordenanza })) });
      return tx.tarifaArbitrio.findMany({ where: { anio }, include: { zona: true } });
    });
  }

  // ---- TIM / IPM (series por fecha, no por año) ----

  listarTasasMora(tipo: TipoTasaMora) {
    return this.prisma.tasaMora.findMany({ where: { tipo }, orderBy: { vigenciaDesde: 'asc' } });
  }

  async guardarTasasMora(tipo: TipoTasaMora, dto: TasasMoraDto) {
    this.sinDuplicados(dto.items, (t) => t.vigenciaDesde.slice(0, 10), 'Hay dos tasas con la misma fecha de vigencia');
    return this.prisma.$transaction(async (tx) => {
      await tx.tasaMora.deleteMany({ where: { tipo } });
      await tx.tasaMora.createMany({
        data: dto.items.map((t) => ({
          tipo,
          vigenciaDesde: new Date(t.vigenciaDesde.slice(0, 10)),
          valor: t.valor,
          ordenanza: this.texto(t.ordenanza),
        })),
      });
      return tx.tasaMora.findMany({ where: { tipo }, orderBy: { vigenciaDesde: 'asc' } });
    });
  }

  // ---- Abrir año: copia los parámetros de "desde" a "hacia" donde "hacia" esté vacío ----

  async abrirAnio(dto: AbrirAnioDto) {
    this.validarAnio(dto.desde);
    this.validarAnio(dto.hacia);
    if (dto.hacia <= dto.desde) {
      throw new BadRequestException('El año a abrir debe ser posterior al año origen');
    }
    const { desde, hacia } = dto;
    return this.prisma.$transaction(async (tx) => {
      await this.asegurarEditable(tx, hacia);
      const copiados: Record<string, number> = {};
      for (const tabla of TABLAS_COPIABLES) {
        copiados[tabla] = await this.copiarTabla(tx, tabla, desde, hacia);
      }
      return { desde, hacia, copiados };
    });
  }

  private async copiarTabla(tx: Tx, tabla: (typeof TABLAS_COPIABLES)[number], desde: number, hacia: number) {
    // Cada delegado tiene su propio tipo; se copia sin id/createdAt.
    const sinMeta = <T extends { id: number; createdAt: Date; anio: number }>(filas: T[]) =>
      filas.map(({ id: _id, createdAt: _c, ...resto }) => ({ ...resto, anio: hacia }));
    switch (tabla) {
      case 'escalaPredial':
        if (await tx.escalaPredial.count({ where: { anio: hacia } })) return 0;
        return (await tx.escalaPredial.createMany({ data: sinMeta(await tx.escalaPredial.findMany({ where: { anio: desde } })) })).count;
      case 'aranceles':
        if (await tx.arancel.count({ where: { anio: hacia } })) return 0;
        return (await tx.arancel.createMany({ data: sinMeta(await tx.arancel.findMany({ where: { anio: desde } })) })).count;
      case 'valoresUnitarios':
        if (await tx.valorUnitario.count({ where: { anio: hacia } })) return 0;
        return (await tx.valorUnitario.createMany({ data: sinMeta(await tx.valorUnitario.findMany({ where: { anio: desde } })) })).count;
      case 'depreciaciones':
        if (await tx.depreciacion.count({ where: { anio: hacia } })) return 0;
        return (await tx.depreciacion.createMany({ data: sinMeta(await tx.depreciacion.findMany({ where: { anio: desde } })) })).count;
      case 'tarifasArbitrios':
        if (await tx.tarifaArbitrio.count({ where: { anio: hacia } })) return 0;
        return (await tx.tarifaArbitrio.createMany({ data: sinMeta(await tx.tarifaArbitrio.findMany({ where: { anio: desde } })) })).count;
    }
  }

  // ---- Catálogos de ubicación ----

  listarZonas() {
    return this.prisma.zona.findMany({ orderBy: { codigo: 'asc' } });
  }

  crearZona(dto: ZonaDto) {
    return this.unico(() => this.prisma.zona.create({ data: this.limpiarCatalogo(dto) }), 'Ya existe una zona con ese código');
  }

  actualizarZona(id: number, dto: ZonaDto) {
    return this.unico(() => this.prisma.zona.update({ where: { id }, data: this.limpiarCatalogo(dto) }), 'Ya existe una zona con ese código');
  }

  listarUrbanizaciones() {
    return this.prisma.urbanizacion.findMany({ orderBy: { nombre: 'asc' } });
  }

  crearUrbanizacion(dto: UrbanizacionDto) {
    return this.unico(
      () => this.prisma.urbanizacion.create({ data: this.limpiarCatalogo(dto) }),
      'Ya existe una urbanización con ese código',
    );
  }

  actualizarUrbanizacion(id: number, dto: UrbanizacionDto) {
    return this.unico(
      () => this.prisma.urbanizacion.update({ where: { id }, data: this.limpiarCatalogo(dto) }),
      'Ya existe una urbanización con ese código',
    );
  }

  listarVias() {
    return this.prisma.via.findMany({ orderBy: [{ nombre: 'asc' }, { tipoVia: 'asc' }] });
  }

  crearVia(dto: ViaDto) {
    return this.unico(() => this.prisma.via.create({ data: this.limpiarVia(dto) }), 'Esa vía ya existe');
  }

  actualizarVia(id: number, dto: ViaDto) {
    return this.unico(() => this.prisma.via.update({ where: { id }, data: this.limpiarVia(dto) }), 'Esa vía ya existe');
  }

  // ---- Utilidades ----

  // Con deuda predial/arbitrios generada, los parámetros del año quedan congelados:
  // cambiarlos dejaría la cuenta corriente inconsistente con su base de cálculo.
  private async anioConDeuda(db: Tx | PrismaService, anio: number) {
    const n = await db.cuentaCorriente.count({
      where: {
        anioFiscal: anio,
        estado: { not: 'ANULADO' },
        tributo: { tipo: { in: [TipoTributo.PREDIAL, TipoTributo.ARBITRIOS] } },
      },
    });
    return n > 0;
  }

  private async asegurarEditable(tx: Tx, anio: number) {
    this.validarAnio(anio);
    if (await this.anioConDeuda(tx, anio)) {
      throw new ConflictException(`El año ${anio} ya tiene deuda calculada; sus parámetros no se pueden modificar`);
    }
  }

  private validarAnio(anio: number) {
    if (!anioValido(anio)) {
      throw new BadRequestException('El año no es válido');
    }
  }

  private sinDuplicados<T>(items: T[], clave: (item: T) => string, mensaje: string) {
    const i = indiceDuplicado(items, clave);
    if (i >= 0) {
      throw new BadRequestException(`${mensaje} (fila ${i + 1})`);
    }
  }

  private texto(valor?: string | null) {
    const t = valor?.trim();
    return t ? t : null;
  }

  private limpiarCatalogo(dto: { codigo: string; nombre: string }) {
    return { codigo: dto.codigo.trim().toUpperCase(), nombre: dto.nombre.trim().toUpperCase() };
  }

  private limpiarVia(dto: ViaDto) {
    return { tipoVia: dto.tipoVia.trim().toUpperCase(), nombre: dto.nombre.trim().toUpperCase() };
  }

  private async unico<T>(accion: () => Promise<T>, mensajeDuplicado: string) {
    try {
      return await accion();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new ConflictException(mensajeDuplicado);
        if (error.code === 'P2025') throw new NotFoundException('El registro no existe');
      }
      throw error;
    }
  }
}
