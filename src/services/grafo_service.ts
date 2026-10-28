/**
 * Capa de Servicios de Aplicación y Coordinación Transaccional BD <-> Grafo (Sección 14 y D-04)
 * Mini-Maltego Académico — v1.0 (AED3)
 *
 * Responsabilidad:
 * - Coordinar el Repositorio SQLite (persistencia relacional) y el Motor del Grafo Dirigido (memoria).
 * - El motor del grafo NUNCA ejecuta SQL directamente.
 * - Garantizar que una operación sólo se considere completada si ambos estados quedan consistentes.
 * - Ante cualquier fallo en memoria tras persistir, revertir en BD o resincronizar íntegramente desde SQLite.
 */

import { Entidad, EntidadData, TipoEntidad, normalizarValorEntidad } from '../domain/entidad.ts';
import { Relacion, RelacionData, TipoRelacion } from '../domain/relacion.ts';
import { Evidencia, EvidenciaData } from '../domain/evidencia.ts';
import {
  GrafoDirigido,
  EntradaAdyacencia,
  ResultadoBFS,
  ResultadoDFS,
  ResultadoCamino,
} from '../domain/grafo.ts';
import { RepositorioSQLite } from '../persistence/sqlite_repository.ts';

export interface EstadoSistemaGrafo {
  entidades: EntidadData[];
  relaciones: RelacionData[];
  listaAdyacencia: Record<string, EntradaAdyacencia[]>;
  estadisticasBD: Record<string, number>;
  consistenciaVerificada: boolean;
}

export class ServicioCoordinadorGrafo {
  private readonly repo: RepositorioSQLite;
  private readonly grafo: GrafoDirigido;

  constructor(repo: RepositorioSQLite, grafo: GrafoDirigido) {
    this.repo = repo;
    this.grafo = grafo;
  }

  /**
   * Reconstruye la representación en memoria del Grafo (y su Lista de Adyacencia)
   * a partir del estado persistente en SQLite (Sección 9 y 14).
   */
  public reconstruirGrafoDesdeBD(): void {
    const entidadesBD = this.repo.listarEntidades();
    const relacionesBD = this.repo.listarRelacionesConEvidencias();

    this.grafo.limpiar();

    for (const eData of entidadesBD) {
      const entidad = new Entidad({
        id: eData.id,
        tipo: eData.tipo,
        valor: eData.valor,
        valor_normalizado: eData.valor_normalizado,
        descripcion: eData.descripcion,
        metadata: eData.metadata,
      });
      this.grafo.agregarEntidad(entidad);
    }

    for (const rData of relacionesBD) {
      const evidencias = rData.evidencias.map(
        (ev) =>
          new Evidencia({
            id: ev.id,
            source: ev.source,
            description: ev.description,
            date: ev.date,
          })
      );
      const relacion = new Relacion({
        id: rData.id,
        origen_id: rData.origen_id,
        destino_id: rData.destino_id,
        tipo: rData.tipo,
        descripcion: rData.descripcion,
        fecha: rData.fecha,
        evidencias,
      });
      this.grafo.agregarRelacion(relacion);
    }
  }

  /**
   * Verifica que el número de vértices y aristas en el motor del grafo en memoria
   * coincida exactamente con las filas de ENTIDAD y RELACION en SQLite.
   */
  public verificarConsistencia(): boolean {
    const stats = this.repo.obtenerEstadisticasTablas();
    return (
      stats['ENTIDAD'] === this.grafo.cantidadVertices &&
      stats['RELACION'] === this.grafo.cantidadAristas
    );
  }

  public obtenerEstadoCompleto(): EstadoSistemaGrafo {
    return {
      entidades: this.grafo.obtenerTodasLasEntidades(),
      relaciones: this.grafo.obtenerTodasLasRelaciones(),
      listaAdyacencia: this.grafo.obtenerListaAdyacenciaCompleta(),
      estadisticasBD: this.repo.obtenerEstadisticasTablas(),
      consistenciaVerificada: this.verificarConsistencia(),
    };
  }

