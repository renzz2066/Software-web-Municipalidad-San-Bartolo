import type { ReactNode } from 'react'
import { CLASIFICACIONES, COMPONENTES_CORTOS, ESTADOS_CONSERVACION, MATERIALES } from '../catalogosConstruccion'
import { CLASE, PISO_VACIO, type DatosForm, type InstalacionForm, type PisoForm } from './predioForm'
import type { Catalogos } from './tipos'

// Ubicación, terreno y construcción de un predio: los comparten la declaración jurada (C3) y la
// ficha de inspección de Fiscalización (specs/rentas-fiscalizacion-v1.md, F3), así lo fiscalizado
// se captura y se valoriza igual que lo declarado.

interface Props {
  catalogos: Catalogos | null
  datos: DatosForm
  setDatos: (f: (d: DatosForm) => DatosForm) => void
  pisos: PisoForm[]
  setPisos: (f: (p: PisoForm[]) => PisoForm[]) => void
  instalaciones: InstalacionForm[]
  setInstalaciones: (f: (i: InstalacionForm[]) => InstalacionForm[]) => void
}

export function CamposPredio({ catalogos, datos, setDatos, pisos, setPisos, instalaciones, setInstalaciones }: Props) {
  const onDato = (k: keyof DatosForm, v: string) => setDatos((d) => ({ ...d, [k]: v }))
  const cambiarPiso = (i: number, k: keyof PisoForm, v: string) => setPisos((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)))
  return (
    <>
      <Bloque titulo="Ubicación y terreno">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Campo id="via" label="Vía *">
              <select id="via" value={datos.viaId} onChange={(e) => onDato('viaId', e.target.value)} className={CLASE}>
                <option value="">Selecciona…</option>
                {catalogos?.vias.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.tipoVia} {v.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo id="numero" label="Número">
            <input id="numero" maxLength={10} value={datos.numero} onChange={(e) => onDato('numero', e.target.value)} className={CLASE} />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo id="mz" label="Mz.">
              <input id="mz" maxLength={10} value={datos.manzana} onChange={(e) => onDato('manzana', e.target.value)} className={CLASE} />
            </Campo>
            <Campo id="lt" label="Lote">
              <input id="lt" maxLength={10} value={datos.lote} onChange={(e) => onDato('lote', e.target.value)} className={CLASE} />
            </Campo>
          </div>
          <div className="sm:col-span-2">
            <Campo id="urb" label="Urbanización">
              <select id="urb" value={datos.urbanizacionId} onChange={(e) => onDato('urbanizacionId', e.target.value)} className={CLASE}>
                <option value="">—</option>
                {catalogos?.urbanizaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo id="zona" label="Zona (arbitrios)">
            <select id="zona" value={datos.zonaId} onChange={(e) => onDato('zonaId', e.target.value)} className={CLASE}>
              <option value="">—</option>
              {catalogos?.zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.codigo} · {z.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="catastro" label="Código catastral">
            <input id="catastro" maxLength={20} value={datos.codigoCatastro} onChange={(e) => onDato('codigoCatastro', e.target.value)} className={CLASE} />
          </Campo>
          <Campo id="area" label="Área terreno m² *">
            <input id="area" type="number" step="0.01" min="0" value={datos.areaTerreno} onChange={(e) => onDato('areaTerreno', e.target.value)} className={CLASE} />
          </Campo>
          <Campo id="uso" label="Uso del predio *">
            <input id="uso" maxLength={10} placeholder="CASA" value={datos.usoPredio} onChange={(e) => onDato('usoPredio', e.target.value)} className={`${CLASE} uppercase`} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo id="ref" label="Referencia">
              <input id="ref" maxLength={150} value={datos.referencia} onChange={(e) => onDato('referencia', e.target.value)} className={CLASE} />
            </Campo>
          </div>
        </div>
        {catalogos && catalogos.vias.length === 0 && (
          <p className="mt-2 text-xs text-amber-700">No hay vías registradas: créalas en Rentas → Maestros → Ubicación.</p>
        )}
      </Bloque>

      <Bloque titulo="Construcción (pisos)">
        <p className="mb-2 text-xs text-slate-500">Categorías: 7 letras A–I en orden {COMPONENTES_CORTOS.join(', ')}; "-" si no tiene. Ej.: CCDEEDE.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-1 py-1">Nivel</th>
                <th scope="col" className="px-1 py-1">Año constr.</th>
                <th scope="col" className="px-1 py-1">Clasificación</th>
                <th scope="col" className="px-1 py-1">Material</th>
                <th scope="col" className="px-1 py-1">Conservación</th>
                <th scope="col" className="px-1 py-1">Categorías</th>
                <th scope="col" className="px-1 py-1">Área m²</th>
                <th scope="col" className="px-1 py-1"><span className="sr-only">Quitar</span></th>
              </tr>
            </thead>
            <tbody>
              {pisos.map((p, i) => (
                <tr key={i}>
                  <td className="w-20 px-1 py-1"><input aria-label={`Nivel piso ${i + 1}`} maxLength={10} value={p.nivel} onChange={(e) => cambiarPiso(i, 'nivel', e.target.value)} className={CLASE} /></td>
                  <td className="w-24 px-1 py-1"><input aria-label={`Año piso ${i + 1}`} inputMode="numeric" maxLength={4} value={p.anioConstruccion} onChange={(e) => cambiarPiso(i, 'anioConstruccion', e.target.value)} className={CLASE} /></td>
                  <td className="px-1 py-1"><Opciones label={`Clasificación piso ${i + 1}`} value={p.clasificacion} opciones={CLASIFICACIONES} onChange={(v) => cambiarPiso(i, 'clasificacion', v)} /></td>
                  <td className="px-1 py-1"><Opciones label={`Material piso ${i + 1}`} value={p.material} opciones={MATERIALES} onChange={(v) => cambiarPiso(i, 'material', v)} /></td>
                  <td className="px-1 py-1"><Opciones label={`Conservación piso ${i + 1}`} value={p.estadoConservacion} opciones={ESTADOS_CONSERVACION} onChange={(v) => cambiarPiso(i, 'estadoConservacion', v)} /></td>
                  <td className="w-28 px-1 py-1"><input aria-label={`Categorías piso ${i + 1}`} maxLength={7} value={p.categorias} onChange={(e) => cambiarPiso(i, 'categorias', e.target.value.toUpperCase())} className={`${CLASE} font-mono tracking-widest`} /></td>
                  <td className="w-24 px-1 py-1"><input aria-label={`Área piso ${i + 1}`} type="number" step="0.01" min="0" value={p.areaConstruida} onChange={(e) => cambiarPiso(i, 'areaConstruida', e.target.value)} className={CLASE} /></td>
                  <td className="px-1 py-1">
                    <button type="button" aria-label={`Quitar piso ${i + 1}`} onClick={() => setPisos((ps) => ps.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700">
                      <i aria-hidden="true" className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => setPisos((ps) => [...ps, { ...PISO_VACIO, nivel: String(ps.length + 1).padStart(2, '0') }])}
          className="mt-2 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-sm font-medium text-mar-profundo hover:bg-mar/5"
        >
          <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
          Agregar piso
        </button>

        <h3 className="mt-6 text-sm font-semibold text-mar-profundo">Otras instalaciones</h3>
        {instalaciones.map((o, i) => (
          <div key={i} className="mt-2 grid grid-cols-[1fr_6rem_6rem_auto] gap-2">
            <input aria-label={`Descripción instalación ${i + 1}`} placeholder="Cerco perimétrico" maxLength={150} value={o.descripcion} onChange={(e) => setInstalaciones((xs) => xs.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} className={CLASE} />
            <input aria-label={`Unidad instalación ${i + 1}`} placeholder="ML" maxLength={10} value={o.unidad} onChange={(e) => setInstalaciones((xs) => xs.map((x, j) => (j === i ? { ...x, unidad: e.target.value } : x)))} className={CLASE} />
            <input aria-label={`Cantidad instalación ${i + 1}`} type="number" step="0.01" min="0" value={o.cantidad} onChange={(e) => setInstalaciones((xs) => xs.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))} className={CLASE} />
            <button type="button" aria-label={`Quitar instalación ${i + 1}`} onClick={() => setInstalaciones((xs) => xs.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700">
              <i aria-hidden="true" className="bi bi-trash" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setInstalaciones((xs) => [...xs, { descripcion: '', unidad: '', cantidad: '' }])}
          className="mt-2 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-sm font-medium text-mar-profundo hover:bg-mar/5"
        >
          <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
          Agregar instalación
        </button>
      </Bloque>
    </>
  )
}

export function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-md ring-1 ring-mar-profundo/10" aria-label={titulo}>
      <h2 className="mb-4 font-semibold text-mar-profundo">{titulo}</h2>
      {children}
    </section>
  )
}

export function Campo({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}

function Opciones({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string
  value: string
  opciones: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={CLASE}>
      {opciones.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
