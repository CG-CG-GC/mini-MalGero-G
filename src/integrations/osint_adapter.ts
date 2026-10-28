/**
 * Integración OSINT Opcional y Desacoplada (Sección 18 y 17 del Contrato Técnico)
 * Mini-Maltego Académico — v1.0 (AED3)
 *
 * REGLA ARQUITECTÓNICA (Sección 18):
 * Flujo obligatorio:
 *   API externa (DNS over HTTPS / RDAP público)
 *       ↓
 *   Adaptador / integración
 *       ↓
 *   Validación
 *       ↓
 *   Normalización (D-02)
 *       ↓
 *   Entidad / Relación (Modelo de dominio)
 *       ↓
 *   Persistencia (SQLite)
 *       ↓
 *   Grafo (Lista de adyacencia)
 *
 * NUNCA: Grafo -> API externa, ni API externa -> BD sin validación intermedia.
 */

import { TipoEntidad, normalizarValorEntidad } from '../domain/entidad.ts';
import { TipoRelacion } from '../domain/relacion.ts';
import { ServicioCoordinadorGrafo } from '../services/grafo_service.ts';

export interface ResultadoEnriquecimientoOSINT {
  dominioConsultado: string;
  fuenteConsultada: string;
  entidadesCreadasOExistentes: string[];
  relacionesCreadas: string[];
  registrosDetectados: Array<{
    tipo: string;
    valor: string;
    ttl?: number;
  }>;
}

interface RespuestaDoHGoogle {
  Status?: number;
  Answer?: Array<{
    name: string;
    type: number;
    TTL: number;
    data: string;
  }>;
}

export class AdaptadorOSINTDominio {
  private readonly coordinador: ServicioCoordinadorGrafo;

  constructor(coordinador: ServicioCoordinadorGrafo) {
    this.coordinador = coordinador;
  }

  /**
   * Consulta pasiva/no intrusiva de registros DNS públicos (A) mediante DNS-over-HTTPS
   * para un dominio existente en el grafo o ingresado por el usuario,
   * validando y normalizando cada dato antes de pasarlo al servicio de aplicación.
   */
  public async enriquecerDominioDNS(dominioEntrada: string): Promise<ResultadoEnriquecimientoOSINT> {
    // 1. Validación y normalización estricta del dominio de entrada
    const dominioNorm = normalizarValorEntidad(TipoEntidad.DOMINIO, dominioEntrada);

    // 2. Asegurar que la entidad DOMINIO exista en el sistema (vía Servicio Coordinador)
    let estado = this.coordinador.obtenerEstadoCompleto();
    let entidadDominio = estado.entidades.find(
      (e) => e.tipo === TipoEntidad.DOMINIO && e.valor_normalizado === dominioNorm
    );

    const entidadesAfectadas: string[] = [];
    const relacionesCreadas: string[] = [];

    if (!entidadDominio) {
      entidadDominio = this.coordinador.crearEntidad({
        tipo: TipoEntidad.DOMINIO,
        valor: dominioNorm,
        descripcion: `Dominio verificado mediante adaptador OSINT DNS.`,
        metadata: { origen_carga: 'Adaptador OSINT DNS-over-HTTPS' },
      });
    }
    entidadesAfectadas.push(entidadDominio.id);

    // 3. Consulta externa DNS-over-HTTPS (Google Public DNS API para registros tipo A = 1)
    const url = `https://dns.google/resolve?name=${encodeURIComponent(dominioNorm)}&type=A`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let respuestaJson: RespuestaDoHGoogle = {};
    try {
      const resp = await fetch(url, {
        headers: { Accept: 'application/dns-json' },
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new Error(`Respuesta HTTP ${resp.status} desde servicio DNS público.`);
      }
      respuestaJson = (await resp.json()) as RespuestaDoHGoogle;
    } finally {
      clearTimeout(timeout);
    }

    const registrosDetectados: Array<{ tipo: string; valor: string; ttl?: number }> = [];
    const answers = Array.isArray(respuestaJson.Answer) ? respuestaJson.Answer : [];

    for (const ans of answers) {
      // Tipo 1 = Registro A (IPv4)
      if (ans.type === 1 && typeof ans.data === 'string') {
        try {
          const ipNorm = normalizarValorEntidad(TipoEntidad.IP, ans.data);
          registrosDetectados.push({ tipo: 'A', valor: ipNorm, ttl: ans.TTL });

          // Buscar si la IP ya existe
          estado = this.coordinador.obtenerEstadoCompleto();
          let entidadIp = estado.entidades.find(
            (e) => e.tipo === TipoEntidad.IP && e.valor_normalizado === ipNorm
          );

          if (!entidadIp) {
            entidadIp = this.coordinador.crearEntidad({
              tipo: TipoEntidad.IP,
              valor: ipNorm,
              descripcion: `Dirección IPv4 resuelta para ${dominioNorm} (TTL ${ans.TTL}s)`,
              metadata: { dns_record_type: 'A', ttl: String(ans.TTL) },
            });
          }
          if (!entidadesAfectadas.includes(entidadIp.id)) {
            entidadesAfectadas.push(entidadIp.id);
          }

          // Crear relación dirigida DOMINIO --[APUNTA_A]--> IP si no existe
          const yaExisteRel = estado.relaciones.some(
            (r) =>
              r.origen_id === entidadDominio!.id &&
              r.destino_id === entidadIp!.id &&
              r.tipo === TipoRelacion.APUNTA_A
          );

          if (!yaExisteRel) {
            const nuevaRel = this.coordinador.crearRelacion({
              origen_id: entidadDominio.id,
              destino_id: entidadIp.id,
              tipo: TipoRelacion.APUNTA_A,
              descripcion: `Resolución DNS registro A hacia ${ipNorm}`,
              evidencias: [
                {
                  source: 'DNS-over-HTTPS (dns.google)',
                  description: `Registro A verificado: ${dominioNorm} -> ${ipNorm} (TTL: ${ans.TTL}s)`,
                },
              ],
            });
            relacionesCreadas.push(nuevaRel.id);
          }
        } catch {
          // Si un registro externo no pasa la validación/normalización de IP, se descarta (Sección 17)
        }
      }
    }

    return {
      dominioConsultado: dominioNorm,
      fuenteConsultada: 'Google Public DNS-over-HTTPS (RFC 8484)',
      entidadesCreadasOExistentes: entidadesAfectadas,
      relacionesCreadas,
      registrosDetectados,
    };
  }
}
