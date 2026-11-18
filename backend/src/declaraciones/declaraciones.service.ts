import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoDj, EstadoPersona, EstadoRegistro, GrupoCatalogo, Prisma, TipoPersona, TipoPredio } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { normalizarDocumento } from '../contribuyentes/documento.js';
import { asegurarCodigoCatastroUnico } from '../predios/predios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DeterminacionService } from '../rentas/calculo/determinacion.service.js';
import type { Tributo } from '../rentas/calculo/reliquidacion.reglas.js';
import { MultasService } from '../rentas/fiscalizacion/multas.service.js';
import { reservarCorrelativos } from '../rentas/correlativos.js';
import { iso } from '../rentas/estado-cuenta/tasas.js';
import { hoyLima } from '../rentas/fechas.js';
import {
  CREAN_PREDIO,
  DESCARGOS,
  MOTIVO,
  anioAfectacionPorDefecto,
  errorAnexo,
  errorAnular,
  errorCabecera,
  errorEditar,
  errorInscripcionRepetida,
  errorPorcentajes,
  errorReabrir,
  fechaArbitriosPorDefecto,
  indicePredominante,
  numeroDj,
} from './dj.reglas.js';
import { AnexoDjDto, AnularDjDto, BuscarDjDto, DeclaracionDjDto, LiquidarDjDto, MultaDjDto, RevisionDjDto } from './dto/declaracion.dto.js';

type Tx = Prisma.TransactionClient;

// Una DJ con varios anexos hace muchas consultas seguidas (como la DJ de v1).
const OPCIONES_TX = { maxWait: 10_000, timeout: 30_000 };
const ROLES_SUPERVISION = ['SUPERVISOR', 'ADMIN'];
// Estados que ya no cuentan: no reservan la inscripción (J06) ni suman % (R04).
const SIN_EFECTO: EstadoDj[] = [EstadoDj.ANULADA, EstadoDj.RECHAZADA];

export interface Actor {
  id: number;
  rol: string;
}

const texto = (v?: string | null) => v?.trim().replace(/\s+/g, ' ').toUpperCase() || null;
const fecha = (v?: string | null) => (v ? v.slice(0, 10) : null);
const dia = (v: string | null) => (v ? new Date(v) : null);

// Anexo validado y listo para escribir.
interface AnexoListo {
  predioId: number | null;
  predioNuevo: { tipo: TipoPredio; direccionId: number; codigoCatastro: string | null; nombre: string | null } | null;
  conservaNuevo: boolean;
  datos: Omit<Prisma.DjAnexoUncheckedCreateInput, 'djId' | 'predioId' | 'numero'>;
}

