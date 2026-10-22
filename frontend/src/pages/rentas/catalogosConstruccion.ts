// Catálogos del Reglamento Nacional de Tasaciones (mismos códigos que
// backend/src/rentas/catalogos-construccion.ts). Usados por pisos y depreciación.

export const CLASIFICACIONES = [
  { value: 'CASA_HABITACION', label: 'Casa habitación / departamentos' },
  { value: 'TIENDAS_DEPOSITOS', label: 'Tiendas, depósitos, recreación' },
  { value: 'EDIFICIOS_OFICINAS', label: 'Edificios y oficinas' },
  { value: 'CLINICAS_INDUSTRIAS', label: 'Clínicas, industrias, colegios' },
]

export const MATERIALES = [
  { value: 'CONCRETO', label: 'Concreto' },
  { value: 'LADRILLO', label: 'Ladrillo' },
  { value: 'ADOBE', label: 'Adobe / quincha / tapial' },
]

export const ESTADOS_CONSERVACION = [
  { value: 'MUY_BUENO', label: 'Muy bueno' },
  { value: 'BUENO', label: 'Bueno' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'MALO', label: 'Malo' },
]

// Conceptos de arbitrios (= códigos de Tributo en el backend).
export const CONCEPTOS_ARBITRIO = [
  { value: 'RESIDUOS', label: 'Residuos sólidos' },
  { value: 'BARRIDO', label: 'Barrido de calles' },
  { value: 'PARQUES', label: 'Parques y jardines' },
  { value: 'SERENAZGO', label: 'Serenazgo' },
]

// Orden de las 7 letras de Piso.categorias.
export const COMPONENTES_CORTOS = ['Muros', 'Techos', 'Pisos', 'Puertas', 'Revest.', 'Baños', 'Instal.']

export function etiqueta(lista: { value: string; label: string }[], valor: string | null): string {
  return lista.find((o) => o.value === valor)?.label ?? valor ?? '—'
}
