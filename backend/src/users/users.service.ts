import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';

const usuarioPublico = {
  id: true,
  usuario: true,
  nombres: true,
  apellidos: true,
  rol: { select: { id: true, nombre: true } },
  activo: true,
  oficina: { select: { id: true, codigo: true, nombre: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsuario(usuario: string) {
    return this.prisma.usuario.findUnique({
      where: { usuario },
      include: { rol: true },
    });
  }

  findById(id: number) {
    return this.prisma.usuario.findUnique({
      where: { id },
      include: { rol: true },
    });
  }

  findAll() {
    return this.prisma.usuario.findMany({
      select: usuarioPublico,
      orderBy: { usuario: 'asc' },
    });
  }

  async create(dto: CreateUsuarioDto) {
    const usuario = dto.usuario.trim();

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const existente = await this.prisma.usuario.findUnique({ where: { usuario } });
    if (existente) {
      throw new ConflictException('El usuario ya existe');
    }

    const rol = await this.prisma.rol.findUnique({ where: { id: dto.rolId } });
    if (!rol) {
      throw new BadRequestException('El rol no existe');
    }

    const password = await bcrypt.hash(dto.password, 10);

    return this.prisma.usuario.create({
      data: {
        usuario,
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        password,
        rolId: dto.rolId,
        activo: dto.activo ?? true,
      },
      select: usuarioPublico,
    });
  }
}
