import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(usuario: string, password: string) {
    const user = await this.usersService.findByUsuario(usuario);

    if (!user || !user.activo) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const payload = { sub: user.id, usuario: user.usuario, rol: user.rol.nombre };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        nombre: `${user.nombres} ${user.apellidos}`.trim(),
        usuario: user.usuario,
        rol: user.rol.nombre,
      },
    };
  }
}