  // =========================================================================
  // CRUD ENTIDADES CON COORDINACIÓN ATÓMICA BD <-> GRAFO
  // =========================================================================

  public crearEntidad(params: {
    id?: string;
    tipo: TipoEntidad;
    valor: string;
    descripcion?: string;
    metadata?: Record<string, string>;
  }): EntidadData {
    const valorNormalizado = normalizarValorEntidad(params.tipo, params.valor);

    // 1. Verificar duplicados en el motor antes de tocar SQLite
    for (const existente of this.grafo.obtenerTodasLasEntidades()) {
      if (existente.tipo === params.tipo && existente.valor_normalizado === valorNormalizado) {
        throw new Error(
          `Entidad duplicada: ya existe [${params.tipo}] con valor normalizado "${valorNormalizado}" (ID: ${existente.id}).`
        );
      }
    }

    const nuevoId =
      params.id?.trim() ||
      `ENT-${String(Date.now()).slice(-5)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const nuevaEntidad = new Entidad({
      id: nuevoId,
      tipo: params.tipo,
      valor: params.valor,
      valor_normalizado: valorNormalizado,
      descripcion: params.descripcion,
      metadata: params.metadata,
    });

    // 2. Persistir en SQLite y actualizar Grafo en memoria con resincronización ante error
    this.repo.insertarEntidad(nuevaEntidad);
    try {
      this.grafo.agregarEntidad(nuevaEntidad);
    } catch (err) {
      this.reconstruirGrafoDesdeBD();
      throw err;
    }

    return nuevaEntidad.toJSON();
  }

  public eliminarEntidad(id: string): void {
    if (!this.grafo.existeEntidad(id)) {
      throw new Error(`La entidad "${id}" no existe.`);
    }
    this.repo.eliminarEntidad(id);
    try {
      this.grafo.eliminarEntidad(id);
    } catch (err) {
      this.reconstruirGrafoDesdeBD();
      throw err;
    }
  }

  // =========================================================================
  // CRUD RELACIONES Y EVIDENCIAS CON COORDINACIÓN ATÓMICA BD <-> GRAFO
  // =========================================================================

  public crearRelacion(params: {
    id?: string;
    origen_id: string;
    destino_id: string;
    tipo: TipoRelacion;
    descripcion?: string;
    fecha?: string;
    evidencias?: Array<{
      id?: string;
      source: string;
      description: string;
      date?: string;
    }>;
  }): RelacionData {
    if (!this.grafo.existeEntidad(params.origen_id)) {
      throw new Error(`La entidad origen "${params.origen_id}" no existe.`);
    }
    if (!this.grafo.existeEntidad(params.destino_id)) {
      throw new Error(`La entidad destino "${params.destino_id}" no existe.`);
    }

    // Verificar duplicado en lista de adyacencia antes de insertar en BD
    const adyacentes = this.grafo.obtenerAdyacenciasDeNodo(params.origen_id);
    if (
      adyacentes.some(
        (a) => a.destino_id === params.destino_id && a.tipo_relacion === params.tipo
      )
    ) {
      throw new Error(
        `Relación duplicada: ya existe [${params.tipo}] desde "${params.origen_id}" hacia "${params.destino_id}".`
      );
    }

    const relId =
      params.id?.trim() ||
      `REL-${String(Date.now()).slice(-5)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const instanciasEvidencia = (params.evidencias || []).map((ev, idx) => {
      const evId =
        ev.id?.trim() ||
        `EV-${relId}-${idx + 1}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      return new Evidencia({
        id: evId,
        source: ev.source,
        description: ev.description,
        date: ev.date,
      });
    });

    const nuevaRelacion = new Relacion({
      id: relId,
      origen_id: params.origen_id,
      destino_id: params.destino_id,
      tipo: params.tipo,
      descripcion: params.descripcion,
      fecha: params.fecha,
      evidencias: instanciasEvidencia,
    });

    this.repo.insertarRelacionConEvidencias(nuevaRelacion);
    try {
      this.grafo.agregarRelacion(nuevaRelacion);
    } catch (err) {
      this.reconstruirGrafoDesdeBD();
      throw err;
    }

    return nuevaRelacion.toJSON();
  }

  public agregarEvidenciaARelacion(
    relacionId: string,
    params: { source: string; description: string; date?: string }
  ): EvidenciaData {
    const relacion = this.grafo.obtenerRelacion(relacionId);
    if (!relacion) {
      throw new Error(`La relación "${relacionId}" no existe.`);
    }

    const evId = `EV-${String(Date.now()).slice(-5)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const nuevaEvidencia = new Evidencia({
      id: evId,
      source: params.source,
      description: params.description,
      date: params.date,
    });

    this.repo.insertarEvidenciaEnRelacion(relacionId, nuevaEvidencia);
    try {
      relacion.agregarEvidencia(nuevaEvidencia);
    } catch (err) {
      this.reconstruirGrafoDesdeBD();
      throw err;
    }

    return nuevaEvidencia.toJSON();
  }

  public eliminarRelacion(id: string): void {
    if (!this.grafo.obtenerRelacion(id)) {
      throw new Error(`La relación "${id}" no existe.`);
    }
    this.repo.eliminarRelacion(id);
    try {
      this.grafo.eliminarRelacion(id);
    } catch (err) {
      this.reconstruirGrafoDesdeBD();
      throw err;
    }
  }

  // =========================================================================
  // DELEGACIÓN DE ALGORITMOS AL MOTOR DEL GRAFO (Secciones 10, 11 y 12)
  // =========================================================================

  public ejecutarBFS(origenId: string): ResultadoBFS {
    return this.grafo.ejecutarBFS(origenId);
  }

  public ejecutarDFS(origenId: string): ResultadoDFS {
    return this.grafo.ejecutarDFS(origenId);
  }

  public buscarCamino(origenId: string, destinoId: string): ResultadoCamino {
    return this.grafo.buscarCamino(origenId, destinoId);
  }

  public obtenerVecinos(entidadId: string): string[] {
    return this.grafo.obtenerVecinos(entidadId);
  }

  // =========================================================================
  // CARGA DE CASO DE INVESTIGACIÓN DEMO ACADÉMICO
  // =========================================================================

  public cargarCasoInvestigacionAcademico(): EstadoSistemaGrafo {
    this.repo.vaciarDatosInvestigacion();
    this.grafo.limpiar();

    // 1. Crear Entidades representativas de los 7 tipos del dominio OSINT
    const entidadesSemilla: Array<{
      id: string;
      tipo: TipoEntidad;
      valor: string;
      descripcion: string;
      metadata: Record<string, string>;
    }> = [
      {
        id: 'E-PER-01',
        tipo: TipoEntidad.PERSONA,
        valor: 'Martín Alarcón Vega',
        descripcion: 'Investigador principal y administrador de infraestructura bajo análisis.',
        metadata: { rol: 'Administrador de Sistemas', pais: 'Argentina', fuente_inicial: 'Registro Público' },
      },
      {
        id: 'E-ORG-01',
        tipo: TipoEntidad.ORGANIZACION,
        valor: 'Observatorio Digital Austral',
        descripcion: 'Organización vinculada al registro de dominios de investigación.',
        metadata: { tipo_entidad_legal: 'Fundación Académica', sede: 'Buenos Aires' },
      },
      {
        id: 'E-USR-01',
        tipo: TipoEntidad.USUARIO,
        valor: '@malarcon_sec',
        descripcion: 'Alias técnico utilizado en repositorios públicos y foros.',
        metadata: { plataforma: 'GitHub / GitLab', actividad: '2023-2026' },
      },
      {
        id: 'E-EML-01',
        tipo: TipoEntidad.EMAIL,
        valor: 'm.alarcon@observatorio-austral.org',
        descripcion: 'Correo electrónico de contacto técnico en registros SOA/WHOIS.',
        metadata: { pgp_fingerprint: '4F9A-82C1-00E3', verificado: 'true' },
      },
      {
        id: 'E-DOM-01',
        tipo: TipoEntidad.DOMINIO,
        valor: 'observatorio-austral.org',
        descripcion: 'Dominio primario de la organización.',
        metadata: { registrador: 'NIC / IANA', dnssec: 'Habilitado' },
      },
      {
        id: 'E-DOM-02',
        tipo: TipoEntidad.DOMINIO,
        valor: 'lab-telemetria-sur.net',
        descripcion: 'Dominio secundario de recolección de datos.',
        metadata: { registrador: 'Namecheap', creacion: '2025-04-12' },
      },
      {
        id: 'E-WEB-01',
        tipo: TipoEntidad.SITIO_WEB,
        valor: 'https://portal.observatorio-austral.org/acceso',
        descripcion: 'Portal web de publicación de reportes y acceso institucional.',
        metadata: { servidor_http: 'nginx/1.24', tls_issuer: 'Let\'s Encrypt R3' },
      },
      {
        id: 'E-IP-01',
        tipo: TipoEntidad.IP,
        valor: '198.51.100.42',
        descripcion: 'Servidor dedicado de alojamiento primario (ASN 64496).',
        metadata: { asn: 'AS64496', ubicacion: 'Santiago / Buenos Aires', puerto_abierto: '443/tcp' },
      },
      {
        id: 'E-IP-02',
        tipo: TipoEntidad.IP,
        valor: '203.0.113.88',
        descripcion: 'Nodo de respaldo y pasarela de correo saliente (MX).',
        metadata: { asn: 'AS64500', rol_red: 'Relay MX / Backup' },
      },
    ];

    for (const item of entidadesSemilla) {
      this.crearEntidad(item);
    }

    // 2. Crear Relaciones dirigidas con Evidencias verificables
    // Topología diseñada para mostrar ramas, niveles claros en BFS, profundidad en DFS,
    // múltiples caminos hacia E-IP-01 y un ciclo dirigido controlado para probar visitados.
    const relacionesSemilla: Array<{
      id: string;
      origen_id: string;
      destino_id: string;
      tipo: TipoRelacion;
      descripcion: string;
      fecha: string;
      evidencias: Array<{ id: string; source: string; description: string; date: string }>;
    }> = [
      {
        id: 'R-01',
        origen_id: 'E-PER-01',
        destino_id: 'E-ORG-01',
        tipo: TipoRelacion.TRABAJA_EN,
        descripcion: 'Figura como director técnico en el directorio institucional.',
        fecha: '2026-01-15',
        evidencias: [
          {
            id: 'EV-01',
            source: 'Memoria Anual Institucional 2026',
            description: 'Sección de personal técnico: Martín Alarcón Vega designado coordinador.',
            date: '2026-01-15',
          },
        ],
      },
      {
        id: 'R-02',
        origen_id: 'E-PER-01',
        destino_id: 'E-USR-01',
        tipo: TipoRelacion.UTILIZA,
        descripcion: 'Cuenta de usuario empleada para publicar herramientas académicas.',
        fecha: '2026-02-10',
        evidencias: [
          {
            id: 'EV-02',
            source: 'Perfil Público de Repositorio',
            description: 'Biografía del perfil @malarcon_sec coincide con nombre y llave PGP.',
            date: '2026-02-10',
          },
        ],
      },
      {
        id: 'R-03',
        origen_id: 'E-PER-01',
        destino_id: 'E-EML-01',
        tipo: TipoRelacion.POSEE,
        descripcion: 'Casilla institucional asignada al investigador.',
        fecha: '2026-02-12',
        evidencias: [
          {
            id: 'EV-03',
            source: 'Cabecera de Commit Git',
            description: 'Autoría firmada con correo m.alarcon@observatorio-austral.org.',
            date: '2026-02-12',
          },
        ],
      },
      {
        id: 'R-04',
        origen_id: 'E-ORG-01',
        destino_id: 'E-DOM-01',
        tipo: TipoRelacion.POSEE,
        descripcion: 'Titularidad oficial del dominio primario.',
        fecha: '2026-01-20',
        evidencias: [
          {
            id: 'EV-04',
            source: 'Consulta RDAP / WHOIS',
            description: 'Registrant Organization: Observatorio Digital Austral.',
            date: '2026-01-20',
          },
        ],
      },
      {
        id: 'R-05',
        origen_id: 'E-EML-01',
        destino_id: 'E-DOM-01',
        tipo: TipoRelacion.ADMINISTRA,
        descripcion: 'Correo listado como contacto administrativo en registro SOA.',
        fecha: '2026-03-01',
        evidencias: [
          {
            id: 'EV-05',
            source: 'Registro DNS SOA',
            description: 'RNAME en registro SOA corresponde a m.alarcon.observatorio-austral.org.',
            date: '2026-03-01',
          },
        ],
      },
      {
        id: 'R-06',
        origen_id: 'E-USR-01',
        destino_id: 'E-DOM-02',
        tipo: TipoRelacion.ADMINISTRA,
        descripcion: 'Archivo de configuración en repositorio declara administración del dominio secundario.',
        fecha: '2026-03-18',
        evidencias: [
          {
            id: 'EV-06',
            source: 'Repositorio de Infraestructura DNS',
            description: 'Zona DNS mantenida por el usuario @malarcon_sec.',
            date: '2026-03-18',
          },
        ],
      },
      {
        id: 'R-07',
        origen_id: 'E-DOM-01',
        destino_id: 'E-WEB-01',
        tipo: TipoRelacion.POSEE,
        descripcion: 'Subdominio y aplicativo web alojado bajo el dominio principal.',
        fecha: '2026-04-02',
        evidencias: [
          {
            id: 'EV-07',
            source: 'Certificado TLS Transparency Log (crt.sh)',
            description: 'SAN incluye portal.observatorio-austral.org.',
            date: '2026-04-02',
          },
        ],
      },
      {
        id: 'R-08',
        origen_id: 'E-WEB-01',
        destino_id: 'E-IP-01',
        tipo: TipoRelacion.APUNTA_A,
        descripcion: 'Resolución de registro DNS tipo A del portal web.',
        fecha: '2026-04-10',
        evidencias: [
          {
            id: 'EV-08',
            source: 'Resolución DNS Activa (Registro A)',
            description: 'portal.observatorio-austral.org IN A 198.51.100.42 (TTL 3600).',
            date: '2026-04-10',
          },
        ],
      },
      {
        id: 'R-09',
        origen_id: 'E-DOM-02',
        destino_id: 'E-IP-01',
        tipo: TipoRelacion.APUNTA_A,
        descripcion: 'El dominio secundario comparte la misma dirección IPv4 de servidor.',
        fecha: '2026-04-15',
        evidencias: [
          {
            id: 'EV-09',
            source: 'Passive DNS / Resolución A',
            description: 'lab-telemetria-sur.net resuelve hacia 198.51.100.42.',
            date: '2026-04-15',
          },
        ],
      },
      {
        id: 'R-10',
        origen_id: 'E-DOM-01',
        destino_id: 'E-IP-02',
        tipo: TipoRelacion.APUNTA_A,
        descripcion: 'Registro MX de correo saliente e entrante.',
        fecha: '2026-04-18',
        evidencias: [
          {
            id: 'EV-10',
            source: 'Consulta DNS MX',
            description: 'Prioridad 10 apuntando a 203.0.113.88.',
            date: '2026-04-18',
          },
        ],
      },
      {
        id: 'R-11',
        origen_id: 'E-IP-02',
        destino_id: 'E-ORG-01',
        tipo: TipoRelacion.PERTENECE_A,
        descripcion: 'Bloque IP delegado a la organización (forma un ciclo dirigido para pruebas de BFS/DFS).',
        fecha: '2026-04-20',
        evidencias: [
          {
            id: 'EV-11',
            source: 'Registro RIR LACNIC / Reverse PTR',
            description: 'PTR y registro de bloque asignados a Observatorio Digital Austral.',
            date: '2026-04-20',
          },
        ],
      },
    ];

    for (const rel of relacionesSemilla) {
      this.crearRelacion(rel);
    }

    return this.obtenerEstadoCompleto();
  }
}
