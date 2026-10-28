/**
 * Modelo de Dominio: Evidencia
 * Representa la procedencia o respaldo documental de una relación OSINT.
 * Mini-Maltego Académico — v1.0 (AED3)
 */

export interface EvidenciaData {
  id: string;
  source: string;
  description: string;
  date: string;
}

export class Evidencia implements EvidenciaData {
  public readonly id: string;
  public readonly source: string;
  public readonly description: string;
  public readonly date: string;

  constructor(params: {
    id: string;
    source: string;
    description: string;
    date?: string;
  }) {
    if (!params.id || !params.id.trim()) {
      throw new Error('El id de la evidencia es obligatorio.');
    }
    if (!params.source || !params.source.trim()) {
      throw new Error('La fuente (source) de la evidencia es obligatoria.');
    }
    if (!params.description || !params.description.trim()) {
      throw new Error('La descripción de la evidencia es obligatoria.');
    }

    this.id = params.id.trim();
    this.source = params.source.trim();
    this.description = params.description.trim();
    this.date = (params.date || new Date().toISOString().split('T')[0]).trim();
  }

  public toJSON(): EvidenciaData {
    return {
      id: this.id,
      source: this.source,
      description: this.description,
      date: this.date,
    };
  }
}
