import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsuario(usuario: string) {
    return this.prisma.usuario.findUnique({ where: { usuario } });
  }

  findById(id: number) {
    return this.prisma.usuario.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.usuario.findMany({
      select: {
        id: true,
        usuario: true,
        nombre: true,
        rol: true,
        activo: true,
        oficina: { select: { id: true, codigo: true, nombre: true } },
      },
      orderBy: { usuario: 'asc' },
    });
  }
}
