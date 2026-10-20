import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccionAuditoria } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { AuthenticatedUser } from './types/jwt-payload.type.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async login(usuario: string, password: string) {
    const user = await this.usersService.findByUsuario(usuario);

    // Mismo 401 para todo motivo; el motivo real solo queda en auditoría (solo ADMIN)
    if (!user || !user.activo || !user.rol.activo) {
      await this.registrarFallo(usuario, user?.id ?? null, user ? 'INACTIVO' : 'NO_EXISTE');
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      await this.registrarFallo(usuario, user.id, 'PASSWORD');
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const accesos = await this.usersService.accesosDeUsuario(user.id);

    const payload = { sub: user.id, usuario: user.usuario, rol: user.rol.nombre, niveles: accesos };
    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditoria.registrarSesion({
      accion: AccionAuditoria.LOGIN,
      usuarioId: user.id,
      usuarioNombre: user.usuario,
      registroId: user.id,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        nombre: `${user.nombres} ${user.apellidos}`.trim(),
        usuario: user.usuario,
        rol: user.rol.nombre,
        accesos,
      },
    };
  }

  async logout(user: AuthenticatedUser) {
    await this.auditoria.registrarSesion({
      accion: AccionAuditoria.LOGOUT,
      usuarioId: user.id,
      usuarioNombre: user.usuario,
      registroId: user.id,
    });
  }

  // Solo el usuario intentado; la contraseña nunca llega a auditoría
  private registrarFallo(usuarioIntentado: string, registroId: number | null, motivo: string) {
    return this.auditoria.registrarSesion({
      accion: AccionAuditoria.LOGIN_FALLIDO,
      usuarioId: null,
      usuarioNombre: usuarioIntentado,
      registroId,
      motivo,
    });
  }
}
