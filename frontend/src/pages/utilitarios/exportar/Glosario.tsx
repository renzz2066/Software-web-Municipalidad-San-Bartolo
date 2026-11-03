// D3: glosario del sistema (specs/utilitarios-v1.md). Referencia rápida, sin llamadas.

interface Entrada {
  termino: string
  que: string
}

const GRUPOS: { titulo: string; entradas: Entrada[] }[] = [
  {
    titulo: 'Tipos de valor',
    entradas: [
      { termino: 'OP', que: 'Orden de Pago. Se emite por deuda ya vencida; se notifica y queda exigible.' },
      { termino: 'RD', que: 'Resolución de Determinación. Fija la deuda; el contribuyente puede reclamar en 20 días hábiles.' },
      { termino: 'RM', que: 'Resolución de Multa. Aplica una infracción (arts. 176 y 178 del TUO del Código Tributario).' },
      { termino: 'DJ', que: 'Declaración Jurada. Lo que el contribuyente declara; sirve de base para fiscalizar.' },
    ],
  },
  {
    titulo: 'Estados',
    entradas: [
      { termino: 'EMITIDO', que: 'Valor creado, aún sin notificar.' },
      { termino: 'NOTIFICADO', que: 'Valor entregado al contribuyente: ya es exigible.' },
      { termino: 'COACTIVO', que: 'Valor transferido a cobranza coactiva.' },
      { termino: 'CANCELADO', que: 'Valor pagado en su totalidad.' },
      { termino: 'ANULADO', que: 'Valor dejado sin efecto con motivo registrado.' },
      { termino: 'PENDIENTE', que: 'Cuota de la cuenta corriente aún sin pagar.' },
      { termino: 'FRACCIONADO', que: 'Cuota cubierta por un convenio: la rige el cronograma, no la mora normal.' },
      { termino: 'EXTORNADO', que: 'Recibo reversado; el dinero vuelve a la caja.' },
    ],
  },
  {
    titulo: 'Cálculo de la deuda',
    entradas: [
      { termino: 'UIT', que: 'Unidad Impositiva Tributaria. Sirve de referencia para mínimos, topes y multas.' },
      { termino: 'IPM', que: 'Serie que usa el sistema para el reajuste de la deuda predial (D.L. 776 art. 15).' },
      { termino: 'TIM', que: 'Tasa de Interés Moratorio: genera la mora día a día (Código Tributario art. 33).' },
      { termino: 'Insoluto', que: 'Lo adeudado original, sin reajuste ni mora.' },
      { termino: 'Reajuste', que: 'Ajuste por inflación desde el vencimiento; aplica a predial, cuotas 2 a 4.' },
      { termino: 'Mora', que: 'Interés por mora de pago. No se calcula sobre el derecho de emisión.' },
      { termino: 'Derecho de emisión', que: 'Cargo por emitir el valor. No genera mora.' },
    ],
  },
  {
    titulo: 'Trámites y plazos',
    entradas: [
      { termino: 'Día hábil', que: 'De lunes a viernes que no es feriado. Los plazos administrativos se cuentan en días hábiles.' },
      { termino: 'Exigible', que: 'Día desde el que se puede cobrar. Para la OP es el hábil siguiente a la notificación.' },
      { termino: 'Fiscalización', que: 'Revisión de lo declarado contra lo que corresponde; puede terminar en RD o RM.' },
      { termino: 'Convenio', que: 'Fraccionamiento de la deuda en un cronograma de cuotas.' },
      { termino: 'Extorno', que: 'Anulación de un recibo ya cobrado, con motivo y trazabilidad.' },
    ],
  },
  {
    titulo: 'Identificación y roles',
    entradas: [
      { termino: 'DNI', que: 'Documento Nacional de Identidad: 8 dígitos, sin dígito verificador.' },
      { termino: 'RUC', que: 'Registro Único de Contribuyente: 11 dígitos con dígito verificador SUNAT.' },
      { termino: 'CE', que: 'Carné de Extranjería: 9 a 12 caracteres.' },
      { termino: 'MEF', que: 'Ministerio de Economía y Finanzas, que fija la UIT.' },
      { termino: 'ADMIN', que: 'Rol con acceso total.' },
      { termino: 'SUPERVISOR', que: 'Rol de consulta y aprobación.' },
      { termino: 'CAJERO', que: 'Rol de ventanilla: cobra y cierra caja.' },
    ],
  },
]

export function Glosario() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Significado de los términos y estados que aparecen en el sistema. La fuente de verdad es la spec
        de cada módulo.
      </p>
      {GRUPOS.map((g) => (
        <section key={g.titulo}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{g.titulo}</h2>
          <dl className="mt-2 divide-y divide-slate-100 rounded-md ring-1 ring-slate-200">
            {g.entradas.map((e) => (
              <div key={e.termino} className="grid gap-1 px-3 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="font-mono text-sm font-semibold text-mar-profundo">{e.termino}</dt>
                <dd className="text-sm text-slate-600">{e.que}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
