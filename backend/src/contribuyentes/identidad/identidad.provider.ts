import { Injectable } from '@nestjs/common';

// Proveedor de identidad: ApiPeruDev (https://docs.apiperu.dev), plan gratuito.
// Su contrato es `code` + `retryable`; `message` es solo texto legible. Acá se mapea a un motivo
// propio para que el servicio decida el HTTP y el formulario decida el mensaje.

export type MotivoIdentidad =
  | 'SIN_KEY' // sin clave, o clave rechazada por el proveedor
  | 'FORMATO' // el documento no tiene un formato consultable
  | 'NO_ENCONTRADO' // la consulta funcionó y el documento no existe
  | 'CUPO' // cupo mensual agotado
  | 'REINTENTAR' // red caída, timeout o proveedor momentáneamente fuera
  | 'PROVEEDOR'; // cualquier otra cosa rara

export class IdentidadError extends Error {
  constructor(
    readonly motivo: MotivoIdentidad,
    message: string,
  ) {
    super(message);
    this.name = 'IdentidadError';
  }
}

export interface DatosIdentidad {
  nombreCompleto: string;
  // Solo RUC: estado y condición del padrón SUNAT (informativo, no se guarda).
  estado: string | null;
  condicion: string | null;
  // Solo RUC: el domicilio fiscal como texto de apoyo, para completar a mano.
  direccionExterna: string | null;
  // Solo RUC: ubigeo del domicilio fiscal en SUNAT (6 dígitos). El DNI del plan gratuito no trae.
  ubigeo: string | null;
}

interface RespuestaExterna {
  success?: boolean;
  code?: string;
  retryable?: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export interface IdentidadConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

const BASE_DEFECTO = 'https://api.apiperu.dev';

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio || null;
}

@Injectable()
export class IdentidadProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: IdentidadConfig) {
    this.baseUrl = (config.baseUrl || BASE_DEFECTO).replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs || 6000;
  }

  async consultar(tipoDoc: string, numDoc: string): Promise<DatosIdentidad> {
    if (!this.config.apiKey) {
      throw new IdentidadError('SIN_KEY', 'IDENTIDAD_API_KEY no está configurada');
    }
    const esRuc = tipoDoc === 'RUC';
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${esRuc ? '/ruc' : '/dni'}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(esRuc ? { ruc: numDoc } : { dni: numDoc }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new IdentidadError('REINTENTAR', `Sin conexión con el servicio de identidad: ${(e as Error).message}`);
    }

    const json = (await res.json().catch(() => ({}))) as RespuestaExterna;
    this.verificar(res.status, json);
    return this.normalizar(tipoDoc, json.data ?? {});
  }

  // Traduce el código del proveedor al motivo propio. `retryable` decide si algo se puede reintentar.
  private verificar(status: number, json: RespuestaExterna): void {
    if (status === 401 || status === 403) {
      throw new IdentidadError('SIN_KEY', 'IDENTIDAD_API_KEY inválida o sin acceso a este endpoint');
    }
    if (status === 429 || json.code === 'quota_exceeded') {
      throw new IdentidadError('CUPO', 'El cupo mensual de consultas de identidad está agotado');
    }
    if (status === 404 || json.code === 'document_not_found') {
      throw new IdentidadError('NO_ENCONTRADO', 'El documento no existe en el padrón de identidad');
    }
    if (status === 400 || json.code === 'invalid_input') {
      throw new IdentidadError('FORMATO', 'El documento no tiene un formato consultable');
    }
    if (status === 503 || json.code === 'upstream_unavailable' || json.retryable) {
      throw new IdentidadError('REINTENTAR', 'El servicio de identidad no está disponible ahora. Intenta nuevamente.');
    }
    if (status < 200 || status >= 300 || json.success === false) {
      throw new IdentidadError('PROVEEDOR', `Respuesta inesperada del servicio de identidad (${status})`);
    }
  }

  private normalizar(tipoDoc: string, data: Record<string, unknown>): DatosIdentidad {
    if (tipoDoc === 'RUC') {
      const razonSocial = texto(data.nombre_o_razon_social);
      if (!razonSocial) {
        throw new IdentidadError('PROVEEDOR', 'El servicio de identidad no devolvió la razón social');
      }
      // `ubigeo` viene como array ["15","1501","150101"]; el que sirve es `ubigeo_sunat`.
      const ubigeo = texto(data.ubigeo_sunat);
      return {
        nombreCompleto: razonSocial,
        estado: texto(data.estado),
        condicion: texto(data.condicion),
        direccionExterna: texto(data.direccion_completa) ?? texto(data.direccion),
        ubigeo: ubigeo && /^\d{6}$/.test(ubigeo) ? ubigeo : null,
      };
    }
    // El DNI del plan gratuito solo trae nombres: sin dirección, teléfono ni correo.
    const nombre =
      texto(data.nombre_completo) ??
      [texto(data.apellido_paterno), texto(data.apellido_materno), texto(data.nombres)]
        .filter((p): p is string => Boolean(p))
        .join(' ')
        .trim();
    if (!nombre) {
      throw new IdentidadError('PROVEEDOR', 'El servicio de identidad no devolvió el nombre');
    }
    return { nombreCompleto: nombre, estado: null, condicion: null, direccionExterna: null, ubigeo: null };
  }
}
