// "Hoy" en hora de Lima (AAAA-MM-DD). toISOString() usa UTC y después de las 19:00 ya es mañana.
export const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