@Injectable()
export class DeclaracionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogos: CatalogosService,
    private readonly determinacion: DeterminacionService,
    private readonly multas: MultasService,
  ) {}

  async buscar(dto: BuscarDjDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const where: Prisma.DjPresentadaWhereInput = {
      ...(dto.contribuyenteId ? { contribuyenteId: dto.contribuyenteId } : {}),
      ...(dto.predioId ? { anexos: { some: { predioId: dto.predioId } } } : {}),
      ...(dto.anio ? { anio: dto.anio } : {}),
      ...(dto.estado ? { estado: dto.estado } : {}),
    };
    const q = dto.q?.trim() ?? '';
    const porNumero = /^(\d{2})-?(\d{1,7})$/.exec(q);
    if (porNumero) {
      Object.assign(where, { anio: 2000 + Number(porNumero[1]), numero: Number(porNumero[2]) });
    } else if (q) {
      const doc = normalizarDocumento(q);
      where.contribuyente = {
        OR: [{ nombreCompleto: { contains: q, mode: 'insensitive' } }, { documentos: { some: { numDoc: { startsWith: doc } } } }],
      };
    }
    // Solo lectura: Promise.all (la forma batch de $transaction está bloqueada por auditoría).
    const [filas, total] = await Promise.all([
      this.prisma.djPresentada.findMany({
        where,
        select: {
          id: true,
          anio: true,
          numero: true,
          motivo: true,
          subMotivo: true,
          tipo: true,
          estado: true,
          fechaPresentacion: true,
          contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
          _count: { select: { anexos: true } },
        },
        orderBy: [{ fechaPresentacion: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.djPresentada.count({ where }),
    ]);
    const items = filas.map((d) => ({ ...d, numeroTexto: numeroDj(d.anio, d.numero), fechaPresentacion: iso(d.fechaPresentacion) }));
    return { items, total, page, pageSize };
  }

  async findOne(id: number) {
    const d = await this.prisma.djPresentada.findUnique({
      where: { id },
      include: {
        contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true, estado: true } },
        documentos: { orderBy: { orden: 'asc' } },
        anexos: {
          orderBy: { numero: 'asc' },
          include: {
            predio: {
              select: { id: true, nombre: true, tipo: true, codigoCatastro: true, estado: true, direccion: { select: { id: true, direccion: true } } },
            },
            niveles: { orderBy: { orden: 'asc' } },
            obras: { orderBy: { orden: 'asc' } },
            usos: { orderBy: { orden: 'asc' } },
            rusticos: { orderBy: { orden: 'asc' } },
            adquirientes: { orderBy: { orden: 'asc' }, include: { persona: { select: { id: true, nombreCompleto: true } } } },
          },
        },
        djPrevio: { select: { id: true, anio: true, numero: true } },
        rectificadaPor: { select: { id: true, anio: true, numero: true, estado: true } },
        creadoPor: { select: { usuario: true, nombres: true, apellidos: true } },
        anuladaPor: { select: { usuario: true, nombres: true, apellidos: true } },
        revisionResueltaPor: { select: { usuario: true, nombres: true, apellidos: true } },
        liquidadaPor: { select: { usuario: true, nombres: true, apellidos: true } },
        multas: { where: { estado: { not: 'ANULADO' } }, select: { id: true, anio: true, numero: true, estado: true } },
      },
    });
    if (!d) throw new NotFoundException('La declaración no existe');
    const { aplicado: _a, ...dj } = d;
    return {
      ...dj,
      // J08: plazo de presentación y si corresponde proponer la multa 176.1.
      plazo: await this.multas.plazoDjPresentada(this.prisma, id),
      numeroTexto: numeroDj(d.anio, d.numero),
      djPrevio: d.djPrevio ? { ...d.djPrevio, numeroTexto: numeroDj(d.djPrevio.anio, d.djPrevio.numero) } : null,
      rectificadaPor: d.rectificadaPor.map((r) => ({ ...r, numeroTexto: numeroDj(r.anio, r.numero) })),
    };
  }

  // Registro (J01–J03, J06, J07): la DJ queda PENDIENTE; determinar y liquidar es la Fase 5.
  async registrar(dto: DeclaracionDjDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      const { persona, tipo } = await this.prepararCabecera(tx, dto, null);
      const anexos = await this.prepararAnexos(tx, dto, null);
      const anio = Number(dto.fechaPresentacion.slice(0, 4));
      const [numero] = await reservarCorrelativos(tx, 'DJ', anio);
      const dj = await tx.djPresentada.create({
        data: {
          anio,
          numero: Number(numero),
          contribuyenteId: dto.contribuyenteId,
          motivo: dto.motivo,
          subMotivo: dto.subMotivo || null,
          tipo,
          numeroFormulario: texto(dto.numeroFormulario),
          folios: dto.folios ?? null,
          fechaPresentacion: new Date(dto.fechaPresentacion.slice(0, 10)),
          persona,
          djPrevioId: dto.djPrevioId ?? null,
          observacion: dto.observacion?.trim() || null,
          documentos: { create: this.documentos(dto) },
        },
        select: { id: true },
      });
      await this.escribirAnexos(tx, dj.id, anexos);
      return dj.id;
    }, OPCIONES_TX);
    return this.findOne(id);
  }

  // Mientras está PENDIENTE se corrige completa (cabecera, documentos y anexos). La copia de la
  // persona (J03) y el número no cambian.
  async actualizar(id: number, dto: DeclaracionDjDto) {
    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.djPresentada.findUnique({
        where: { id },
        select: { estado: true, contribuyenteId: true, anexos: { select: { id: true, predioId: true, predioNuevo: true } } },
      });
      if (!actual) throw new NotFoundException('La declaración no existe');
      const e = errorEditar(actual.estado);
      if (e) throw new ConflictException(e);
      if (actual.contribuyenteId !== dto.contribuyenteId) throw new BadRequestException('El contribuyente de una DJ no cambia: anúlala y registra otra');
      const { tipo } = await this.prepararCabecera(tx, dto, id);
      const creados = new Set(actual.anexos.filter((a) => a.predioNuevo).map((a) => a.predioId));
      const anexos = await this.prepararAnexos(tx, dto, id, creados);
      const ids = actual.anexos.map((a) => a.id);
      for (const tabla of ['djNivel', 'djObra', 'djUso', 'djArancelRustico', 'djAdquiriente'] as const) {
        await (tx[tabla] as unknown as { deleteMany: (a: object) => Promise<unknown> }).deleteMany({ where: { anexoId: { in: ids } } });
      }
      await tx.djAnexo.deleteMany({ where: { djId: id } });
      await tx.djDocumento.deleteMany({ where: { djId: id } });
      await tx.djPresentada.update({
        where: { id },
        data: {
          motivo: dto.motivo,
          subMotivo: dto.subMotivo || null,
          tipo,
          numeroFormulario: texto(dto.numeroFormulario),
          folios: dto.folios ?? null,
          fechaPresentacion: new Date(dto.fechaPresentacion.slice(0, 10)),
          djPrevioId: dto.djPrevioId ?? null,
          observacion: dto.observacion?.trim() || null,
          documentos: { create: this.documentos(dto) },
          // Lo declarado cambió: lo determinado y la revisión (J14) se vuelven a hacer.
          revisionVence: null,
          revisionResueltaPorId: null,
          revisionResueltaAt: null,
          revisionJustificacion: null,
        },
      });
      await this.determinacion.descartar(tx, id);
      await this.escribirAnexos(tx, id, anexos);
    }, OPCIONES_TX);
    return this.findOne(id);
  }

  // J04: una DJ no se borra; se anula con motivo, usuario y fecha. Sin cuenta generada, los predios que
  // creó quedan INACTIVOS; si ya generó cuenta (liquidada, o reabierta), la extorna y devuelve el padrón.
  async anular(id: number, dto: AnularDjDto, actor: Actor) {
    const d = await this.prisma.djPresentada.findUnique({ where: { id }, select: { estado: true, liquidadaAt: true, motivo: true } });
    if (!d) throw new NotFoundException('La declaración no existe');
    const e = errorAnular(d.estado);
    if (e) throw new ConflictException(e);
    // Fase 6: la DJ que deja una fiscalización no se anula aquí; su resultado se corrige con un reclamo contra la RD.
    if (d.motivo === MOTIVO.FISCALIZACION) throw new ConflictException('La DJ de una fiscalización no se anula: su resultado se corrige con un reclamo contra la RD de fiscalización');
    const motivo = dto.motivo.trim();
    if (motivo.length < 10) throw new BadRequestException('Explica por qué se anula (mínimo 10 caracteres)');
    await this.prisma.$transaction(async (tx) => {
      if (d.liquidadaAt) return this.determinacion.anularLiquidada(tx, id, motivo, actor);
      await this.determinacion.descartar(tx, id);
      await tx.djPresentada.update({
        where: { id },
        data: { estado: EstadoDj.ANULADA, anuladaMotivo: motivo, anuladaPorId: actor.id, anuladaAt: new Date() },
      });
    }, OPCIONES_TX);
    return this.findOne(id);
  }

  // ---- Fase 5: determinar (C6), liquidar (C7), revisión (J14) y multa (J08) ----

  async determinar(id: number) {
    const determinaciones = await this.determinacion.determinar(id);
    return { dj: await this.findOne(id), determinaciones };
  }

  determinaciones(id: number) {
    return this.determinacion.verDj(id);
  }

  determinacionesContribuyente(contribuyenteId: number) {
    return this.determinacion.porContribuyente(contribuyenteId);
  }

  previaLiquidacion(id: number, dto: LiquidarDjDto) {
    return this.determinacion.previa(id, dto.anios, dto.tributos as Tributo[] | undefined);
  }

  async liquidar(id: number, dto: LiquidarDjDto, actor: Actor) {
    const r = await this.determinacion.liquidar(id, dto.anios, dto.tributos as Tributo[] | undefined, actor);
    return { ...r, dj: await this.findOne(id), determinaciones: r.dj };
  }

  async revision(id: number, dto: RevisionDjDto, actor: Actor) {
    const determinaciones = await this.determinacion.resolverRevision(id, dto.accion, dto.justificacion, actor);
    return { dj: await this.findOne(id), determinaciones };
  }

  async multa(id: number, dto: MultaDjDto) {
    await this.multas.decidirDjPresentada(id, dto.accion, dto.motivo);
    return this.findOne(id);
  }

  // J04/J05: de LIQUIDADA a PENDIENTE, solo para los motivos de la regla dj.motivosReabribles.
  async reabrir(id: number, actor: Actor) {
    if (!ROLES_SUPERVISION.includes(actor.rol)) throw new ForbiddenException('Solo un supervisor puede reabrir una DJ');
    const d = await this.prisma.djPresentada.findUnique({ where: { id }, select: { estado: true, motivo: true } });
    if (!d) throw new NotFoundException('La declaración no existe');
    const reabribles = await this.catalogos.valorRegla<string[]>('dj.motivosReabribles');
    const e = errorReabrir(d.estado, d.motivo, reabribles);
    if (e) throw new ConflictException(e);
    await this.prisma.djPresentada.update({ where: { id }, data: { estado: EstadoDj.PENDIENTE } });
    return this.findOne(id);
  }

  // ---- Preparación: valida todo antes de escribir ----

  private async prepararCabecera(tx: Tx, dto: DeclaracionDjDto, propioId: number | null) {
    const persona = await tx.contribuyente.findUnique({
      where: { id: dto.contribuyenteId },
      select: {
        id: true,
        tipoPersona: true,
        tipoDoc: true,
        numDoc: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        nombres: true,
        razonSocial: true,
        nombreCompleto: true,
        estado: true,
        ubigeo: true,
        direccionId: true,
        direccionFiscal: true,
        domicilioTexto: true,
        documentos: { orderBy: { orden: 'asc' }, select: { tipoDoc: true, numDoc: true } },
        contactos: { orderBy: { orden: 'asc' }, select: { tipo: true, valor: true } },
        relacionados: { where: { vigente: true }, orderBy: { orden: 'asc' }, select: { tipo: true, tipoDoc: true, numDoc: true, nombreCompleto: true, direccion: true } },
      },
    });
    if (!persona) throw new BadRequestException('El contribuyente no existe');
    if (persona.estado === EstadoPersona.INHABILITADO) {
      throw new ConflictException('La persona está inhabilitada: habilítala antes de registrar su DJ');
    }
    const eCab = errorCabecera(dto, hoyLima());
    if (eCab) throw new BadRequestException(eCab);

    const motivo = (await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.MOTIVO_DJ, [dto.motivo], 'Motivo de DJ')).get(dto.motivo)!;
    const tipo = (motivo.atributos as { tipo?: string } | null)?.tipo ?? 'DECLARATIVA';
    await this.asegurarSubMotivos(tx, dto.motivo, [dto.subMotivo, ...dto.anexos.map((a) => a.subMotivo)]);

    // J06: una sola inscripción por persona.
    if (dto.motivo === MOTIVO.INSCRIPCION) {
      const otras = await tx.djPresentada.findMany({
        where: { contribuyenteId: dto.contribuyenteId, motivo: MOTIVO.INSCRIPCION, estado: { notIn: SIN_EFECTO }, ...(propioId ? { NOT: { id: propioId } } : {}) },
        select: { anio: true, numero: true },
      });
      const e = errorInscripcionRepetida(dto.motivo, otras.map((o) => numeroDj(o.anio, o.numero)));
      if (e) throw new ConflictException(e);
    }
    if (dto.djPrevioId) {
      const previo = await tx.djPresentada.findUnique({ where: { id: dto.djPrevioId }, select: { contribuyenteId: true, estado: true } });
      if (!previo || previo.contribuyenteId !== dto.contribuyenteId) throw new BadRequestException('La DJ que se rectifica no es de esta persona');
      if (SIN_EFECTO.includes(previo.estado)) throw new BadRequestException('No se rectifica una DJ anulada o rechazada');
      if (dto.djPrevioId === propioId) throw new BadRequestException('Una DJ no se rectifica a sí misma');
    }
    await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.TIPO_DOC_ADJUNTO, dto.documentos.map((d) => d.tipo), 'Tipo de documento adjunto');

    // J03: copia de la persona al presentar.
    const { estado: _e, ...copia } = persona;
    return { persona: copia as unknown as Prisma.InputJsonValue, tipo };
  }

  private async asegurarSubMotivos(tx: Tx, motivo: string, codigos: (string | null | undefined)[]) {
    const pedidos = [...new Set(codigos.filter((c): c is string => Boolean(c)))];
    const items = await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.SUB_MOTIVO_DJ, pedidos, 'Sub-motivo');
    const ajeno = [...items.values()].find((i) => i.padre?.codigo !== motivo);
    if (ajeno) throw new BadRequestException(`El sub-motivo "${ajeno.nombre}" no corresponde al motivo elegido`);
  }

  // `creados`: predios que esta misma DJ creó antes (al editar se pueden seguir declarando).
  private async prepararAnexos(tx: Tx, dto: DeclaracionDjDto, djId: number | null, creados = new Set<number>()): Promise<AnexoListo[]> {
    const hoy = hoyLima();
    const anioActual = Number(hoy.slice(0, 4));
    const inicioArbitrios = await this.catalogos.valorRegla<'MES_DEL_HECHO' | 'MES_SIGUIENTE'>('arbitrios.inicioAfectacion', tx);
    const fechaPresentacion = dto.fechaPresentacion.slice(0, 10);
    const descargo = DESCARGOS.includes(dto.motivo);

    // Catálogos de todo el formulario en una pasada.
    const usos = dto.anexos.flatMap((a) => a.usos);
    await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.CONDICION_PROPIEDAD, dto.anexos.map((a) => a.condicion), 'Condición de propiedad');
    await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.USO_PREDIO, usos.map((u) => u.uso), 'Uso del predio');
    const subUsos = await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.SUB_USO_PREDIO, usos.map((u) => u.subUso ?? ''), 'Sub-uso del predio');
    const malSubUso = usos.find((u) => u.subUso && subUsos.get(u.subUso)?.padre?.codigo !== u.uso);
    if (malSubUso) throw new BadRequestException(`El sub-uso ${malSubUso.subUso} no corresponde al uso ${malSubUso.uso}`);
    const adquirientes = dto.anexos.flatMap((a) => a.adquirientes);
    await this.catalogos.asegurarCodigos(tx, GrupoCatalogo.TIPO_DOCUMENTO, adquirientes.map((x) => x.tipoDoc ?? ''), 'Tipo de documento del adquiriente');
    await this.catalogos.asegurarCodigos(
      tx,
      GrupoCatalogo.TIPO_DOC_TRANSFERENCIA,
      adquirientes.map((x) => x.documentoTransferencia ?? ''),
      'Documento de transferencia',
    );

    const vistos = new Set<number>();
    const listos: AnexoListo[] = [];
    for (const [i, a] of dto.anexos.entries()) {
      const prefijo = `Anexo ${i + 1}`;
      const { predio, nuevo } = await this.resolverPredio(tx, a, dto, prefijo, creados);
      if (predio) {
        if (vistos.has(predio.id)) throw new BadRequestException(`${prefijo}: el predio #${predio.id} ya está en otro anexo`);
        vistos.add(predio.id);
      }
      const rustico = (predio?.tipo ?? nuevo?.tipo) === TipoPredio.RUSTICO;
      const fechaAdquisicion = fecha(a.fechaAdquisicion);
      const fechaDescargo = fecha(a.fechaDescargo);
      const hecho = fechaAdquisicion ?? fechaDescargo ?? fecha(a.fechaDocumento);
      const anioAfectacion = a.anioAfectacion ?? anioAfectacionPorDefecto(hecho, fechaPresentacion);
      const fechaArbitrios = fecha(a.fechaAfectacionArbitrios) ?? fechaArbitriosPorDefecto(hecho ?? fechaPresentacion, inicioArbitrios);
      const e = errorAnexo(
        {
          ...a,
          fechaAdquisicion,
          fechaDocumento: fecha(a.fechaDocumento),
          fechaDescargo,
          anioAfectacion,
          usos: a.usos.map((u) => ({ ...u, fechaInicio: fecha(u.fechaInicio), fechaFin: fecha(u.fechaFin) })),
        },
        { motivo: dto.motivo, fechaPresentacion, rustico, anioActual },
        prefijo,
      );
      if (e) throw new BadRequestException(e);

      const personasAdq = await this.enlazarAdquirientes(tx, a);
      // R04: la suma de lo que declara cada condómino en su propia DJ no pasa de 100. Quien sale
      // (descargo) no suma, y en una adquisición no cuentan los transferentes de este anexo.
      if (predio && !descargo) {
        const transferentes = new Set(personasAdq.filter((x) => x.rol === 'TRANSFERENTE' && x.personaId).map((x) => x.personaId));
        const otros = await this.porcentajesDeOtros(tx, predio.id, dto.contribuyenteId, djId);
        const e2 = errorPorcentajes(`${prefijo} (predio #${predio.id})`, a.porcentaje, otros.filter((o) => !transferentes.has(o.contribuyenteId)));
        if (e2) throw new BadRequestException(e2);
      }

      const predominante = indicePredominante(a.usos);
      listos.push({
        predioId: predio?.id ?? null,
        predioNuevo: nuevo,
        conservaNuevo: Boolean(predio && creados.has(predio.id)),
        datos: {
          subMotivo: a.subMotivo || null,
          condicion: a.condicion,
          porcentaje: a.porcentaje,
          fechaAdquisicion: dia(fechaAdquisicion),
          fechaDocumento: dia(fecha(a.fechaDocumento)),
          fechaDescargo: dia(fechaDescargo),
          anioAfectacion,
          fechaAfectacionArbitrios: new Date(fechaArbitrios),
          valorTransferencia: a.valorTransferencia ?? null,
          moneda: a.moneda || null,
          partidaRegistral: texto(a.partidaRegistral),
          areaTerreno: a.areaTerreno,
          areaComun: a.areaComun ?? null,
          numeroPisos: a.numeroPisos ?? null,
          observacion: a.observacion?.trim() || null,
          niveles: {
            create: a.niveles.map((n, j) => ({
              orden: j + 1,
              nivel: n.nivel.trim().toUpperCase(),
              anioConstruccion: n.anioConstruccion ?? null,
              mesConstruccion: n.mesConstruccion ?? null,
              clasificacion: n.clasificacion,
              material: n.material,
              estadoConservacion: n.estadoConservacion,
              categorias: n.categorias,
              areaPropia: n.areaPropia,
              areaComun: n.areaComun ?? null,
              participacion: n.participacion ?? null,
            })),
          },
          obras: {
            create: a.obras.map((o, j) => ({
              orden: j + 1,
              descripcion: texto(o.descripcion)!,
              unidad: texto(o.unidad),
              cantidad: o.cantidad,
              largo: o.largo ?? null,
              ancho: o.ancho ?? null,
              alto: o.alto ?? null,
              anioConstruccion: o.anioConstruccion ?? null,
              material: o.material || null,
              estadoConservacion: o.estadoConservacion || null,
              valorDeclarado: o.valorDeclarado ?? null,
            })),
          },
          usos: {
            create: a.usos.map((u, j) => ({
              orden: j + 1,
              uso: u.uso,
              subUso: u.subUso || null,
              inquilino: texto(u.inquilino),
              area: u.area,
              frontis: u.frontis ?? null,
              participacion: u.participacion ?? null,
              fechaInicio: dia(fecha(u.fechaInicio)),
              fechaFin: dia(fecha(u.fechaFin)),
              predominante: j === predominante,
            })),
          },
          rusticos: {
            create: a.rusticos.map((r, j) => ({ orden: j + 1, categoria: texto(r.categoria)!, clasificacion: texto(r.clasificacion), hectareas: r.hectareas })),
          },
          adquirientes: { create: personasAdq.map((x, j) => ({ orden: j + 1, ...x })) },
        },
      });
    }
    return listos;
  }

  private async resolverPredio(tx: Tx, a: AnexoDjDto, dto: DeclaracionDjDto, prefijo: string, creados: Set<number>) {
    if (Boolean(a.predioId) === Boolean(a.predioNuevo)) throw new BadRequestException(`${prefijo}: elige un predio del padrón o registra uno nuevo`);
    if (a.predioNuevo) {
      if (!CREAN_PREDIO.includes(dto.motivo)) throw new BadRequestException(`${prefijo}: solo una inscripción o una adquisición registran un predio nuevo`);
      const dir = await tx.direccion.findUnique({ where: { id: a.predioNuevo.direccionId }, select: { activo: true } });
      if (!dir) throw new BadRequestException(`${prefijo}: la dirección elegida no existe`);
      if (!dir.activo) throw new BadRequestException(`${prefijo}: la dirección elegida está dada de baja`);
      const codigoCatastro = texto(a.predioNuevo.codigoCatastro);
      await asegurarCodigoCatastroUnico(tx, codigoCatastro, null);
      return {
        predio: null,
        nuevo: { tipo: a.predioNuevo.tipo ?? TipoPredio.URBANO, direccionId: a.predioNuevo.direccionId, codigoCatastro, nombre: texto(a.predioNuevo.nombre) },
      };
    }
    const predio = await tx.predio.findUnique({ where: { id: a.predioId! }, select: { id: true, tipo: true, estado: true } });
    if (!predio) throw new BadRequestException(`${prefijo}: el predio #${a.predioId} no existe`);
    if (predio.estado === EstadoRegistro.BAJA) throw new ConflictException(`${prefijo}: el predio #${predio.id} está dado de baja`);
    if (predio.estado === EstadoRegistro.INACTIVO && !creados.has(predio.id)) {
      throw new ConflictException(`${prefijo}: el predio #${predio.id} está inactivo (lo registró otra DJ aún sin liquidar)`);
    }
    // Un descargo lo hace quien es (o declaró ser) titular.
    if (DESCARGOS.includes(dto.motivo)) {
      const [titular, declarado] = await Promise.all([
        tx.predioContribuyente.count({ where: { predioId: predio.id, contribuyenteId: dto.contribuyenteId, estado: EstadoRegistro.ACTIVO } }),
        tx.djAnexo.count({
          where: { predioId: predio.id, fechaDescargo: null, dj: { contribuyenteId: dto.contribuyenteId, estado: { notIn: SIN_EFECTO } } },
        }),
      ]);
      if (!titular && !declarado) throw new BadRequestException(`${prefijo}: la persona no es titular del predio #${predio.id}, no puede descargarlo`);
    }
    return { predio, nuevo: null };
  }

  // Lo último que declaró cada otro contribuyente sobre el predio, si no lo descargó.
  private async porcentajesDeOtros(tx: Tx, predioId: number, contribuyenteId: number, djId: number | null) {
    const filas = await tx.djAnexo.findMany({
      where: {
        predioId,
        dj: { contribuyenteId: { not: contribuyenteId }, estado: { notIn: SIN_EFECTO }, ...(djId ? { NOT: { id: djId } } : {}) },
      },
      select: { porcentaje: true, fechaDescargo: true, dj: { select: { contribuyenteId: true, contribuyente: { select: { nombreCompleto: true } } } } },
      orderBy: [{ dj: { fechaPresentacion: 'desc' } }, { dj: { id: 'desc' } }],
    });
    const ultimo = new Map<number, (typeof filas)[number]>();
    for (const f of filas) if (!ultimo.has(f.dj.contribuyenteId)) ultimo.set(f.dj.contribuyenteId, f);
    return [...ultimo.values()]
      .filter((f) => !f.fechaDescargo)
      .map((f) => ({ contribuyenteId: f.dj.contribuyenteId, nombre: f.dj.contribuyente.nombreCompleto, porcentaje: Number(f.porcentaje) }));
  }

  // Como P10: si el documento es de una persona registrada, se enlaza.
  private async enlazarAdquirientes(tx: Tx, a: AnexoDjDto) {
    const lista = [];
    for (const x of a.adquirientes) {
      const tipoDoc = x.tipoDoc || null;
      const numDoc = x.numDoc ? normalizarDocumento(x.numDoc) || null : null;
      const doc =
        tipoDoc && numDoc ? await tx.contribuyenteDocumento.findUnique({ where: { tipoDoc_numDoc: { tipoDoc, numDoc } }, select: { contribuyenteId: true } }) : null;
      lista.push({
        rol: x.rol,
        tipoPersona: x.tipoPersona ?? TipoPersona.NATURAL,
        tipoDoc,
        numDoc,
        nombreCompleto: texto(x.nombreCompleto)!,
        direccion: texto(x.direccion),
        documentoTransferencia: x.documentoTransferencia || null,
        personaId: doc?.contribuyenteId ?? null,
      });
    }
    return lista;
  }

  private documentos(dto: DeclaracionDjDto) {
    return dto.documentos.map((d, i) => ({
      orden: i + 1,
      tipo: d.tipo,
      numero: texto(d.numero),
      fecha: dia(fecha(d.fecha)),
      observacion: d.observacion?.trim() || null,
    }));
  }

  // Escribe los anexos. Un predio nuevo nace INACTIVO, sin titulares, con la copia de su dirección
  // (como el maestro de la Fase 3): la liquidación (Fase 5) lo activa.
  private async escribirAnexos(tx: Tx, djId: number, anexos: AnexoListo[]) {
    for (const [i, a] of anexos.entries()) {
      let predioId = a.predioId;
      if (a.predioNuevo) predioId = await this.crearPredio(tx, a.predioNuevo, a.datos);
      await tx.djAnexo.create({
        data: { ...a.datos, djId, numero: i + 1, predioId: predioId!, predioNuevo: Boolean(a.predioNuevo) || a.conservaNuevo } as Prisma.DjAnexoUncheckedCreateInput,
      });
    }
  }

  private async crearPredio(tx: Tx, p: NonNullable<AnexoListo['predioNuevo']>, datos: AnexoListo['datos']) {
    const dir = await tx.direccion.findUniqueOrThrow({ where: { id: p.direccionId }, include: { componentes: true } });
    const comp = (c: string) => dir.componentes.find((x) => x.componente === c)?.valor.slice(0, 10) ?? null;
    const usos = (datos.usos as { create: { uso: string; predominante: boolean }[] }).create;
    const creado = await tx.predio.create({
      data: {
        tipo: p.tipo,
        nombre: p.nombre,
        codigoCatastro: p.codigoCatastro,
        direccionId: dir.id,
        zonaId: dir.zonaId,
        urbanizacionId: dir.urbanizacionId,
        viaId: dir.viaId,
        numero: comp('NUMERO'),
        manzana: comp('MZ'),
        lote: comp('LT'),
        referencia: dir.referencia?.slice(0, 150) ?? null,
        areaTerreno: datos.areaTerreno as number,
        usoPredio: usos.find((u) => u.predominante)?.uso ?? null,
        estado: EstadoRegistro.INACTIVO,
      },
      select: { id: true },
    });
    return creado.id;
  }
}
