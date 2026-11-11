export interface JwtPayload {
  sub: number;
  usuario: string;
  rol: string;
  niveles: string[];
  // slug de la muni donde se emitió: el token no sirve en otra (specs/multi-muni-v1.md)
  muni?: string;
}

export interface AuthenticatedUser {
  id: number;
  usuario: string;
  rol: string;
  niveles: string[];
}
