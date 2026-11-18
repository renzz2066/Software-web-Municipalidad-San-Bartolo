import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../../../lib/api'
import { useCatalogo, type ItemCatalogo } from '../catalogos/catalogosApi'
import { CLASIFICACIONES, ESTADOS_CONSERVACION, MATERIALES } from '../catalogosConstruccion'
import { SelectorDireccion } from '../direcciones/SelectorDireccion'
import { mensajeError } from '../maestros/maestrosApi'
import {
  ADQUIRIENTE_VACIO,
  CREAN_PREDIO,
  DESCARGOS,
  NIVEL_VACIO,
  OBRA_VACIA,
  RUSTICO_VACIO,
  USO_VACIO,
  etiquetaPredio,
  type AnexoForm,
  type PredioElegido,
} from './djApi'

// Un anexo de la DJ = un predio (J01): tenencia (R04, R05, J10–J12) y lo declarado del predio
// (usos R03, niveles V01–V04, obras V05, aranceles rústicos V07, adquirientes o transferentes J12).

export const CLASE = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-3 focus-visible:outline-turquesa'
const decimal = (v: string) => v.replace(/[^\d.]/g, '')
const entero = (v: string) => v.replace(/\D/g, '')

interface PredioBuscado {
  id: number
  nombre: string | null
  tipo: 'URBANO' | 'RUSTICO'
  estado: string
  codigoCatastro: string | null
  direccion: { direccion: string } | null
  contribuyentes: { porcentaje: string; contribuyente: { id: number; nombreCompleto: string } }[]
}

