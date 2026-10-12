export interface JwtPayload {
  sub: number;
  usuario: string;
  rol: string;
  niveles: string[];
}

export interface AuthenticatedUser {
  id: number;
  usuario: string;
  rol: string;
  niveles: string[];
}
