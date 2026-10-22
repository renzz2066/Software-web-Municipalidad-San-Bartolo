// "Hoy" en la zona del navegador (AAAA-MM-DD). toISOString() usa UTC y en Lima adelanta un día de noche.
export const hoyLocal = () => new Date().toLocaleDateString('en-CA')
