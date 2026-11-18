import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { RUTA_DJ } from '../declaraciones/djApi'

// Rentas v2, Fase 6: el formulario de DJ de v1 (una DJ por predio) se retiró. Sus rutas
// (/predios/nuevo y /predios/:id/declaracion) llevan a la DJ presentada con lo mismo precargado.
export function RedirigeDjV1() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const q = new URLSearchParams()
  const declarante = params.get('declarante')
  if (declarante) q.set('contribuyente', declarante)
  const motivo = params.get('motivo') ?? (id ? null : 'INSCRIPCION')
  if (motivo) q.set('motivo', motivo)
  if (id) q.set('predio', id)
  const consulta = q.toString()
  return <Navigate to={`${RUTA_DJ}/nueva${consulta ? `?${consulta}` : ''}`} replace />
}
