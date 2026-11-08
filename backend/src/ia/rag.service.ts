import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { vectorLiteral } from './ingesta.logic.js';
import { FragmentoRecuperado } from './prompt.js';

// Recuperación top-k por similitud coseno (pgvector `<=>` = distancia coseno).
@Injectable()
export class RagService {
  private readonly topK: number;
  private readonly similitudMin: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.topK = Number(config.get('IA_TOP_K') ?? 5);
    this.similitudMin = Number(config.get('IA_SIMILITUD_MIN') ?? 0.6);
  }

  async buscar(embedding: number[]): Promise<FragmentoRecuperado[]> {
    const vec = vectorLiteral(embedding);
    const filas = await this.prisma.$queryRaw<FragmentoRecuperado[]>`
      SELECT f.id, d.archivo, d.titulo, f.seccion, f.contenido,
             (1 - (f.embedding <=> ${vec}::vector))::float8 AS similitud
        FROM ia_fragmento f
        JOIN ia_documento d ON d.id = f."documentoId"
       WHERE f.embedding IS NOT NULL
       ORDER BY f.embedding <=> ${vec}::vector
       LIMIT ${this.topK}`;
    return filas.filter((f) => f.similitud >= this.similitudMin);
  }
}
