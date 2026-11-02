import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FiltroValoresDto, TransferenciaIndividualDto, TransferenciaMasivaDto } from './dto/recepcion-transferencia.dto.js';
import {
  getValoresTransferibles,
  getValorDetalle,
  transferirValor,
  transferirMasivo,
  getEjecutoresActivos,
  getAuxiliaresActivos,
  getTiposGestionActivos,
  TransferenciaResultado,
} from './transferencia.logic.js';

@Injectable()
export class RecepcionTransferenciaService {
  constructor(private prisma: PrismaService) {}

  async getMemorandums() {
    return this.prisma.memorandums_coactiva.findMany({
      where: { activo: true },
      orderBy: [{ anio: 'desc' }, { numero: 'asc' }],
    });
  }

  async getValores(filtros: FiltroValoresDto) {
    return getValoresTransferibles(this.prisma, {
      anio: filtros.anio,
      tipo: filtros.tipo,
      contribuyente: filtros.contribuyente,
      estado: filtros.estado,
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      memorandumId: filtros.memorandumId,
      page: filtros.page ?? 1,
      limit: filtros.limit ?? 20,
    });
  }

  async getValor(id: number) {
    const valor = await getValorDetalle(this.prisma, id);
    if (!valor) {
      return null;
    }
    return valor;
  }

  async transferirIndividual(id: number, dto: TransferenciaIndividualDto, usuarioId: number): Promise<TransferenciaResultado> {
    return transferirValor(
      {
        valorId: id,
        ejecutorId: dto.ejecutorId,
        auxiliarId: dto.auxiliarId,
        tipoGestionId: dto.tipoGestionId,
        usuarioId,
      },
      this.prisma
    );
  }

  async transferirMasivo(dto: TransferenciaMasivaDto, usuarioId: number) {
    return transferirMasivo(
      {
        valorIds: dto.valorIds,
        ejecutorId: dto.ejecutorId,
        auxiliarId: dto.auxiliarId,
        tipoGestionId: dto.tipoGestionId,
        usuarioId,
      },
      this.prisma
    );
  }

  async getEjecutores() {
    return getEjecutoresActivos(this.prisma);
  }

  async getAuxiliares() {
    return getAuxiliaresActivos(this.prisma);
  }

  async getTiposGestion() {
    return getTiposGestionActivos(this.prisma);
  }
}