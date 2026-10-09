import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRolDto } from './dto/create-rol.dto.js';
import { UpdateRolDto } from './dto/update-rol.dto.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.rol.findMany({
      select: { id: true, nombre: true, descripcion: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const rol = await this.prisma.rol.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        accesos: { select: { nivelId: true } },
      },
    });
    if (!rol) {
      throw new NotFoundException('El rol no existe');
    }
    return rol;
  }

  async create(dto: CreateRolDto) {
    const nombre = dto.nombre.trim();

    const existente = await this.prisma.rol.findUnique({ where: { nombre } });
    if (existente) {
      throw new ConflictException('El rol ya existe');
    }

    const nivelIds = await this.validarNiveles(dto.nivelIds);

    return this.prisma.$transaction(async (tx) => {
      const rol = await tx.rol.create({
        data: {
          nombre,
          descripcion: dto.descripcion?.trim() || null,
        },
      });
      await tx.rolNivel.createMany({
        data: nivelIds.map((nivelId) => ({ rolId: rol.id, nivelId })),
      });
      return tx.rol.findUniqueOrThrow({
        where: { id: rol.id },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          accesos: { select: { nivel: { select: { codigo: true } } } },
        },
      });
    });
  }

  private async validarNiveles(nivelIds: number[]) {
    const unicos = [...new Set(nivelIds)];
    if (unicos.length === 0) {
      throw new BadRequestException('Selecciona al menos un nivel');
    }
    const niveles = await this.prisma.nivel.findMany({
      where: { id: { in: unicos } },
      select: { id: true, padreId: true },
    });
    if (niveles.length !== unicos.length) {
      throw new BadRequestException('Algún nivel no existe');
    }
    // Regla jerárquica: un subnivel exige su módulo asignado
    const asignados = new Set(unicos);
    for (const nivel of niveles) {
      if (nivel.padreId !== null && !asignados.has(nivel.padreId)) {
        throw new BadRequestException('Un subnivel requiere su módulo asignado');
      }
    }
    return unicos;
  }

  async update(id: number, dto: UpdateRolDto) {
    const existente = await this.prisma.rol.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException('El rol no existe');
    }

    let nombre = existente.nombre;
    if (dto.nombre !== undefined && dto.nombre.trim() !== existente.nombre) {
      nombre = dto.nombre.trim();
      const duplicado = await this.prisma.rol.findUnique({ where: { nombre } });
      if (duplicado) {
        throw new ConflictException('El rol ya existe');
      }
    }

    let nivelIds: number[] | undefined;
    if (dto.nivelIds !== undefined) {
      nivelIds = await this.validarNiveles(dto.nivelIds);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.rol.update({
        where: { id },
        data: {
          nombre,
          descripcion: dto.descripcion !== undefined ? dto.descripcion.trim() || null : undefined,
        },
      });
      if (nivelIds !== undefined) {
        await tx.rolNivel.deleteMany({ where: { rolId: id } });
        await tx.rolNivel.createMany({
          data: nivelIds.map((nivelId) => ({ rolId: id, nivelId })),
        });
      }
      return tx.rol.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          accesos: { select: { nivel: { select: { codigo: true } } } },
        },
      });
    });
  }

  async remove(id: number) {
    const existente = await this.prisma.rol.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException('El rol no existe');
    }

    const conUsuarios = await this.prisma.usuario.count({ where: { rolId: id } });
    if (conUsuarios > 0) {
      throw new ConflictException('No se puede eliminar: el rol tiene usuarios asignados');
    }

    try {
      // Los accesos se eliminan en cascada con el rol
      await this.prisma.rol.delete({ where: { id } });
    } catch (error) {
      if (isPrismaFkError(error)) {
        throw new ConflictException('No se puede eliminar: el rol tiene registros asociados');
      }
      throw error;
    }
  }
}

function isPrismaFkError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2003'
  );
}
