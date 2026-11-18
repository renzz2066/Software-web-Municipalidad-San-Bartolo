import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoPersona, EstadoRegistro, GrupoCatalogo, MotivoDeclaracion, Prisma, TipoPersona } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { errorCoordenadas } from '../direcciones/direccion.reglas.js';
import { DireccionesService } from '../direcciones/direcciones.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hoyLima } from '../rentas/fechas.js';
import { anioValido } from '../rentas/maestros/maestros.reglas.js';
import { iso } from '../rentas/estado-cuenta/tasas.js';
import { vencePlazoDJ, esExtemporanea } from '../rentas/fiscalizacion/multas.reglas.js';
import { validarDeclaracion } from './declaracion.reglas.js';
import { DatosPredioDto, DeclaracionDto } from './dto/declaracion.dto.js';
import { MaestroPredioDto, PredioBeneficioDto, RevocarPredioBeneficioDto } from './dto/predio.dto.js';
import {
  CONDICIONES_AUTOMATICAS,
  LADOS,
  asociacionEnAnio,
  condicionPorDefecto,
  errorBeneficioPredio,
  errorLinderos,
  seSolapan,
} from './predio.reglas.js';

type Tx = Prisma.TransactionClient;
type Construccion = Pick<DeclaracionDto, 'pisos' | 'otrasInstalaciones'>;

// Una DJ hace ~15 consultas seguidas; con la latencia a Supabase el límite de 5 s no alcanza.
const OPCIONES_TX = { maxWait: 10_000, timeout: 20_000 };

export const INCLUDE_PREDIO = {
  direccion: { select: { id: true, direccion: true, activo: true } },
  zona: { select: { id: true, codigo: true, nombre: true } },
  urbanizacion: { select: { id: true, codigo: true, nombre: true } },
  via: { select: { id: true, tipoVia: true, nombre: true } },
  pisos: { orderBy: { nivel: 'asc' } },
  otrasInstalaciones: { orderBy: { id: 'asc' } },
  contribuyentes: {
    where: { estado: EstadoRegistro.ACTIVO },
    select: {
      porcentaje: true,
      esPrincipal: true,
      fechaAdquisicion: true,
      condicion: true,
      contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
    },
    orderBy: [{ esPrincipal: 'desc' }, { contribuyenteId: 'asc' }],
  },
} satisfies Prisma.PredioInclude;

// El código catastral identifica al predio (IDCATASTRO, único). Sin esta validación el duplicado
// llega a Prisma como P2002 y el usuario ve un 500 con stack en vez de un aviso claro.
export async function asegurarCodigoCatastroUnico(tx: Tx, codigoCatastro: string | null, predioId: number | null) {
  if (!codigoCatastro) return;
  const otro = await tx.predio.findFirst({
    where: { codigoCatastro, ...(predioId ? { NOT: { id: predioId } } : {}) },
    select: { id: true },
  });
  if (otro) {
    throw new ConflictException(
      `Ya existe un predio con el código catastral ${codigoCatastro} (predio #${otro.id}). Edita ese predio o usa otro código.`,
    );
  }
}

const texto = (v?: string | null) => v?.trim().replace(/\s+/g, ' ').toUpperCase() || null;

