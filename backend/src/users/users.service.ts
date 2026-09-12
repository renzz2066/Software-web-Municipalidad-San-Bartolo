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
}