export function AnexoEditor({
  numero,
  anexo,
  motivo,
  onChange,
  onQuitar,
}: {
  numero: number
  anexo: AnexoForm
  motivo: string
  onChange: (a: AnexoForm) => void
  onQuitar?: () => void
}) {
  const condiciones = useCatalogo('CONDICION_PROPIEDAD')
  const subMotivos = useCatalogo('SUB_MOTIVO_DJ').filter((s) => s.padre?.codigo === motivo)
  const usosCat = useCatalogo('USO_PREDIO')
  const subUsos = useCatalogo('SUB_USO_PREDIO')
  const tiposDoc = useCatalogo('TIPO_DOCUMENTO')
  const docsTransferencia = useCatalogo('TIPO_DOC_TRANSFERENCIA')
  const descargo = DESCARGOS.includes(motivo)
  const rustico = (anexo.predio?.tipo ?? anexo.nuevo?.tipo) === 'RUSTICO'
  const id = (k: string) => `anexo-${numero}-${k}`
  const set = <K extends keyof AnexoForm>(k: K, v: AnexoForm[K]) => onChange({ ...anexo, [k]: v })

  function lista<K extends 'niveles' | 'obras' | 'usos' | 'rusticos' | 'adquirientes'>(k: K) {
    const items = anexo[k]
    return {
      cambiar: (i: number, campo: string, v: unknown) => set(k, items.map((x, j) => (j === i ? { ...x, [campo]: v } : x)) as AnexoForm[K]),
      quitar: (i: number) => set(k, items.filter((_, j) => j !== i) as AnexoForm[K]),
      agregar: (nuevo: AnexoForm[K][number]) => set(k, [...items, nuevo] as AnexoForm[K]),
    }
  }
  const niveles = lista('niveles')
  const obras = lista('obras')
  const usos = lista('usos')
  const rusticos = lista('rusticos')
  const adq = lista('adquirientes')

  return (
    <section className="rounded-panel border border-borde bg-white" aria-labelledby={id('titulo')}>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 id={id('titulo')} className="font-semibold text-mar-profundo">
          Anexo {numero}
        </h3>
        {onQuitar && (
          <button type="button" onClick={onQuitar} className="rounded-md px-2 py-1 text-xs font-medium text-ladrillo hover:bg-ladrillo/5 focus-visible:outline-3 focus-visible:outline-turquesa">
            Quitar anexo
          </button>
        )}
      </div>

      <div className="space-y-5 p-4">
        <Bloque titulo="Predio">
          <ElegirPredio
            id={id('predio')}
            anexo={anexo}
            puedeCrear={CREAN_PREDIO.includes(motivo)}
            onPredio={(p) => onChange({ ...anexo, predio: p, nuevo: null })}
            onNuevo={(n) => onChange({ ...anexo, predio: null, nuevo: n })}
          />
        </Bloque>

        <Bloque titulo="Tenencia">
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo id={id('condicion')} label="Condición de propiedad">
              <Select id={id('condicion')} items={condiciones} value={anexo.condicion} onChange={(v) => set('condicion', v)} vacio={false} />
            </Campo>
            <Campo id={id('porcentaje')} label="% de propiedad">
              <input id={id('porcentaje')} value={anexo.porcentaje} inputMode="decimal" onChange={(e) => set('porcentaje', decimal(e.target.value))} className={CLASE} />
            </Campo>
            {subMotivos.length > 0 && (
              <Campo id={id('submotivo')} label="Sub-motivo del anexo">
                <Select id={id('submotivo')} items={subMotivos} value={anexo.subMotivo} onChange={(v) => set('subMotivo', v)} />
              </Campo>
            )}
            <Campo id={id('partida')} label="Partida registral">
              <input id={id('partida')} value={anexo.partidaRegistral} maxLength={30} onChange={(e) => set('partidaRegistral', e.target.value)} className={`${CLASE} uppercase`} />
            </Campo>
            <Campo id={id('fadq')} label={motivo === 'COMPRA' ? 'Fecha de adquisición *' : 'Fecha de adquisición'}>
              <input id={id('fadq')} type="date" value={anexo.fechaAdquisicion} onChange={(e) => set('fechaAdquisicion', e.target.value)} className={CLASE} />
            </Campo>
            <Campo id={id('fdoc')} label="Fecha del documento sustentatorio">
              <input id={id('fdoc')} type="date" value={anexo.fechaDocumento} onChange={(e) => set('fechaDocumento', e.target.value)} className={CLASE} />
            </Campo>
            {descargo && (
              <Campo id={id('fdes')} label="Fecha de descargo *">
                <input id={id('fdes')} type="date" value={anexo.fechaDescargo} onChange={(e) => set('fechaDescargo', e.target.value)} className={CLASE} />
              </Campo>
            )}
            <Campo id={id('afecta')} label="Predial desde el año">
              <input
                id={id('afecta')}
                value={anexo.anioAfectacion}
                inputMode="numeric"
                maxLength={4}
                placeholder="Automático"
                onChange={(e) => set('anioAfectacion', entero(e.target.value))}
                className={CLASE}
              />
            </Campo>
            <Campo id={id('farb')} label="Arbitrios desde">
              <input id={id('farb')} type="date" value={anexo.fechaAfectacionArbitrios} onChange={(e) => set('fechaAfectacionArbitrios', e.target.value)} className={CLASE} />
            </Campo>
            <Campo id={id('valor')} label="Valor de transferencia">
              <div className="flex gap-1">
                <input id={id('valor')} value={anexo.valorTransferencia} inputMode="decimal" onChange={(e) => set('valorTransferencia', decimal(e.target.value))} className={CLASE} />
                <select aria-label="Moneda" value={anexo.moneda} onChange={(e) => set('moneda', e.target.value)} className={`${CLASE} w-20`}>
                  <option value="">—</option>
                  <option value="PEN">S/</option>
                  <option value="USD">US$</option>
                </select>
              </div>
            </Campo>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Si dejas vacíos los años de afectación, se calculan: el predial desde el año siguiente a la adquisición (J10) y los arbitrios según la regla de la muni (J11).
          </p>
        </Bloque>

        <Bloque titulo="Terreno">
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo id={id('area')} label={descargo || rustico ? 'Área de terreno (m²)' : 'Área de terreno (m²) *'}>
              <input id={id('area')} value={anexo.areaTerreno} inputMode="decimal" onChange={(e) => set('areaTerreno', decimal(e.target.value))} className={CLASE} />
            </Campo>
            <Campo id={id('areacomun')} label="Área común (m²)">
              <input id={id('areacomun')} value={anexo.areaComun} inputMode="decimal" onChange={(e) => set('areaComun', decimal(e.target.value))} className={CLASE} />
            </Campo>
            <Campo id={id('pisos')} label="N° de pisos">
              <input id={id('pisos')} value={anexo.numeroPisos} inputMode="numeric" onChange={(e) => set('numeroPisos', entero(e.target.value))} className={CLASE} />
            </Campo>
          </div>
        </Bloque>

        <Bloque titulo={`Usos del predio${descargo ? '' : ' *'}`}>
          {anexo.usos.map((u, i) => (
            <Fila key={i} onQuitar={() => usos.quitar(i)} etiquetaQuitar={`Quitar uso ${i + 1}`}>
              <Campo id={id(`uso-${i}`)} label="Uso">
                <Select id={id(`uso-${i}`)} items={usosCat} value={u.uso} vacio={false} onChange={(v) => onChange({ ...anexo, usos: anexo.usos.map((x, j) => (j === i ? { ...x, uso: v, subUso: '' } : x)) })} />
              </Campo>
              <Campo id={id(`subuso-${i}`)} label="Sub-uso">
                <Select id={id(`subuso-${i}`)} items={subUsos.filter((s) => s.padre?.codigo === u.uso)} value={u.subUso} onChange={(v) => usos.cambiar(i, 'subUso', v)} />
              </Campo>
              <Campo id={id(`usoarea-${i}`)} label="Área (m²)">
                <input id={id(`usoarea-${i}`)} value={u.area} inputMode="decimal" onChange={(e) => usos.cambiar(i, 'area', decimal(e.target.value))} className={CLASE} />
              </Campo>
              <Campo id={id(`usofrontis-${i}`)} label="Frontis (m)">
                <input id={id(`usofrontis-${i}`)} value={u.frontis} inputMode="decimal" onChange={(e) => usos.cambiar(i, 'frontis', decimal(e.target.value))} className={CLASE} />
              </Campo>
              <Campo id={id(`inquilino-${i}`)} label="Inquilino">
                <input id={id(`inquilino-${i}`)} value={u.inquilino} maxLength={120} onChange={(e) => usos.cambiar(i, 'inquilino', e.target.value)} className={`${CLASE} uppercase`} />
              </Campo>
              <Campo id={id(`usoini-${i}`)} label="Inicio de actividad">
                <input id={id(`usoini-${i}`)} type="date" value={u.fechaInicio} onChange={(e) => usos.cambiar(i, 'fechaInicio', e.target.value)} className={CLASE} />
              </Campo>
              <Campo id={id(`usofin-${i}`)} label="Fin de actividad">
                <input id={id(`usofin-${i}`)} type="date" value={u.fechaFin} onChange={(e) => usos.cambiar(i, 'fechaFin', e.target.value)} className={CLASE} />
              </Campo>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="radio"
                  name={id('predominante')}
                  checked={u.predominante}
                  onChange={() => onChange({ ...anexo, usos: anexo.usos.map((x, j) => ({ ...x, predominante: j === i })) })}
                  className="h-4 w-4 accent-mar-profundo"
                />
                Predominante
              </label>
            </Fila>
          ))}
          <Agregar onClick={() => usos.agregar({ ...USO_VACIO, predominante: anexo.usos.length === 0 })}>Agregar uso</Agregar>
        </Bloque>

        <Bloque titulo="Niveles de construcción">
          {anexo.niveles.map((n, i) => (
            <Fila key={i} onQuitar={() => niveles.quitar(i)} etiquetaQuitar={`Quitar nivel ${i + 1}`}>
              <Campo id={id(`niv-${i}`)} label="Nivel">
                <input id={id(`niv-${i}`)} value={n.nivel} maxLength={10} placeholder="1, 2, S1…" onChange={(e) => niveles.cambiar(i, 'nivel', e.target.value)} className={`${CLASE} uppercase`} />
              </Campo>
              <Campo id={id(`nivanio-${i}`)} label="Año / mes">
                <div className="flex gap-1">
                  <input id={id(`nivanio-${i}`)} value={n.anioConstruccion} maxLength={4} inputMode="numeric" onChange={(e) => niveles.cambiar(i, 'anioConstruccion', entero(e.target.value))} className={CLASE} />
                  <input aria-label="Mes de construcción" value={n.mesConstruccion} maxLength={2} inputMode="numeric" onChange={(e) => niveles.cambiar(i, 'mesConstruccion', entero(e.target.value))} className={`${CLASE} w-14`} />
                </div>
              </Campo>
              <Campo id={id(`nivclas-${i}`)} label="Clasificación">
                <SelectFijo id={id(`nivclas-${i}`)} opciones={CLASIFICACIONES} value={n.clasificacion} onChange={(v) => niveles.cambiar(i, 'clasificacion', v)} />
              </Campo>
              <Campo id={id(`nivmat-${i}`)} label="Material">
                <SelectFijo id={id(`nivmat-${i}`)} opciones={MATERIALES} value={n.material} onChange={(v) => niveles.cambiar(i, 'material', v)} />
              </Campo>
              <Campo id={id(`nivest-${i}`)} label="Conservación">
                <SelectFijo id={id(`nivest-${i}`)} opciones={ESTADOS_CONSERVACION} value={n.estadoConservacion} onChange={(v) => niveles.cambiar(i, 'estadoConservacion', v)} />
              </Campo>
              <Campo id={id(`nivcat-${i}`)} label="Categorías (7)">
                <input
                  id={id(`nivcat-${i}`)}
                  value={n.categorias}
                  maxLength={7}
                  placeholder="CCDDEEF"
                  onChange={(e) => niveles.cambiar(i, 'categorias', e.target.value.toUpperCase().replace(/[^A-I-]/g, ''))}
                  className={`${CLASE} font-mono tracking-widest`}
                />
              </Campo>
              <Campo id={id(`nivarea-${i}`)} label="Área propia (m²)">
                <input id={id(`nivarea-${i}`)} value={n.areaPropia} inputMode="decimal" onChange={(e) => niveles.cambiar(i, 'areaPropia', decimal(e.target.value))} className={CLASE} />
              </Campo>
              <Campo id={id(`nivcomun-${i}`)} label="Área común / % part.">
                <div className="flex gap-1">
                  <input id={id(`nivcomun-${i}`)} value={n.areaComun} inputMode="decimal" onChange={(e) => niveles.cambiar(i, 'areaComun', decimal(e.target.value))} className={CLASE} />
                  <input aria-label="% de participación" value={n.participacion} inputMode="decimal" onChange={(e) => niveles.cambiar(i, 'participacion', decimal(e.target.value))} className={`${CLASE} w-16`} />
                </div>
              </Campo>
            </Fila>
          ))}
          <Agregar onClick={() => niveles.agregar({ ...NIVEL_VACIO, nivel: String(anexo.niveles.length + 1) })}>Agregar nivel</Agregar>
        </Bloque>

        <Bloque titulo="Obras complementarias">
          {anexo.obras.map((o, i) => (
            <Fila key={i} onQuitar={() => obras.quitar(i)} etiquetaQuitar={`Quitar obra ${i + 1}`}>
              <div className="sm:col-span-2">
                <Campo id={id(`obra-${i}`)} label="Descripción">
                  <input id={id(`obra-${i}`)} value={o.descripcion} maxLength={120} onChange={(e) => obras.cambiar(i, 'descripcion', e.target.value)} className={`${CLASE} uppercase`} />
                </Campo>
              </div>
              <Campo id={id(`obracant-${i}`)} label="Cantidad / unidad">
                <div className="flex gap-1">
                  <input id={id(`obracant-${i}`)} value={o.cantidad} inputMode="decimal" onChange={(e) => obras.cambiar(i, 'cantidad', decimal(e.target.value))} className={CLASE} />
                  <input aria-label="Unidad" value={o.unidad} maxLength={10} placeholder="m²" onChange={(e) => obras.cambiar(i, 'unidad', e.target.value)} className={`${CLASE} w-16`} />
                </div>
              </Campo>
              <Campo id={id(`obramed-${i}`)} label="Largo × ancho × alto">
                <div className="flex gap-1">
                  <input id={id(`obramed-${i}`)} value={o.largo} inputMode="decimal" onChange={(e) => obras.cambiar(i, 'largo', decimal(e.target.value))} className={CLASE} />
                  <input aria-label="Ancho" value={o.ancho} inputMode="decimal" onChange={(e) => obras.cambiar(i, 'ancho', decimal(e.target.value))} className={CLASE} />
                  <input aria-label="Alto" value={o.alto} inputMode="decimal" onChange={(e) => obras.cambiar(i, 'alto', decimal(e.target.value))} className={CLASE} />
                </div>
              </Campo>
              <Campo id={id(`obraanio-${i}`)} label="Año">
                <input id={id(`obraanio-${i}`)} value={o.anioConstruccion} maxLength={4} inputMode="numeric" onChange={(e) => obras.cambiar(i, 'anioConstruccion', entero(e.target.value))} className={CLASE} />
              </Campo>
              <Campo id={id(`obravalor-${i}`)} label="Valor declarado (S/)">
                <input id={id(`obravalor-${i}`)} value={o.valorDeclarado} inputMode="decimal" onChange={(e) => obras.cambiar(i, 'valorDeclarado', decimal(e.target.value))} className={CLASE} />
              </Campo>
            </Fila>
          ))}
          <Agregar onClick={() => obras.agregar({ ...OBRA_VACIA })}>Agregar obra</Agregar>
        </Bloque>

        {rustico && (
          <Bloque titulo="Aranceles rústicos *">
            {anexo.rusticos.map((r, i) => (
              <Fila key={i} onQuitar={() => rusticos.quitar(i)} etiquetaQuitar={`Quitar categoría ${i + 1}`}>
                <Campo id={id(`rcat-${i}`)} label="Categoría">
                  <input id={id(`rcat-${i}`)} value={r.categoria} maxLength={20} onChange={(e) => rusticos.cambiar(i, 'categoria', e.target.value)} className={`${CLASE} uppercase`} />
                </Campo>
                <Campo id={id(`rclas-${i}`)} label="Clasificación de tierras">
                  <input id={id(`rclas-${i}`)} value={r.clasificacion} maxLength={20} onChange={(e) => rusticos.cambiar(i, 'clasificacion', e.target.value)} className={`${CLASE} uppercase`} />
                </Campo>
                <Campo id={id(`rha-${i}`)} label="Hectáreas">
                  <input id={id(`rha-${i}`)} value={r.hectareas} inputMode="decimal" onChange={(e) => rusticos.cambiar(i, 'hectareas', decimal(e.target.value))} className={CLASE} />
                </Campo>
              </Fila>
            ))}
            <Agregar onClick={() => rusticos.agregar({ ...RUSTICO_VACIO })}>Agregar categoría</Agregar>
          </Bloque>
        )}

        <Bloque titulo={motivo === 'VENTA' ? 'Adquirientes *' : 'Adquirientes o transferentes'}>
          {anexo.adquirientes.map((x, i) => (
            <Fila key={i} onQuitar={() => adq.quitar(i)} etiquetaQuitar={`Quitar persona ${i + 1}`}>
              <Campo id={id(`adqrol-${i}`)} label="Rol">
                <select id={id(`adqrol-${i}`)} value={x.rol} onChange={(e) => adq.cambiar(i, 'rol', e.target.value)} className={CLASE}>
                  <option value="ADQUIRIENTE">Adquiriente</option>
                  <option value="TRANSFERENTE">Transferente</option>
                </select>
              </Campo>
              <Campo id={id(`adqdoc-${i}`)} label="Documento">
                <div className="flex gap-1">
                  <Select id={id(`adqdoc-${i}`)} items={tiposDoc.filter((t) => t.codigo !== 'SIN_DOCUMENTO')} value={x.tipoDoc} vacio={false} onChange={(v) => adq.cambiar(i, 'tipoDoc', v)} />
                  <input aria-label="Número de documento" value={x.numDoc} maxLength={20} onChange={(e) => adq.cambiar(i, 'numDoc', e.target.value)} className={CLASE} />
                </div>
              </Campo>
              <div className="sm:col-span-2">
                <Campo id={id(`adqnom-${i}`)} label="Nombre o razón social">
                  <input id={id(`adqnom-${i}`)} value={x.nombreCompleto} maxLength={120} onChange={(e) => adq.cambiar(i, 'nombreCompleto', e.target.value)} className={`${CLASE} uppercase`} />
                </Campo>
              </div>
              <div className="sm:col-span-2">
                <Campo id={id(`adqdir-${i}`)} label="Dirección">
                  <input id={id(`adqdir-${i}`)} value={x.direccion} maxLength={250} onChange={(e) => adq.cambiar(i, 'direccion', e.target.value)} className={`${CLASE} uppercase`} />
                </Campo>
              </div>
              <Campo id={id(`adqtr-${i}`)} label="Documento de transferencia">
                <Select id={id(`adqtr-${i}`)} items={docsTransferencia} value={x.documentoTransferencia} onChange={(v) => adq.cambiar(i, 'documentoTransferencia', v)} />
              </Campo>
            </Fila>
          ))}
          <Agregar onClick={() => adq.agregar(ADQUIRIENTE_VACIO(motivo === 'COMPRA' ? 'TRANSFERENTE' : 'ADQUIRIENTE'))}>Agregar persona</Agregar>
        </Bloque>

        <Campo id={id('obs')} label="Observación del anexo">
          <input id={id('obs')} value={anexo.observacion} maxLength={250} onChange={(e) => set('observacion', e.target.value)} className={CLASE} />
        </Campo>
      </div>
    </section>
  )
}