@Injectable()
export class PrediosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly direcciones: DireccionesService,
    private readonly catalogosV2: CatalogosService,
  ) {}

  // Catálogos de ubicación en solo lectura para quien registra DDJJ (sin nivel de maestros).
  async catalogos() {
    const [zonas, urbanizaciones, vias] = await Promise.all([
      this.prisma.zona.findMany({ orderBy: { codigo: 'asc' } }),
      this.prisma.urbanizacion.findMany({ orderBy: { nombre: 'asc' } }),
      this.prisma.via.findMany({ orderBy: [{ nombre: 'asc' }, { tipoVia: 'asc' }] }),
    ]);
    return { zonas, urbanizaciones, vias };
  }

  async buscar(dto: { q?: string; limit?: number }) {
    const q = dto.q?.trim() ?? '';
    const palabras = q.split(/\s+/).filter(Boolean).slice(0, 6);
    const where: Prisma.PredioWhereInput = /^\d+$/.test(q)
      ? { OR: [...(q.length <= 9 ? [{ id: Number(q) }] : []), { codigoLegacy: { startsWith: q } }, { codigoCatastro: { startsWith: q } }] }
      : {
          AND: palabras.map((p) => ({
            OR: [
              { nombre: { contains: p, mode: 'insensitive' } },
              { codigoCatastro: { contains: p, mode: 'insensitive' } },
              { direccion: { direccion: { contains: p, mode: 'insensitive' } } },
            ],
          })),
        };
    const items = await this.prisma.predio.findMany({
      where: { ...where, estado: { not: EstadoRegistro.BAJA } },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        estado: true,
        codigoCatastro: true,
        areaTerreno: true,
        direccion: { select: { direccion: true } },
        contribuyentes: { where: { estado: EstadoRegistro.ACTIVO }, select: { porcentaje: true, contribuyente: { select: { id: true, nombreCompleto: true } } } },
      },
      orderBy: { id: 'asc' },
      take: dto.limit ?? 10,
    });
    return { items };
  }

  async findOne(id: number) {
    const predio = await this.prisma.predio.findUnique({
      where: { id },
      include: {
        ...INCLUDE_PREDIO,
        beneficios: { orderBy: [{ vigente: 'desc' }, { anioDesde: 'desc' }] },
        declaraciones: {
          select: {
            id: true,
            anio: true,
            motivo: true,
            fecha: true,
            fechaHecho: true,
            observacion: true,
            multaDescartada: true,
            contribuyente: { select: { id: true, nombreCompleto: true } },
            multas: { where: { estado: { not: 'ANULADO' } }, select: { id: true, anio: true, numero: true, estado: true } },
          },
          orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        },
      },
    });
    if (!predio) {
      throw new NotFoundException('El predio no existe');
    }
    // DJ extemporánea (specs/rentas-fiscalizacion-v1.md, F7): plazo y si ya se resolvió su multa.
    const feriados = new Set((await this.prisma.feriado.findMany({ select: { fecha: true } })).map((f) => iso(f.fecha)));
    return {
      ...predio,
      declaraciones: predio.declaraciones.map((dj) => {
        const hecho = dj.fechaHecho ? iso(dj.fechaHecho) : null;
        return {
          ...dj,
          fechaHecho: hecho,
          vencePlazo: hecho ? vencePlazoDJ(dj.motivo, hecho, feriados) : null,
          extemporanea: esExtemporanea(dj.motivo, hecho, iso(dj.fecha), feriados),
        };
      }),
    };
  }

  async findDeclaracion(id: number) {
    const dj = await this.prisma.declaracionJurada.findUnique({
      where: { id },
      include: { contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } } },
    });
    if (!dj) {
      throw new NotFoundException('La declaración no existe');
    }
    return dj;
  }

  // Toda DJ cambia el predio y queda versionada con su foto (snapshot), en una sola transacción.
  async declarar(dto: DeclaracionDto) {
    if (!anioValido(dto.anio)) {
      throw new BadRequestException('El año no es válido');
    }
    if (dto.motivo !== MotivoDeclaracion.BAJA && !dto.predio) {
      throw new BadRequestException('Completa los datos del predio');
    }
    const fecha = dto.fecha.slice(0, 10);

    return this.prisma.$transaction(async (tx) => {
      const actual = dto.predioId
        ? await tx.predio.findUnique({
            where: { id: dto.predioId },
            select: { id: true, estado: true, contribuyentes: { where: { estado: EstadoRegistro.ACTIVO }, select: { contribuyenteId: true } } },
          })
        : null;
      if (dto.predioId && !actual) {
        throw new NotFoundException('El predio no existe');
      }
      if (actual?.estado === EstadoRegistro.BAJA) {
        throw new ConflictException('El predio está dado de baja');
      }

      const error = validarDeclaracion(
        { ...dto, fecha, fechaHecho: dto.fechaHecho?.slice(0, 10) ?? null },
        { hoy: hoyLima(), titularesActuales: actual?.contribuyentes.map((c) => c.contribuyenteId) ?? [] },
      );
      if (error) {
        throw new BadRequestException(error);
      }
      const personas = await this.asegurarContribuyentes(tx, [dto.declaranteId, ...dto.condominos.map((c) => c.contribuyenteId)]);
      const fechaHecho = dto.fechaHecho?.slice(0, 10) ?? fecha;

      let predioId: number;
      if (dto.motivo === MotivoDeclaracion.BAJA) {
        predioId = actual!.id;
        await tx.predio.update({ where: { id: predioId }, data: { estado: EstadoRegistro.BAJA } });
        await tx.predioContribuyente.updateMany({
          where: { predioId, estado: EstadoRegistro.ACTIVO },
          data: { estado: EstadoRegistro.BAJA, fechaFin: new Date(fechaHecho) },
        });
      } else {
        const datos = await this.datosPredio(tx, dto.predio!, dto);
        await asegurarCodigoCatastroUnico(tx, datos.codigoCatastro, actual?.id ?? null);
        predioId = actual
          ? (await tx.predio.update({ where: { id: actual.id }, data: datos })).id
          : (await tx.predio.create({ data: datos })).id;
        await this.reemplazarConstruccion(tx, predioId, dto);
        await this.sincronizarCondominos(tx, predioId, dto, fechaHecho, personas);
      }

      const snapshot = await tx.predio.findUniqueOrThrow({ where: { id: predioId }, include: INCLUDE_PREDIO });
      const dj = await tx.declaracionJurada.create({
        data: {
          predioId,
          contribuyenteId: dto.declaranteId,
          anio: dto.anio,
          motivo: dto.motivo,
          fecha: new Date(fecha),
          fechaHecho: dto.fechaHecho ? new Date(dto.fechaHecho.slice(0, 10)) : null,
          snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
          observacion: dto.observacion?.trim() || null,
        },
        select: { id: true },
      });
      return { declaracionId: dj.id, predioId };
    }, OPCIONES_TX);
  }

  // DJ de motivo FISCALIZACION (specs/rentas-fiscalizacion-v1.md, F5): aplica la ficha de inspección al
  // predio dentro de la transacción de la resolución; los condóminos no cambian. Queda versionada igual.
  async aplicarFicha(
    tx: Tx,
    e: { predioId: number; contribuyenteId: number; anio: number; fecha: string; ficha: Construccion & { predio: DatosPredioDto }; observacion: string },
  ) {
    const datosFicha = await this.datosPredio(tx, e.ficha.predio, e.ficha);
    await asegurarCodigoCatastroUnico(tx, datosFicha.codigoCatastro, e.predioId);
    await tx.predio.update({ where: { id: e.predioId }, data: datosFicha });
    await this.reemplazarConstruccion(tx, e.predioId, e.ficha);
    const snapshot = await tx.predio.findUniqueOrThrow({ where: { id: e.predioId }, include: INCLUDE_PREDIO });
    const dj = await tx.declaracionJurada.create({
      data: {
        predioId: e.predioId,
        contribuyenteId: e.contribuyenteId,
        anio: e.anio,
        motivo: MotivoDeclaracion.FISCALIZACION,
        fecha: new Date(e.fecha),
        snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
        observacion: e.observacion.slice(0, 250),
      },
      select: { id: true },
    });
    return dj.id;
  }

  // ---- Predio maestro (R01, R02, R05): identificación y arbitrios, sin DJ ----

  async actualizarMaestro(id: number, dto: MaestroPredioDto) {
    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.predio.findUnique({
        where: { id },
        include: { contribuyentes: { where: { estado: EstadoRegistro.ACTIVO }, select: { contribuyenteId: true, condicion: true } } },
      });
      if (!actual) throw new NotFoundException('El predio no existe');
      if (actual.estado === EstadoRegistro.BAJA) throw new ConflictException('El predio está dado de baja');
      const data: Record<string, unknown> = {};
      if (dto.tipo) data.tipo = dto.tipo;
      if (dto.nombre !== undefined) data.nombre = texto(dto.nombre);

      if (dto.latitud !== undefined || dto.longitud !== undefined) {
        const numero = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
        const latitud = dto.latitud !== undefined ? dto.latitud : numero(actual.latitud);
        const longitud = dto.longitud !== undefined ? dto.longitud : numero(actual.longitud);
        const e = errorCoordenadas(latitud ?? null, longitud ?? null);
        if (e) throw new BadRequestException(e);
        Object.assign(data, { latitud: latitud ?? null, longitud: longitud ?? null });
      }

      const linderos = LADOS.map((lado) => {
        const metros = dto[`lindero${lado}Metros`];
        const colindante = dto[`lindero${lado}Colindante`];
        if (metros !== undefined) data[`lindero${lado}Metros`] = metros;
        if (colindante !== undefined) data[`lindero${lado}Colindante`] = texto(colindante);
        return { lado, metros: metros ?? null, colindante: colindante ?? null };
      });
      const eLinderos = errorLinderos(linderos);
      if (eLinderos) throw new BadRequestException(eLinderos);

      const catalogados = [
        ['frecuenciaBarrido', GrupoCatalogo.FRECUENCIA_BARRIDO, 'Código de frecuencia de barrido'],
        ['ubicacionParque', GrupoCatalogo.UBICACION_PARQUE, 'Código de ubicación respecto a parques'],
      ] as const;
      for (const [campo, grupo, etiqueta] of catalogados) {
        if (dto[campo] === undefined) continue;
        const codigo = dto[campo] || null;
        if (codigo) await this.catalogosV2.asegurarCodigos(tx, grupo, [codigo], etiqueta, actual[campo] ? [actual[campo]] : []);
        data[campo] = codigo;
      }
      if (dto.frontis !== undefined) data.frontis = dto.frontis;
      if (Object.keys(data).length) await tx.predio.update({ where: { id }, data: data as Prisma.PredioUncheckedUpdateInput });

      // R05: condición de propiedad de cada titular vigente.
      if (dto.titulares?.length) {
        const vigentes = new Map(actual.contribuyentes.map((t) => [t.contribuyenteId, t.condicion]));
        await this.catalogosV2.asegurarCodigos(
          tx,
          GrupoCatalogo.CONDICION_PROPIEDAD,
          dto.titulares.map((t) => t.condicion),
          'Código de condición de propiedad',
          [...vigentes.values()].filter((c): c is string => Boolean(c)),
        );
        for (const t of dto.titulares) {
          if (!vigentes.has(t.contribuyenteId)) throw new BadRequestException('Uno de los titulares no es titular vigente del predio');
          if (vigentes.get(t.contribuyenteId) === t.condicion) continue;
          await tx.predioContribuyente.update({
            where: { contribuyenteId_predioId: { contribuyenteId: t.contribuyenteId, predioId: id } },
            data: { condicion: t.condicion },
          });
        }
      }
    });
    return this.findOne(id);
  }

  // C4: quiénes fueron titulares en el año y quién era el contribuyente al 1 de enero (J10).
  async personasPorAnio(id: number, anio = Number(hoyLima().slice(0, 4))) {
    const p = await this.prisma.predio.findUnique({
      where: { id },
      select: {
        contribuyentes: {
          select: {
            porcentaje: true,
            condicion: true,
            fechaAdquisicion: true,
            fechaFin: true,
            estado: true,
            contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
          },
          orderBy: [{ fechaAdquisicion: 'asc' }, { contribuyenteId: 'asc' }],
        },
      },
    });
    if (!p) throw new NotFoundException('El predio no existe');
    const personas = p.contribuyentes
      .map((t) => {
        const fechaAdquisicion = t.fechaAdquisicion ? iso(t.fechaAdquisicion) : null;
        const fechaFin = t.fechaFin ? iso(t.fechaFin) : null;
        const a = asociacionEnAnio({ contribuyenteId: t.contribuyente.id, fechaAdquisicion, fechaFin, estado: t.estado }, anio);
        return { ...t, fechaAdquisicion, fechaFin, ...a };
      })
      .filter((t) => t.asociado)
      .map(({ asociado: _a, ...t }) => t);
    return { anio, personas };
  }

  // ---- Beneficios del predio (R06) ----

  async agregarBeneficio(id: number, dto: PredioBeneficioDto) {
    const predio = await this.prisma.predio.findUnique({
      where: { id },
      select: {
        estado: true,
        beneficios: { where: { vigente: true } },
        contribuyentes: {
          where: { estado: EstadoRegistro.ACTIVO },
          select: {
            contribuyente: {
              select: { nombreCompleto: true, beneficios: { where: { vigente: true }, select: { codigo: true, anioDesde: true, anioHasta: true } } },
            },
          },
        },
      },
    });
    if (!predio) throw new NotFoundException('El predio no existe');
    if (predio.estado === EstadoRegistro.BAJA) throw new ConflictException('El predio está dado de baja');
    const item = (await this.catalogosV2.asegurarCodigos(this.prisma, GrupoCatalogo.BENEFICIO, [dto.codigo], 'Beneficio')).get(dto.codigo)!;
    const attrs = (item.atributos ?? {}) as { regimen?: string; porcentaje?: number; baseLegal?: string };

    // Régimen de lo que ya hay: resoluciones de los titulares y del propio predio.
    const otros = [
      ...predio.contribuyentes.flatMap((t) => t.contribuyente.beneficios.map((b) => b.codigo)),
      ...predio.beneficios.map((b) => b.codigo),
    ];
    const regimenes = await this.catalogosV2.asegurarCodigos(this.prisma, GrupoCatalogo.BENEFICIO, otros, 'Beneficio', otros);
    const regimen = (codigo: string) => (regimenes.get(codigo)?.atributos as { regimen?: string } | null)?.regimen;

    const anioHasta = dto.anioHasta ?? null;
    // Primero el régimen: una deducción (P15) es de la persona, no se pide su porcentaje aquí.
    const porcentaje =
      attrs.regimen === 'INAFECTACION' ? 100 : attrs.regimen === 'EXONERACION' ? (dto.porcentaje ?? attrs.porcentaje ?? null) : 100;
    if (porcentaje === null) throw new BadRequestException('Indica el porcentaje de la exoneración');
    const error = errorBeneficioPredio(
      { regimen: attrs.regimen, porcentaje, nombre: item.nombre, anioDesde: dto.anioDesde, anioHasta },
      predio.contribuyentes.map((t) => ({
        nombre: t.contribuyente.nombreCompleto,
        inafectaciones: t.contribuyente.beneficios.filter((b) => regimen(b.codigo) === 'INAFECTACION'),
      })),
    );
    if (error) throw new BadRequestException(error);
    if (dto.fechaResolucion.slice(0, 10) > hoyLima()) throw new BadRequestException('La fecha de la resolución no puede ser futura');
    const choque = predio.beneficios.find((b) => regimen(b.codigo) === attrs.regimen && seSolapan(b, { anioDesde: dto.anioDesde, anioHasta }));
    if (choque) {
      throw new ConflictException(`El predio ya tiene una resolución vigente del mismo régimen para esos años (${choque.resolucion}): revócala primero`);
    }
    const baseLegal = dto.baseLegal?.trim() || attrs.baseLegal;
    if (!baseLegal) throw new BadRequestException('Indica la base legal');
    await this.prisma.predioBeneficio.create({
      data: {
        predioId: id,
        codigo: dto.codigo,
        porcentaje,
        baseLegal,
        expediente: dto.expediente?.trim() || null,
        resolucion: dto.resolucion.trim().toUpperCase(),
        fechaResolucion: new Date(dto.fechaResolucion.slice(0, 10)),
        anioDesde: dto.anioDesde,
        anioHasta,
        observacion: dto.observacion?.trim() || null,
      },
    });
    return this.findOne(id);
  }

  async revocarBeneficio(id: number, beneficioId: number, dto: RevocarPredioBeneficioDto) {
    const b = await this.prisma.predioBeneficio.findFirst({ where: { id: beneficioId, predioId: id } });
    if (!b) throw new NotFoundException('La resolución no existe');
    if (!b.vigente) throw new ConflictException('La resolución ya estaba revocada');
    const anioHasta = dto.anioHasta ?? b.anioHasta;
    if (anioHasta !== null && anioHasta < b.anioDesde) throw new BadRequestException('El año final no puede ser menor que el inicial');
    await this.prisma.predioBeneficio.update({ where: { id: beneficioId }, data: { vigente: false, anioHasta, observacion: dto.observacion.trim() } });
    return this.findOne(id);
  }

  // La ubicación que trae la DJ se guarda como dirección única (D01) y como copia en el predio, que es
  // lo que leen el cálculo (arancel por vía, arbitrios por zona), caja, valores y fiscalización.
  private async datosPredio(tx: Tx, p: DatosPredioDto, dto: Construccion) {
    const areaConstruida = dto.pisos.reduce((acc, piso) => acc + Math.round(piso.areaConstruida * 100), 0) / 100;
    const numero = texto(p.numero);
    const manzana = texto(p.manzana);
    const lote = texto(p.lote);
    const referencia = texto(p.referencia);
    const componentes = [
      ['NUMERO', numero],
      ['MZ', manzana],
      ['LT', lote],
    ]
      .filter((c): c is [string, string] => Boolean(c[1]))
      .map(([componente, valor]) => ({ componente, valor }));
    const direccion = await this.direcciones.obtenerOCrear(tx, {
      zonaId: p.zonaId ?? null,
      urbanizacionId: p.urbanizacionId ?? null,
      viaId: p.viaId,
      componentes,
      referencia,
    });
    return {
      direccionId: direccion.id,
      zonaId: p.zonaId ?? null,
      urbanizacionId: p.urbanizacionId ?? null,
      viaId: p.viaId,
      numero,
      manzana,
      lote,
      referencia,
      codigoCatastro: texto(p.codigoCatastro),
      areaTerreno: p.areaTerreno,
      areaConstruida,
      usoPredio: texto(p.usoPredio),
    };
  }

  // Pisos e instalaciones se declaran completos en cada DJ (la versión anterior queda en el snapshot).
  private async reemplazarConstruccion(tx: Tx, predioId: number, dto: Construccion) {
    await tx.otraInstalacion.deleteMany({ where: { predioId } });
    await tx.piso.deleteMany({ where: { predioId } });
    if (dto.pisos.length) {
      await tx.piso.createMany({
        data: dto.pisos.map((p) => ({
          predioId,
          nivel: p.nivel.trim().toUpperCase(),
          anioConstruccion: p.anioConstruccion ?? null,
          clasificacion: p.clasificacion,
          material: p.material,
          estadoConservacion: p.estadoConservacion,
          categorias: p.categorias,
          areaConstruida: p.areaConstruida,
        })),
      });
    }
    if (dto.otrasInstalaciones.length) {
      await tx.otraInstalacion.createMany({
        data: dto.otrasInstalaciones.map((o) => ({
          predioId,
          descripcion: o.descripcion.trim().toUpperCase(),
          unidad: o.unidad?.trim().toUpperCase() || null,
          cantidad: o.cantidad ?? null,
          valor: o.valor ?? null,
        })),
      });
    }
  }

  // Los condóminos enviados quedan ACTIVOS con su %; los que salen pasan a BAJA con la fecha del hecho
  // (historial intacto: "personas asociadas" por año). La condición (R05) se asigna sola salvo que
  // alguien haya elegido otra (poseedor, sociedad conyugal…).
  private async sincronizarCondominos(tx: Tx, predioId: number, dto: DeclaracionDto, fechaHecho: string, personas: Map<number, TipoPersona>) {
    const ids = dto.condominos.map((c) => c.contribuyenteId);
    await tx.predioContribuyente.updateMany({
      where: { predioId, estado: EstadoRegistro.ACTIVO, contribuyenteId: { notIn: ids } },
      data: { estado: EstadoRegistro.BAJA, esPrincipal: false, fechaFin: new Date(fechaHecho) },
    });
    const previos = new Map(
      (await tx.predioContribuyente.findMany({ where: { predioId, contribuyenteId: { in: ids } }, select: { contribuyenteId: true, condicion: true, estado: true } })).map(
        (r) => [r.contribuyenteId, r],
      ),
    );
    for (const [i, c] of dto.condominos.entries()) {
      const automatica = condicionPorDefecto(ids.length, personas.get(c.contribuyenteId) === TipoPersona.SUCESION);
      const previo = previos.get(c.contribuyenteId);
      const condicion = previo?.condicion && !CONDICIONES_AUTOMATICAS.includes(previo.condicion) ? previo.condicion : automatica;
      // Quien vuelve a ser titular empieza de nuevo: la fila es una por persona y predio.
      const vuelve = previo && previo.estado !== EstadoRegistro.ACTIVO;
      await tx.predioContribuyente.upsert({
        where: { contribuyenteId_predioId: { contribuyenteId: c.contribuyenteId, predioId } },
        update: {
          porcentaje: c.porcentaje,
          esPrincipal: i === 0,
          estado: EstadoRegistro.ACTIVO,
          condicion,
          ...(vuelve ? { fechaAdquisicion: new Date(fechaHecho), fechaFin: null } : {}),
        },
        create: {
          contribuyenteId: c.contribuyenteId,
          predioId,
          porcentaje: c.porcentaje,
          esPrincipal: i === 0,
          fechaAdquisicion: new Date(fechaHecho),
          condicion,
        },
      });
    }
  }

  private async asegurarContribuyentes(tx: Tx, ids: number[]) {
    const unicos = [...new Set(ids)];
    const encontrados = await tx.contribuyente.findMany({
      where: { id: { in: unicos }, estado: { not: EstadoPersona.INHABILITADO } },
      select: { id: true, tipoPersona: true },
    });
    if (encontrados.length !== unicos.length) {
      throw new BadRequestException('Algún contribuyente no existe o está inhabilitado: habilítalo antes de declarar');
    }
    return new Map(encontrados.map((c) => [c.id, c.tipoPersona]));
  }
}
