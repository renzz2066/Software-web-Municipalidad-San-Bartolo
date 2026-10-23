// Catálogos fijos del Reglamento Nacional de Tasaciones usados por Piso y Depreciacion.
// Mismos códigos en frontend/src/pages/rentas/catalogosConstruccion.ts.

export const CLASIFICACIONES = ['CASA_HABITACION', 'TIENDAS_DEPOSITOS', 'EDIFICIOS_OFICINAS', 'CLINICAS_INDUSTRIAS'] as const;
export const MATERIALES = ['CONCRETO', 'LADRILLO', 'ADOBE'] as const;
export const ESTADOS_CONSERVACION = ['MUY_BUENO', 'BUENO', 'REGULAR', 'MALO'] as const;

// Conceptos de arbitrios (SIMUN: Maestros → Servicios Municipales). Cada uno es un Tributo con ese código.
export const CONCEPTOS_ARBITRIO = ['RESIDUOS', 'BARRIDO', 'PARQUES', 'SERENAZGO'] as const;

// Una letra por componente, en el orden del enum ComponenteConstruccion:
// muros, techos, pisos, puertas/ventanas, revestimientos, baños, instalaciones. "-" = no tiene.
export const REGEX_CATEGORIAS = /^[A-I-]{7}$/;
