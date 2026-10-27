import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AsignarValoresDto } from './dto/asignar-valores.dto.js';
import {
  getMemorandumsActivos,
  getAuxiliaresActivos,
  getValoresByMemorandum,
  asignarValores,
  AsignarValoresResultado,
} from './asignar-valores.logic.js';

@Injectable()
export class AsignarValoresService {
  constructor(private prisma: PrismaService) {}

  async getMemorandums() {
    return getMemorandumsActivos(this.prisma);
  }

  async getAuxiliares() {
    return getAuxiliaresActivos(this.prisma);
  }

  async getValoresByMemorandum(memorandumId: number) {
    return getValoresByMemorandum(this.prisma, memorandumId);
  }

  async asignarValores(dto: AsignarValoresDto, usuarioId: number): Promise<AsignarValoresResultado> {
    return asignarValores(
      {
        valorIds: dto.valorIds,
        auxiliarId: dto.auxiliarId,
        usuarioId,
      },
      this.prisma
    );
  }
}
