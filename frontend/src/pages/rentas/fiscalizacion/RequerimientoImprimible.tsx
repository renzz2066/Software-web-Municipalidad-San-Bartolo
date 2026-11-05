import { useParams } from 'react-router-dom'
import { PageHeader } from '../../../components/layout/PageHeader'
import { direccion } from '../predios/tipos'
import { MODALIDADES } from '../valores/valoresApi'
import { RUTA_EXPEDIENTES, etiquetaTipo, useExpediente } from './fiscalizacionApi'

// Requerimiento de inspección para imprimir y notificar (specs/rentas-fiscalizacion-v1.md, F2).
// Base legal: facultad de fiscalización (Código Tributario art. 62) y obligación del deudor de
// permitir la inspección y exhibir la documentación (art. 87).

export function RequerimientoImprimible() {
  const { id } = useParams()
  const { expediente: e, error } = useExpediente(id)

  return (
    <div className="p-4 sm:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-content">
        <PageHeader
          titulo="Requerimiento de inspección"
          descripcion={e ? `Expediente FIS ${e.numero}` : undefined}
          volverA={{ etiqueta: 'Expediente', ruta: `${RUTA_EXPEDIENTES}/${id}` }}
          accion={{ etiqueta: 'Imprimir / PDF', icono: 'bi bi-printer', onClick: () => window.print(), disabled: !e?.inspeccion }}
        />

        <main className="mt-4 rounded-panel border border-borde bg-white p-8 text-sm leading-relaxed print:mt-0 print:rounded-none print:border-0 print:p-0">
          {error ? (
            <p role="alert" className="font-medium text-ladrillo">
              {error}
            </p>
          ) : !e ? (
            <p role="status" className="text-slate-500">
              Cargando…
            </p>
          ) : !e.inspeccion ? (
            <p role="alert" className="font-medium text-ladrillo">
              Programa la fecha y hora de la inspección antes de imprimir el requerimiento.
            </p>
          ) : (
            <>
              <header className="border-b border-slate-300 pb-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Municipalidad Distrital de San Bartolo · Gerencia de Rentas · Fiscalización Tributaria
                </p>
                <h1 className="mt-1 text-lg font-bold text-mar-profundo">REQUERIMIENTO DE INSPECCIÓN</h1>
                <p className="font-mono font-semibold">Expediente FIS {e.numero}</p>
              </header>

              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-slate-500">Contribuyente</dt>
                <dd className="font-semibold">{e.contribuyente.nombreCompleto}</dd>
                <dt className="text-slate-500">Documento</dt>
                <dd className="font-mono">
                  {e.contribuyente.tipoDoc} {e.contribuyente.numDoc}
                  {e.contribuyente.codigoLegacy && ` · Cód. ${e.contribuyente.codigoLegacy}`}
                </dd>
                <dt className="text-slate-500">Domicilio fiscal</dt>
                <dd>{e.contribuyente.direccionFiscal ?? '—'}</dd>
                <dt className="text-slate-500">Tipo de fiscalización</dt>
                <dd>{etiquetaTipo(e.tipo)}</dd>
                <dt className="text-slate-500">Periodos</dt>
                <dd>Impuesto predial y arbitrios municipales {e.anioDesde === e.anioHasta ? e.anioDesde : `${e.anioDesde} a ${e.anioHasta}`}</dd>
              </dl>

              <p className="mt-4">
                En ejercicio de la facultad de fiscalización que le otorga el artículo 62 del Texto Único Ordenado del Código
                Tributario, la Municipalidad le comunica que realizará la inspección de los siguientes predios el día{' '}
                <strong>{e.inspeccion.fecha}</strong> a las <strong>{e.inspeccion.hora} horas</strong>, a cargo del fiscalizador{' '}
                <strong>{e.fiscalizador.nombre}</strong> (DNI {e.fiscalizador.dni}):
              </p>
              <ol className="mt-2 list-decimal pl-6">
                {e.predios.map((p) => (
                  <li key={p.predioId}>
                    {direccion(p.predio)}
                    {p.predio.codigoCatastro && ` · Catastro ${p.predio.codigoCatastro}`}
                  </li>
                ))}
              </ol>
              <p className="mt-4">
                Conforme al artículo 87 del Código Tributario, se le requiere permitir el acceso al predio y exhibir la
                documentación que sustente lo declarado (títulos de propiedad, licencias de edificación, planos y declaraciones
                juradas). No permitir la inspección constituye infracción sancionable (art. 177).
              </p>

              <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                <p className="border-t border-slate-400 pt-1">Fiscalizador</p>
                <p className="border-t border-slate-400 pt-1">Jefe de Fiscalización Tributaria</p>
              </div>

              <section className="mt-8 border-t-2 border-dashed border-slate-300 pt-3 text-xs">
                <h2 className="font-bold uppercase">Cargo de notificación</h2>
                {e.notificacion ? (
                  <p className="mt-1">
                    Notificado el {e.notificacion.fecha} ·{' '}
                    {MODALIDADES.find((m) => m.value === e.notificacion!.modalidad)?.label ?? e.notificacion.modalidad}
                    {e.notificacion.nombre && ` · recibió ${e.notificacion.nombre}, DNI ${e.notificacion.dni}`}
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-4">
                    <p>Fecha y hora: ____________________</p>
                    <p>Nombre: ________________________</p>
                    <p>DNI y firma: ____________________</p>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
