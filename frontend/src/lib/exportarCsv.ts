// Exportación a CSV en el navegador (specs/utilitarios-v1.md, U6). Sin librerías.
// - BOM UTF-8 para que Excel abra acentos correctamente.
// - Separador `;` y coma decimal: el Excel en español no espera coma como separador de campos.
// - `aCsv` es puro (se prueba); `descargarCsv` toca el DOM y solo se usa desde la pantalla.

export interface ColumnaCsv {
  clave: string
  titulo: string
  /** Formatea la celda; si falta se usa `texto`. */
  formato?: (valor: unknown) => string
}

const SEPARADOR = ';'
const SALTO = '\r\n'

// Celdas: null/undefined vacías, fechas a AAAA-MM-DD, el resto a texto.
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

function escapar(celda: string): string {
  return /[;"\r\n]/.test(celda) ? `"${celda.replace(/"/g, '""')}"` : celda
}

export function aCsv(filas: Record<string, unknown>[], columnas: ColumnaCsv[]): string {
  const linea = (celdas: string[]) => celdas.map(escapar).join(SEPARADOR)
  const cabecera = linea(columnas.map((c) => c.titulo))
  const cuerpo = filas.map((fila) =>
    linea(columnas.map((c) => (c.formato ? c.formato(fila[c.clave]) : texto(fila[c.clave])))),
  )
  return [cabecera, ...cuerpo].join(SALTO)
}

/** Nombre de archivo seguro para descargar (sin acentos ni caracteres raros). */
export function nombreArchivo(base: string, sufijo = ''): string {
  const limpio = base
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${limpio || 'exportacion'}${sufijo}.csv`
}

export function descargarCsv(nombre: string, contenido: string): void {
  const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
