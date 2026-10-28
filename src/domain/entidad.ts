/**
 * Modelo de Dominio: Entidad y Reglas de Normalización (D-02)
 * Mini-Maltego Académico — v1.0 (AED3)
 */

export enum TipoEntidad {
  PERSONA = 'PERSONA',
  ORGANIZACION = 'ORGANIZACION',
  EMAIL = 'EMAIL',
  USUARIO = 'USUARIO',
  DOMINIO = 'DOMINIO',
  SITIO_WEB = 'SITIO_WEB',
  IP = 'IP',
}

export const TIPOS_ENTIDAD_VALIDOS = Object.values(TipoEntidad);

export interface EntidadData {
  id: string;
  tipo: TipoEntidad;
  valor: string;
  valor_normalizado: string;
  descripcion: string;
  metadata: Record<string, string>;
}

/**
 * Reglas explícitas de normalización (D-02) para garantizar unicidad por (tipo + valor_normalizado):
 * - EMAIL: trim, minúsculas, validación de formato básico usuario@dominio
 * - DOMINIO: trim, minúsculas, remoción de protocolo http(s)://, www. inicial y barra final
 * - SITIO_WEB: trim, esquema http/https normalizado, host en minúsculas, sin barra final redundante
 * - IP: trim, validación y normalización de octetos IPv4 o formato IPv6
 * - USUARIO: trim, minúsculas, remoción de '@' inicial si existe
 * - PERSONA / ORGANIZACION: trim, colapso de espacios múltiples, Title Case consistente
 */
export function normalizarValorEntidad(tipo: TipoEntidad, valorCrudo: string): string {
  const limpio = (valorCrudo || '').trim();
  if (!limpio) {
    throw new Error('El valor de la entidad no puede estar vacío.');
  }

  switch (tipo) {
    case TipoEntidad.EMAIL: {
      const norm = limpio.toLowerCase();
      const partes = norm.split('@');
      if (partes.length !== 2 || !partes[0] || !partes[1] || !partes[1].includes('.')) {
        throw new Error(`Formato de EMAIL inválido: "${valorCrudo}". Debe contener usuario@dominio.`);
      }
      return norm;
    }

    case TipoEntidad.DOMINIO: {
      let norm = limpio.toLowerCase();
      norm = norm.replace(/^https?:\/\//i, '');
      norm = norm.split('/')[0];
      norm = norm.replace(/^www\./i, '');
      norm = norm.replace(/\.$/, '');
      if (!norm || !norm.includes('.') || /\s/.test(norm)) {
        throw new Error(`Formato de DOMINIO inválido: "${valorCrudo}". Ejemplo válido: "ejemplo.org".`);
      }
      return norm;
    }

    case TipoEntidad.SITIO_WEB: {
      let urlStr = limpio;
      if (!/^https?:\/\//i.test(urlStr)) {
        urlStr = 'https://' + urlStr;
      }
      try {
        const parsed = new URL(urlStr);
        const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
        return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${parsed.port ? ':' + parsed.port : ''}${path}${parsed.search}`;
      } catch {
        throw new Error(`Formato de SITIO_WEB inválido: "${valorCrudo}".`);
      }
    }

    case TipoEntidad.IP: {
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      const match = limpio.match(ipv4Regex);
      if (match) {
        const octetos = [match[1], match[2], match[3], match[4]].map((o) => parseInt(o, 10));
        if (octetos.some((n) => n < 0 || n > 255)) {
          throw new Error(`Dirección IPv4 fuera de rango (0-255): "${valorCrudo}".`);
        }
        return octetos.join('.');
      }
      // Soporte básico IPv6 si contiene ':'
      if (limpio.includes(':')) {
        return limpio.toLowerCase();
      }
      throw new Error(`Formato de dirección IP inválido: "${valorCrudo}".`);
    }

    case TipoEntidad.USUARIO: {
      const sinArroba = limpio.replace(/^@+/, '').toLowerCase();
      if (!sinArroba || /\s/.test(sinArroba)) {
        throw new Error(`Formato de USUARIO inválido: "${valorCrudo}" (no debe contener espacios).`);
      }
      return sinArroba;
    }

    case TipoEntidad.PERSONA:
    case TipoEntidad.ORGANIZACION: {
      const colapsado = limpio.replace(/\s+/g, ' ');
      return colapsado
        .split(' ')
        .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase())
        .join(' ');
    }

    default:
      throw new Error(`Tipo de entidad no soportado: ${tipo}`);
  }
}

export class Entidad implements EntidadData {
  public readonly id: string;
  public readonly tipo: TipoEntidad;
  public readonly valor: string;
  public readonly valor_normalizado: string;
  public readonly descripcion: string;
  public readonly metadata: Record<string, string>;

  constructor(params: {
    id: string;
    tipo: TipoEntidad;
    valor: string;
    valor_normalizado?: string;
    descripcion?: string;
    metadata?: Record<string, string>;
  }) {
    if (!params.id || !params.id.trim()) {
      throw new Error('El identificador (id) de la entidad es obligatorio.');
    }
    if (!TIPOS_ENTIDAD_VALIDOS.includes(params.tipo)) {
      throw new Error(`Tipo de entidad inválido: ${params.tipo}`);
    }
    this.id = params.id.trim();
    this.tipo = params.tipo;
    this.valor = params.valor.trim();
    this.valor_normalizado = params.valor_normalizado ?? normalizarValorEntidad(params.tipo, params.valor);
    this.descripcion = (params.descripcion ?? '').trim();
    this.metadata = params.metadata ? { ...params.metadata } : {};
  }

  public toJSON(): EntidadData {
    return {
      id: this.id,
      tipo: this.tipo,
      valor: this.valor,
      valor_normalizado: this.valor_normalizado,
      descripcion: this.descripcion,
      metadata: { ...this.metadata },
    };
  }
}
