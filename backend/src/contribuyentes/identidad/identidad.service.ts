import {
  BadRequestException,
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, TipoPersona } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { formatoConsultable, normalizarDocumento, tipoPersonaDeRuc } from '../documento.js';
import { ConsultarIdentidadDto } from '../dto/contribuyente.dto.js';
import { DatosIdentidad, IdentidadError, IdentidadProvider } from './identidad.provider.js';

// Caché de aciertos para no gastar el cupo mensual consultando dos veces el mismo documento.
const TTL_DIAS = 30;

interface ConsultaCache {
  tipoPersona: TipoPersona;
  nombreCompleto: string;
  estado: string | null;
  condicion: string | null;
  direccionExterna: string | null;
}

// Lo que rellena el formulario cuando el documento salió del padrón o de la caché.
interface DatosParaFormulario {
  contribuyenteId: null;
  tipoPersona: TipoPersona;
  nombreCompleto: string;
  estado: string | null;
  condicion: string | null;
  direccionExterna: string | null;
}

// Lo que ve el formulario. `origen` dice de dónde salió y si sirve para rellenar o solo para avisar.
export type ResultadoIdentidad =
  | {
      origen: 'propia';
      contribuyenteId: number;
      tipoPersona: TipoPersona;
      nombreCompleto: string;
      estado: string;
    }
  | {
      origen: 'cache' | 'externa';
      contribuyenteId: null;
      tipoPersona: TipoPersona;
      nombreCompleto: string;
      estado: string | null;
      condicion: string | null;
      direccionExterna: string | null;
      consultadoEn: string;
    };

@Injectable()
export class IdentidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proveedor: IdentidadProvider,
  ) {}

  async consultar(dto: ConsultarIdentidadDto): Promise<ResultadoIdentidad> {
    const tipoDoc = dto.tipoDoc;
    const numDoc = normalizarDocumento(dto.numDoc);
    // CE y pasaporte no tienen API: el botón no debería haber aparecido, pero por si acaso.
    if (!formatoConsultable(tipoDoc, numDoc)) {
      throw new BadRequestException('Este documento no se puede consultar en el padrón de identidad');
    }

    // 1. ¿Ya está inscrito? Gratis, sin gastar cupo, y evita el 409 del alta.
    const ya = await this.prisma.contribuyente.findFirst({
      where: { numDoc, ...(dto.excluirId ? { id: { not: dto.excluirId } } : {}) },
      select: { id: true, tipoPersona: true, nombreCompleto: true, estado: true },
    });
    if (ya) {
      return {
        origen: 'propia',
        contribuyenteId: ya.id,
        tipoPersona: ya.tipoPersona,
        nombreCompleto: ya.nombreCompleto,
        estado: ya.estado,
      };
    }

    // 2. Caché local: solo aciertos, con TTL.
    const cache = await this.prisma.consultaIdentidad.findUnique({
      where: { tipoDoc_numDoc: { tipoDoc, numDoc } },
    });
    if (cache && this.vigente(cache.consultadoAt)) {
      return {
        ...this.desdeCache(cache.datos as unknown as ConsultaCache),
        origen: 'cache',
        consultadoEn: cache.consultadoAt.toISOString(),
      };
    }

    // 3. Proveedor externo.
    let datos: DatosIdentidad;
    try {
      datos = await this.proveedor.consultar(tipoDoc, numDoc);
    } catch (e) {
      if (e instanceof IdentidadError) throw this.excepcion(e);
      throw e;
    }

    await this.guardar(tipoDoc, numDoc, this.payload(tipoDoc, numDoc, datos));
    return {
      ...this.desdeCache(this.payload(tipoDoc, numDoc, datos)),
      origen: 'externa',
      consultadoEn: new Date().toISOString(),
    };
  }

  private desdeCache(datos: ConsultaCache): DatosParaFormulario {
    return {
      contribuyenteId: null,
      tipoPersona: datos.tipoPersona,
      nombreCompleto: datos.nombreCompleto,
      estado: datos.estado,
      condicion: datos.condicion,
      direccionExterna: datos.direccionExterna,
    };
  }

  private vigente(consultadoAt: Date): boolean {
    const umbral = Date.now() - TTL_DIAS * 24 * 60 * 60 * 1000;
    return consultadoAt.getTime() > umbral;
  }

  // El RUC 20 es jurídico; el resto de los RUC son personas naturales. El proveedor no decide esto.
  private payload(tipoDoc: string, numDoc: string, datos: DatosIdentidad): ConsultaCache {
    return {
      tipoPersona: tipoDoc === 'RUC' ? tipoPersonaDeRuc(numDoc) : TipoPersona.NATURAL,
      nombreCompleto: datos.nombreCompleto,
      estado: datos.estado,
      condicion: datos.condicion,
      direccionExterna: datos.direccionExterna,
    };
  }

  // Guarda el acierto y aprovecha para podar lo que ya venció (sin cron: perezoso en cada escritura).
  private async guardar(tipoDoc: string, numDoc: string, payload: ConsultaCache): Promise<void> {
    // Prisma pide InputJsonValue y la interfaz no lleva firma de índice: mismo objeto, otro tipo.
    const json = payload as unknown as Prisma.InputJsonValue;
    const vencido = new Date(Date.now() - TTL_DIAS * 24 * 60 * 60 * 1000);
    await Promise.all([
      this.prisma.consultaIdentidad.upsert({
        where: { tipoDoc_numDoc: { tipoDoc, numDoc } },
        create: { tipoDoc, numDoc, datos: json },
        update: { datos: json, consultadoAt: new Date() },
      }),
      this.prisma.consultaIdentidad.deleteMany({ where: { consultadoAt: { lt: vencido } } }),
    ]);
  }

  private excepcion(e: IdentidadError): Error {
    switch (e.motivo) {
      case 'FORMATO':
        return new BadRequestException(e.message);
      case 'NO_ENCONTRADO':
        return new NotFoundException(e.message);
      case 'CUPO':
        // Nest no trae excepción para 429: se arma a mano con HttpStatus.
        return new HttpException(e.message, HttpStatus.TOO_MANY_REQUESTS);
      case 'SIN_KEY':
      case 'REINTENTAR':
        return new ServiceUnavailableException(e.message);
      case 'PROVEEDOR':
      default:
        return new BadGatewayException(e.message);
    }
  }
}