// Predio del padrón (búsqueda) o uno nuevo con su dirección única (solo inscripción o adquisición).
function ElegirPredio({
  id,
  anexo,
  puedeCrear,
  onPredio,
  onNuevo,
}: {
  id: string
  anexo: AnexoForm
  puedeCrear: boolean
  onPredio: (p: PredioElegido | null) => void
  onNuevo: (n: AnexoForm['nuevo']) => void
}) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<PredioBuscado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const consulta = texto.trim()
  const visibles = consulta.length >= 1 ? resultados : null

  useEffect(() => {
    if (!consulta) return
    let vivo = true
    const t = setTimeout(() => {
      api
        .get<{ items: PredioBuscado[] }>('/predios', { params: { q: consulta, limit: 8 } })
        .then(({ data }) => {
          if (vivo) {
            setResultados(data.items)
            setError(null)
          }
        })
        .catch((err) => vivo && setError(mensajeError(err)))
    }, 250)
    return () => {
      vivo = false
      clearTimeout(t)
    }
  }, [consulta])

  if (anexo.predio) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
        <span className="font-medium text-mar-profundo">
          {anexo.predio.etiqueta}
          {anexo.predio.tipo === 'RUSTICO' && <span className="ml-2 text-xs text-slate-500">Rústico</span>}
        </span>
        <button type="button" onClick={() => onPredio(null)} className="rounded-md px-2 py-1 text-xs font-medium text-mar hover:bg-white focus-visible:outline-3 focus-visible:outline-turquesa">
          Cambiar predio
        </button>
      </div>
    )
  }

  if (anexo.nuevo) {
    const n = anexo.nuevo
    return (
      <div className="space-y-3 rounded-md border border-borde p-3">
        <p className="text-sm font-semibold text-mar-profundo">Predio nuevo (queda inactivo hasta liquidar la DJ)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo id={`${id}-tipo`} label="Tipo">
            <select id={`${id}-tipo`} value={n.tipo} onChange={(e) => onNuevo({ ...n, tipo: e.target.value as 'URBANO' | 'RUSTICO' })} className={CLASE}>
              <option value="URBANO">Urbano</option>
              <option value="RUSTICO">Rústico</option>
            </select>
          </Campo>
          <Campo id={`${id}-catastro`} label="Código catastral">
            <input id={`${id}-catastro`} value={n.codigoCatastro} maxLength={20} onChange={(e) => onNuevo({ ...n, codigoCatastro: e.target.value })} className={`${CLASE} uppercase`} />
          </Campo>
          <Campo id={`${id}-nombre`} label="Nombre (opcional)">
            <input id={`${id}-nombre`} value={n.nombre} maxLength={120} onChange={(e) => onNuevo({ ...n, nombre: e.target.value })} className={`${CLASE} uppercase`} />
          </Campo>
        </div>
        <Campo id={`${id}-dir`} label="Dirección del predio *">
          <SelectorDireccion id={`${id}-dir`} valor={n.direccion} onChange={(d) => onNuevo({ ...n, direccion: d })} />
        </Campo>
        <button type="button" onClick={() => onNuevo(null)} className="text-xs font-medium text-mar hover:underline">
          Elegir un predio del padrón
        </button>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor={`${id}-buscar`} className="sr-only">
        Buscar predio
      </label>
      <input
        id={`${id}-buscar`}
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="N° de predio, código catastral, nombre o dirección"
        className={CLASE}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-ladrillo">
          {error}
        </p>
      )}
      {visibles && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-md ring-1 ring-slate-200" aria-label="Predios encontrados">
          {visibles.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Sin predios para "{consulta}".</li>}
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPredio({ id: p.id, etiqueta: etiquetaPredio(p), tipo: p.tipo })}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-turquesa"
              >
                <span className="font-medium text-mar-profundo">{etiquetaPredio(p)}</span>
                <span className="block text-xs text-slate-500">
                  {p.contribuyentes.map((t) => `${t.contribuyente.nombreCompleto} ${Number(t.porcentaje)}%`).join(' · ') || 'Sin titulares'}
                  {p.estado === 'INACTIVO' && ' · inactivo (DJ sin liquidar)'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {puedeCrear && (
        <button
          type="button"
          onClick={() => onNuevo({ tipo: 'URBANO', direccion: null, codigoCatastro: '', nombre: '' })}
          className="mt-2 rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
        >
          <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
          Registrar predio nuevo
        </button>
      )}
    </div>
  )
}

