export interface JwtPayload {
  sub: number;
  usuario: string;
  rol: string;
}

export interface AuthenticatedUser {
  id: number;
  usuario: string;
  rol: string;
}
