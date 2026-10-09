import { TipoNivel } from '@prisma/client';

export interface NivelDef {
  codigo: string;
  tipo: TipoNivel;
  nombre: string;
  descripcion?: string;
  padre?: string;
  orden?: number;
}

// Catálogo de niveles del sistema (2 capas: MODULO -> FUNCIONALIDAD).
// El sistema los registra automáticamente; no se crean a mano.
// Al agregar un módulo o funcionalidad nuevo, añade aquí su nodo.
export const NIVELES_CATALOGO: NivelDef[] = [
  {
    codigo: 'accesibilidad',
    tipo: TipoNivel.MODULO,
    nombre: 'Accesibilidad',
    descripcion: 'Usuarios, roles, niveles y accesos por rol.',
    orden: 1,
  },
  {
    codigo: 'accesibilidad.usuarios',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Gestión de Usuarios',
    descripcion: 'Administración de usuarios del sistema.',
    padre: 'accesibilidad',
    orden: 1,
  },
  {
    codigo: 'accesibilidad.roles',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Roles',
    descripcion: 'Roles asignables a los usuarios.',
    padre: 'accesibilidad',
    orden: 2,
  },
  {
    codigo: 'accesibilidad.niveles',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Niveles',
    descripcion: 'Catálogo de accesos del sistema.',
    padre: 'accesibilidad',
    orden: 3,
  },
  {
    codigo: 'accesibilidad.accesos-por-rol',
    tipo: TipoNivel.FUNCIONALIDAD,
    nombre: 'Accesos por Roles',
    descripcion: 'Niveles habilitados para cada rol.',
    padre: 'accesibilidad',
    orden: 4,
  },
];