export function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  )
}

export function Campo({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="text-sm">
      <label htmlFor={id} className="block text-xs text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}

function Fila({ children, onQuitar, etiquetaQuitar }: { children: ReactNode; onQuitar: () => void; etiquetaQuitar: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-slate-50 p-2">
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-4">{children}</div>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={etiquetaQuitar}
        title={etiquetaQuitar}
        className="mt-5 rounded-md p-2 text-slate-500 hover:bg-ladrillo/10 hover:text-ladrillo focus-visible:outline-3 focus-visible:outline-turquesa"
      >
        <i aria-hidden="true" className="bi bi-x-lg" />
      </button>
    </div>
  )
}

function Agregar({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-mar-profundo/30 px-3 py-1.5 text-xs font-medium text-mar-profundo hover:bg-mar/5 focus-visible:outline-3 focus-visible:outline-turquesa"
    >
      <i aria-hidden="true" className="bi bi-plus-lg mr-1" />
      {children}
    </button>
  )
}

export function Select({ id, items, value, onChange, vacio = true }: { id: string; items: ItemCatalogo[]; value: string; onChange: (v: string) => void; vacio?: boolean }) {
  const falta = value && !items.some((i) => i.codigo === value)
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={CLASE}>
      {vacio && <option value="">—</option>}
      {falta && <option value={value}>{value}</option>}
      {items.map((i) => (
        <option key={i.codigo} value={i.codigo}>
          {i.nombre}
        </option>
      ))}
    </select>
  )
}

function SelectFijo({ id, opciones, value, onChange }: { id: string; opciones: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={CLASE}>
      {opciones.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
