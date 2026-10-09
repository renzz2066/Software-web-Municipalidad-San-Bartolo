import { SetMetadata } from '@nestjs/common';

export const NIVEL_KEY = 'nivel';
export const RequireNivel = (...codigos: string[]) => SetMetadata(NIVEL_KEY, codigos);
