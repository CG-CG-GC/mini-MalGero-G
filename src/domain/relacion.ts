/**
 * Modelo de Dominio: Relación Dirigida
 * Representa una arista dirigida: Entidad origen -> Relación -> Entidad destino
 * Mini-Maltego Académico — v1.0 (AED3)
 */

import { Evidencia, EvidenciaData } from './evidencia.ts';

export enum TipoRelacion {
  POSEE = 'POSEE',
  UTILIZA = 'UTILIZA',
  TRABAJA_EN = 'TRABAJA_EN',
  ADMINISTRA = 'ADMINISTRA',
  PERTENECE_A = 'PERTENECE_A',
  APUNTA_A = 'APUNTA_A',
}

export const TIPOS_RELACION_VALIDOS = Object.values(TipoRelacion);

export interface RelacionData {
  id: string;
  origen_id: string;
  destino_id: string;
  tipo: TipoRelacion;
  descripcion: string;
  fecha: string;
  evidencias: EvidenciaData[];
}

export class Relacion implements RelacionData {
  public readonly id: string;
  public readonly origen_id: string;
  public readonly destino_id: string;
  public readonly tipo: TipoRelacion;
  public readonly descripcion: string;
  public readonly fecha: string;
  private readonly _evidencias: Evidencia[];

  constructor(params: {
    id: string;
    origen_id: string;
    destino_id: string;
    tipo: TipoRelacion;
    descripcion?: string;
    fecha?: string;
    evidencias?: Evidencia[];
  }) {
    if (!params.id || !params.id.trim()) {
      throw new Error('El id de la relación es obligatorio.');
    }
    if (!params.origen_id || !params.origen_id.trim()) {
      throw new Error('La entidad origen es obligatoria.');
    }
    if (!params.destino_id || !params.destino_id.trim()) {
      throw new Error('La entidad destino es obligatoria.');
    }
    if (!TIPOS_RELACION_VALIDOS.includes(params.tipo)) {
      throw new Error(`Tipo de relación inválido: ${params.tipo}`);
    }

    this.id = params.id.trim();
    this.origen_id = params.origen_id.trim();
    this.destino_id = params.destino_id.trim();
    this.tipo = params.tipo;
    this.descripcion = (params.descripcion ?? '').trim();
    this.fecha = (params.fecha || new Date().toISOString().split('T')[0]).trim();
    this._evidencias = params.evidencias ? [...params.evidencias] : [];
  }

  public get evidencias(): EvidenciaData[] {
    return this._evidencias.map((e) => e.toJSON());
  }

  public agregarEvidencia(evidencia: Evidencia): void {
    if (this._evidencias.some((e) => e.id === evidencia.id)) {
      throw new Error(`La evidencia con id "${evidencia.id}" ya existe en esta relación.`);
    }
    this._evidencias.push(evidencia);
  }

  public toJSON(): RelacionData {
    return {
      id: this.id,
      origen_id: this.origen_id,
      destino_id: this.destino_id,
      tipo: this.tipo,
      descripcion: this.descripcion,
      fecha: this.fecha,
      evidencias: this.evidencias,
    };
  }
}
