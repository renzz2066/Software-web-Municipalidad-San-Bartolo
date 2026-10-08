import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';

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

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: usuarioPublico,
    });
    if (!usuario) {
      throw new NotFoundException('El usuario no existe');
    }
    return usuario;
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

  async update(id: number, dto: UpdateUsuarioDto) {
    const existente = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException('El usuario no existe');
    }

    let usuario = existente.usuario;
    if (dto.usuario !== undefined && dto.usuario.trim() !== existente.usuario) {
      usuario = dto.usuario.trim();
      const duplicado = await this.prisma.usuario.findUnique({ where: { usuario } });
      if (duplicado) {
        throw new ConflictException('El usuario ya existe');
      }
    }

    let password: string | undefined;
    if (dto.password !== undefined && dto.password !== '') {
      if (dto.password !== dto.confirmPassword) {
        throw new BadRequestException('Las contraseñas no coinciden');
      }
      password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.rolId !== undefined) {
      const rol = await this.prisma.rol.findUnique({ where: { id: dto.rolId } });
      if (!rol) {
        throw new BadRequestException('El rol no existe');
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        usuario,
        nombres: dto.nombres !== undefined ? dto.nombres.trim() : undefined,
        apellidos: dto.apellidos !== undefined ? dto.apellidos.trim() : undefined,
        ...(password !== undefined ? { password } : {}),
        rolId: dto.rolId,
        activo: dto.activo,
      },
      select: usuarioPublico,
    });
  }

  async remove(id: number, solicitanteId: number) {
    if (id === solicitanteId) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }

    const existente = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException('El usuario no existe');
    }

    try {
      await this.prisma.usuario.delete({ where: { id } });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar: el usuario tiene registros asociados');
      }
      throw error;
    }
  }
}
