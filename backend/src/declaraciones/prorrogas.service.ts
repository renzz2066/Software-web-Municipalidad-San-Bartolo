import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoProrroga, GrupoCatalogo, Prisma } from '@prisma/client';
import { CatalogosService } from '../catalogos/catalogos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { iso } from '../rentas/estado-cuenta/tasas.js';
import { hoyLima } from '../rentas/fechas.js';
import type { Actor } from './declaraciones.service.js';
import { AnularDjDto, BuscarProrrogasDto, ProrrogaDjDto, ResolverProrrogaDto } from './dto/declaracion.dto.js';
import { ROLES_SUPERVISION, errorAnularProrroga, errorRegistrarProrroga, errorResolverProrroga } from './prorroga.reglas.js';

const SELECT = {
  id: true,
  contribuyente: { select: { id: true, tipoDoc: true, numDoc: true, nombreCompleto: true } },
  anio: true,
  motivo: true,
  fechaLimite: true,
  fechaSolicitud: true,
  sustento: true,
  estado: true,
  justificacion: true,
  resueltaAt: true,
  anuladaMotivo: true,
  anuladaAt: true,
  createdAt: true,
  creadoPor: { select: { usuario: true } },
  resueltaPor: { select: { usuario: true } },
  anuladaPor: { select: { usuario: true } },
} satisfies Prisma.ProrrogaDjSelect;

type Fila = Prisma.ProrrogaDjGetPayload<{ select: typeof SELECT }>;

// Prórrogas de presentación (specs/rentas-nucleo-v2.md, Fase 7; J16). Una aprobada mueve el
// vencimiento del plazo de la DJ (J08) y con él la propuesta de multa 176.1.
@Injectable()
export class ProrrogasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogos: CatalogosService,
  ) {}

  async buscar(dto: BuscarProrrogasDto) {
    const filas = await this.prisma.prorrogaDj.findMany({
      where: {
        ...(dto.anio ? { anio: dto.anio } : {}),
        ...(dto.contribuyenteId ? { OR: [{ contribuyenteId: dto.contribuyenteId }, { contribuyenteId: null }] } : {}),
      },
      select: SELECT,
      orderBy: [{ anio: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return filas.map((f) => this.serializar(f));
  }

  // General (sin persona): por ordenanza, nace APROBADA. Individual: SOLICITADA hasta que la resuelva otro supervisor.
  async registrar(dto: ProrrogaDjDto, actor: Actor) {
    const general = !dto.contribuyenteId;
    const fechaLimite = dto.fechaLimite.slice(0, 10);
    const fechaSolicitud = dto.fechaSolicitud.slice(0, 10);
    const permitido = await this.catalogos.valorRegla<boolean>('dj.prorrogaPresentacion');
    const e = errorRegistrarProrroga({ general, anio: dto.anio, fechaLimite, fechaSolicitud }, actor.rol, hoyLima(), permitido);
    if (e) throw general && !ROLES_SUPERVISION.includes(actor.rol) ? new ForbiddenException(e) : new BadRequestException(e);
    if (dto.motivo) await this.catalogos.asegurarCodigos(this.prisma, GrupoCatalogo.MOTIVO_DJ, [dto.motivo], 'Motivo de DJ');
    if (!general) {
      const persona = await this.prisma.contribuyente.findUnique({ where: { id: dto.contribuyenteId! }, select: { id: true } });
      if (!persona) throw new BadRequestException('El contribuyente no existe');
    }
    const fila = await this.prisma.prorrogaDj.create({
      data: {
        contribuyenteId: dto.contribuyenteId ?? null,
        anio: dto.anio,
        motivo: dto.motivo || null,
        fechaLimite: new Date(fechaLimite),
        fechaSolicitud: new Date(fechaSolicitud),
        sustento: dto.sustento.trim(),
        estado: general ? EstadoProrroga.APROBADA : EstadoProrroga.SOLICITADA,
        ...(general ? { resueltaPorId: actor.id, resueltaAt: new Date(), justificacion: 'Prórroga general por ordenanza' } : {}),
      },
      select: SELECT,
    });
    return this.serializar(fila);
  }

  async resolver(id: number, dto: ResolverProrrogaDto, actor: Actor) {
    const p = await this.prisma.prorrogaDj.findUnique({ where: { id }, select: { estado: true, creadoPorId: true } });
    if (!p) throw new NotFoundException('La prórroga no existe');
    const e = errorResolverProrroga(p, actor, dto.justificacion);
    if (e) throw ROLES_SUPERVISION.includes(actor.rol) ? new ConflictException(e) : new ForbiddenException(e);
    const { count } = await this.prisma.prorrogaDj.updateMany({
      where: { id, estado: EstadoProrroga.SOLICITADA },
      data: {
        estado: dto.accion === 'APROBAR' ? EstadoProrroga.APROBADA : EstadoProrroga.RECHAZADA,
        resueltaPorId: actor.id,
        resueltaAt: new Date(),
        justificacion: dto.justificacion.trim(),
      },
    });
    if (count === 0) throw new ConflictException('La prórroga cambió mientras se resolvía; recarga la página');
    return this.uno(id);
  }

  async anular(id: number, dto: AnularDjDto, actor: Actor) {
    const p = await this.prisma.prorrogaDj.findUnique({ where: { id }, select: { estado: true } });
    if (!p) throw new NotFoundException('La prórroga no existe');
    const e = errorAnularProrroga(p.estado, actor.rol, dto.motivo);
    if (e) throw ROLES_SUPERVISION.includes(actor.rol) ? new ConflictException(e) : new ForbiddenException(e);
    await this.prisma.prorrogaDj.update({
      where: { id },
      data: { estado: EstadoProrroga.ANULADA, anuladaPorId: actor.id, anuladaAt: new Date(), anuladaMotivo: dto.motivo.trim() },
    });
    return this.uno(id);
  }

  private async uno(id: number) {
    return this.serializar(await this.prisma.prorrogaDj.findUniqueOrThrow({ where: { id }, select: SELECT }));
  }

  private serializar(f: Fila) {
    return { ...f, fechaLimite: iso(f.fechaLimite), fechaSolicitud: iso(f.fechaSolicitud) };
  }
}
