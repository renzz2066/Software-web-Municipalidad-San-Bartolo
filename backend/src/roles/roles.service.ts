import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.rol.findMany({
      select: { id: true, nombre: true, descripcion: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
