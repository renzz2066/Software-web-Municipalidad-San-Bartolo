import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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

  async accesosDeUsuario(id: number): Promise<string[]> {
    const accesos = await this.prisma.rolNivel.findMany({
      where: { rol: { usuarios: { some: { id } } } },
      select: { nivel: { select: { codigo: true } } },
    });
    return accesos.map((a) => a.nivel.codigo);
  }

  findAll() {
    // UNA sola consulta con JOINs (Prisma haría 3 viajes: usuarios + roles + oficinas)
    interface UsuarioFila {
      id: number;
      usuario: string;
      nombres: string;
      apellidos: string;
      activo: boolean;
      rolId: number;
      rolNombre: string;
      oficinaId: number | null;
      oficinaCodigo: string | null;
      oficinaNombre: string | null;
    }
    return this.prisma.$queryRaw<UsuarioFila[]>`
      SELECT u.id, u.usuario, u.nombres, u.apellidos, u.activo,
             r.id AS "rolId", r.nombre AS "rolNombre",
             o.id AS "oficinaId", o.codigo AS "oficinaCodigo", o.nombre AS "oficinaNombre"
      FROM usuarios u
      JOIN roles r ON r.id = u."rolId"
      LEFT JOIN oficinas o ON o.id = u."oficinaId"
      ORDER BY u.usuario ASC
    `.then((filas) =>
      filas.map((f) => ({
        id: f.id,
        usuario: f.usuario,
        nombres: f.nombres,
        apellidos: f.apellidos,
        rol: { id: f.rolId, nombre: f.rolNombre },
        activo: f.activo,
        oficina:
          f.oficinaId === null
            ? null
            : {
                id: f.oficinaId,
                codigo: f.oficinaCodigo as string,
                nombre: f.oficinaNombre as string,
              },
      })),
    );
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

    await this.validarRolActivo(dto.rolId);

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

  async update(id: number, dto: UpdateUsuarioDto, solicitanteId: number) {
    const existente = await this.prisma.usuario.findUnique({ where: { id }, include: { rol: true } });
    if (!existente) {
      throw new NotFoundException('El usuario no existe');
    }

    if (dto.activo === false && existente.activo) {
      await this.validarDesactivacion(existente, solicitanteId);
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

    if (dto.rolId !== undefined && dto.rolId !== existente.rolId) {
      await this.validarRolActivo(dto.rolId);
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

  // Baja lógica: nunca DELETE (el historial y la auditoría lo referencian)
  async remove(id: number, solicitanteId: number) {
    const existente = await this.prisma.usuario.findUnique({ where: { id }, include: { rol: true } });
    if (!existente) {
      throw new NotFoundException('El usuario no existe');
    }
    if (!existente.activo) {
      return;
    }

    await this.validarDesactivacion(existente, solicitanteId);
    await this.prisma.usuario.update({ where: { id }, data: { activo: false } });
  }

  private async validarDesactivacion(usuario: { id: number; rol: { nombre: string } }, solicitanteId: number) {
    if (usuario.id === solicitanteId) {
      throw new BadRequestException('No puedes desactivar tu propio usuario');
    }
    if (usuario.rol.nombre === 'ADMIN') {
      const otrosAdmins = await this.prisma.usuario.count({
        where: { id: { not: usuario.id }, activo: true, rol: { nombre: 'ADMIN' } },
      });
      if (otrosAdmins === 0) {
        throw new BadRequestException('No puedes desactivar al último ADMIN activo');
      }
    }
  }

  private async validarRolActivo(rolId: number) {
    const rol = await this.prisma.rol.findUnique({ where: { id: rolId } });
    if (!rol) {
      throw new BadRequestException('El rol no existe');
    }
    if (!rol.activo) {
      throw new BadRequestException('El rol está inactivo');
    }
  }
}
