/**
 * Motor del Grafo Dirigido (AED3)
 * Mini-Maltego Académico — v1.0
 *
 * REGLA ARQUITECTÓNICA (Sección 8 del Contrato Técnico):
 * Este módulo implementa exclusivamente:
 * - Grafo dirigido (V = Entidades, E = Relaciones)
 * - Representación interna mediante Lista de Adyacencia
 * - Cola FIFO manual para recorrido BFS (O(V + E))
 * - Recorrido DFS recursivo puro (O(V + E))
 * - Búsqueda de caminos mínimos en cantidad de aristas mediante BFS + reconstrucción inversa de predecesores
 *
 * NO conoce ni importa: SQL, SQLite, HTML, CSS, HTTP, Express/FastAPI, APIs externas ni Cytoscape.js.
 */

import { Entidad, EntidadData } from './entidad.ts';
import { Relacion, RelacionData } from './relacion.ts';

/**
 * Implementación explícita de una Cola FIFO mediante nodos enlazados (punteros head/tail)
 * para garantizar operaciones encolar() y desencolar() en tiempo O(1) real
 * y evidenciar el uso de la estructura de datos Cola en BFS.
 */
interface NodoCola<T> {
  valor: T;
  siguiente: NodoCola<T> | null;
}

export class ColaFIFO<T> {
  private frente: NodoCola<T> | null = null;
  private final: NodoCola<T> | null = null;
  private _tamano: number = 0;

  public encolar(elemento: T): void {
    const nuevoNodo: NodoCola<T> = { valor: elemento, siguiente: null };
    if (this.final === null) {
      this.frente = nuevoNodo;
      this.final = nuevoNodo;
    } else {
      this.final.siguiente = nuevoNodo;
      this.final = nuevoNodo;
    }
    this._tamano++;
  }

  public desencolar(): T {
    if (this.frente === null) {
      throw new Error('No se puede desencolar de una cola FIFO vacía.');
    }
    const valor = this.frente.valor;
    this.frente = this.frente.siguiente;
    if (this.frente === null) {
      this.final = null;
    }
    this._tamano--;
    return valor;
  }

  public estaVacia(): boolean {
    return this._tamano === 0;
  }

  public get tamano(): number {
    return this._tamano;
  }

  public toArray(): T[] {
    const resultado: T[] = [];
    let actual = this.frente;
    while (actual !== null) {
      resultado.push(actual.valor);
      actual = actual.siguiente;
    }
    return resultado;
  }
}

export interface EntradaAdyacencia {
  destino_id: string;
  relacion_id: string;
  tipo_relacion: string;
}

export interface PasoTrazaAlgoritmo {
  paso: number;
  accion: string;
  nodoActual: string;
  visitados: string[];
  estructuraAuxiliar: string[]; // Contenido de la Cola FIFO (en BFS) o Pila de llamadas recursivas (en DFS)
  detalle: string;
}

export interface ResultadoBFS {
  algoritmo: 'BFS';
  origen_id: string;
  ordenRecorrido: string[];
  niveles: Record<string, number>;
  predecesores: Record<string, string | null>;
  aristasRecorrido: string[]; // IDs de relaciones utilizadas en el árbol BFS
  traza: PasoTrazaAlgoritmo[];
  complejidad: {
    tiempo: string;
    espacio: string;
    verticesTotales: number;
    aristasTotales: number;
    verticesAlcanzados: number;
  };
}

export interface ResultadoDFS {
  algoritmo: 'DFS';
  origen_id: string;
  ordenRecorrido: string[];
  predecesores: Record<string, string | null>;
  tiemposDescubrimiento: Record<string, number>;
  tiemposFinalizacion: Record<string, number>;
  aristasRecorrido: string[]; // IDs de relaciones utilizadas en el árbol DFS recursivo
  traza: PasoTrazaAlgoritmo[];
  complejidad: {
    tiempo: string;
    espacio: string;
    verticesTotales: number;
    aristasTotales: number;
    verticesAlcanzados: number;
  };
}

export interface PasoCamino {
  entidad_id: string;
  relacion_id_entrante: string | null;
  tipo_relacion_entrante: string | null;
}

export interface ResultadoCamino {
  algoritmo: 'BFS_CAMINO_MINIMO';
  origen_id: string;
  destino_id: string;
  existeCamino: boolean;
  cantidadAristas: number;
  caminoNodos: string[];
  caminoRelaciones: string[];
  pasosDetallados: PasoCamino[];
  predecesoresEvaluados: Record<string, string | null>;
  nivelesEvaluados: Record<string, number>;
  traza: PasoTrazaAlgoritmo[];
  complejidad: {
    tiempo: string;
    espacio: string;
  };
}

export class GrafoDirigido {
  /** Diccionario de Vértices: id_entidad -> Entidad */
  private vertices: Map<string, Entidad>;
  /** Diccionario de Aristas: id_relacion -> Relacion */
  private aristas: Map<string, Relacion>;
  /**
   * Representación interna principal (Sección 9):
   * Lista de Adyacencia: id_origen -> Lista de conexiones dirigidas salientes
   */
  private listaAdyacencia: Map<string, EntradaAdyacencia[]>;

  constructor() {
    this.vertices = new Map<string, Entidad>();
    this.aristas = new Map<string, Relacion>();
    this.listaAdyacencia = new Map<string, EntradaAdyacencia[]>();
  }

  public limpiar(): void {
    this.vertices.clear();
    this.aristas.clear();
    this.listaAdyacencia.clear();
  }

  // =========================================================================
  // 1. OPERACIONES SOBRE VÉRTICES (ENTIDADES)
  // =========================================================================

  public agregarEntidad(entidad: Entidad): void {
    if (this.vertices.has(entidad.id)) {
      throw new Error(`Ya existe una entidad con el id "${entidad.id}" en el grafo.`);
    }
    // Verificar duplicado por (tipo + valor_normalizado)
    for (const existente of this.vertices.values()) {
      if (
        existente.tipo === entidad.tipo &&
        existente.valor_normalizado === entidad.valor_normalizado
      ) {
        throw new Error(
          `Entidad duplicada: ya existe [${entidad.tipo}] con valor normalizado "${entidad.valor_normalizado}" (id: ${existente.id}).`
        );
      }
    }

    this.vertices.set(entidad.id, entidad);
    this.listaAdyacencia.set(entidad.id, []);
  }

  public obtenerEntidad(id: string): Entidad | undefined {
    return this.vertices.get(id);
  }

  public existeEntidad(id: string): boolean {
    return this.vertices.has(id);
  }

  public obtenerTodasLasEntidades(): EntidadData[] {
    return Array.from(this.vertices.values()).map((e) => e.toJSON());
  }

  public eliminarEntidad(id: string): void {
    if (!this.vertices.has(id)) {
      throw new Error(`No se puede eliminar: la entidad "${id}" no existe en el grafo.`);
    }

    // 1. Eliminar todas las relaciones salientes desde este vértice
    const salientes = this.listaAdyacencia.get(id) || [];
    for (const entrada of salientes) {
      this.aristas.delete(entrada.relacion_id);
    }
    this.listaAdyacencia.delete(id);

    // 2. Eliminar todas las relaciones entrantes hacia este vértice en las listas de adyacencia de otros nodos
    for (const [origenId, vecindad] of this.listaAdyacencia.entries()) {
      const filtradas: EntradaAdyacencia[] = [];
      for (const entrada of vecindad) {
        if (entrada.destino_id === id) {
          this.aristas.delete(entrada.relacion_id);
        } else {
          filtradas.push(entrada);
        }
      }
      this.listaAdyacencia.set(origenId, filtradas);
    }

    // 3. Eliminar el vértice
    this.vertices.delete(id);
  }

  // =========================================================================
  // 2. OPERACIONES SOBRE ARISTAS DIRIGIDAS (RELACIONES)
  // =========================================================================

  public agregarRelacion(relacion: Relacion): void {
    if (!this.vertices.has(relacion.origen_id)) {
      throw new Error(
        `No se puede crear la relación: la entidad origen "${relacion.origen_id}" no existe en el grafo.`
      );
    }
    if (!this.vertices.has(relacion.destino_id)) {
      throw new Error(
        `No se puede crear la relación: la entidad destino "${relacion.destino_id}" no existe en el grafo.`
      );
    }
    if (this.aristas.has(relacion.id)) {
      throw new Error(`Ya existe una relación con el id "${relacion.id}".`);
    }

    const vecindadOrigen = this.listaAdyacencia.get(relacion.origen_id)!;
    const duplicada = vecindadOrigen.some(
      (entrada) =>
        entrada.destino_id === relacion.destino_id &&
        entrada.tipo_relacion === relacion.tipo
    );
    if (duplicada) {
      throw new Error(
        `Relación duplicada: ya existe una relación dirigida [${relacion.tipo}] desde "${relacion.origen_id}" hacia "${relacion.destino_id}".`
      );
    }

    this.aristas.set(relacion.id, relacion);
    vecindadOrigen.push({
      destino_id: relacion.destino_id,
      relacion_id: relacion.id,
      tipo_relacion: relacion.tipo,
    });
  }

  public obtenerRelacion(id: string): Relacion | undefined {
    return this.aristas.get(id);
  }

  public obtenerTodasLasRelaciones(): RelacionData[] {
    return Array.from(this.aristas.values()).map((r) => r.toJSON());
  }

  public eliminarRelacion(id: string): void {
    const relacion = this.aristas.get(id);
    if (!relacion) {
      throw new Error(`No se puede eliminar: la relación "${id}" no existe en el grafo.`);
    }

    const vecindad = this.listaAdyacencia.get(relacion.origen_id);
    if (vecindad) {
      this.listaAdyacencia.set(
        relacion.origen_id,
        vecindad.filter((entrada) => entrada.relacion_id !== id)
      );
    }
    this.aristas.delete(id);
  }

  // =========================================================================
  // 3. LISTA DE ADYACENCIA Y CONSULTA DE VECINOS (Sección 9)
  // =========================================================================

  /**
   * Devuelve los IDs de los vecinos directos salientes de una entidad (sin duplicados, preservando orden de inserción).
   */
  public obtenerVecinos(entidadId: string): string[] {
    if (!this.vertices.has(entidadId)) {
      throw new Error(`La entidad "${entidadId}" no existe en el grafo.`);
    }
    const entradas = this.listaAdyacencia.get(entidadId) || [];
    const vistos = new Set<string>();
    const vecinos: string[] = [];
    for (const entrada of entradas) {
      if (!vistos.has(entrada.destino_id)) {
        vistos.add(entrada.destino_id);
        vecinos.push(entrada.destino_id);
      }
    }
    return vecinos;
  }

  /**
   * Devuelve las conexiones salientes detalladas desde un vértice.
   */
  public obtenerAdyacenciasDeNodo(entidadId: string): EntradaAdyacencia[] {
    if (!this.vertices.has(entidadId)) {
      throw new Error(`La entidad "${entidadId}" no existe en el grafo.`);
    }
    return [...(this.listaAdyacencia.get(entidadId) || [])];
  }

  /**
   * Devuelve una copia serializable de la Lista de Adyacencia completa en memoria:
   * A -> [ { destino_id, relacion_id, tipo_relacion }, ... ]
   */
  public obtenerListaAdyacenciaCompleta(): Record<string, EntradaAdyacencia[]> {
    const resultado: Record<string, EntradaAdyacencia[]> = {};
    for (const [verticeId, adyacentes] of this.listaAdyacencia.entries()) {
      resultado[verticeId] = adyacentes.map((a) => ({ ...a }));
    }
    return resultado;
  }

  public get cantidadVertices(): number {
    return this.vertices.size;
  }

  public get cantidadAristas(): number {
    return this.aristas.size;
  }

  // =========================================================================
  // 4. ALGORITMO BFS — RECORRIDO EN ANCHURA (Sección 10)
  // Cadena: Grafo -> Lista de adyacencia -> Cola FIFO -> Visitados -> Predecesores -> Niveles
  // Complejidad Temporal: O(V + E) | Espacio Auxiliar: O(V)
  // =========================================================================

  public ejecutarBFS(origenId: string): ResultadoBFS {
    if (!this.vertices.has(origenId)) {
      throw new Error(`No se puede ejecutar BFS: la entidad origen "${origenId}" no existe en el grafo.`);
    }

    const cola = new ColaFIFO<string>();
    const visitados = new Set<string>();
    const ordenRecorrido: string[] = [];
    const niveles: Record<string, number> = {};
    const predecesores: Record<string, string | null> = {};
    const aristasRecorrido: string[] = [];
    const traza: PasoTrazaAlgoritmo[] = [];
    let pasoCounter = 1;

    // Inicialización en el nodo origen
    visitados.add(origenId);
    niveles[origenId] = 0;
    predecesores[origenId] = null;
    cola.encolar(origenId);

    traza.push({
      paso: pasoCounter++,
      accion: 'ENCOLAR_ORIGEN',
      nodoActual: origenId,
      visitados: Array.from(visitados),
      estructuraAuxiliar: cola.toArray(),
      detalle: `Se marca origen "${origenId}" como visitado (nivel 0, predecesor null) y se encola en la Cola FIFO.`,
    });

    while (!cola.estaVacia()) {
      const actualId = cola.desencolar();
      ordenRecorrido.push(actualId);

      traza.push({
        paso: pasoCounter++,
        accion: 'DESENCOLAR_Y_PROCESAR',
        nodoActual: actualId,
        visitados: Array.from(visitados),
        estructuraAuxiliar: cola.toArray(),
        detalle: `Se desencola "${actualId}" (nivel ${niveles[actualId]}) para explorar sus vecinos en la lista de adyacencia.`,
      });

      const adyacentes = this.listaAdyacencia.get(actualId) || [];
      for (const conexion of adyacentes) {
        const vecinoId = conexion.destino_id;
        if (!visitados.has(vecinoId)) {
          visitados.add(vecinoId);
          niveles[vecinoId] = niveles[actualId] + 1;
          predecesores[vecinoId] = actualId;
          aristasRecorrido.push(conexion.relacion_id);
          cola.encolar(vecinoId);

          traza.push({
            paso: pasoCounter++,
            accion: 'DESCUBRIR_VECINO',
            nodoActual: vecinoId,
            visitados: Array.from(visitados),
            estructuraAuxiliar: cola.toArray(),
            detalle: `Vecino "${vecinoId}" descubierto desde "${actualId}" vía [${conexion.tipo_relacion}]. Nivel = ${niveles[vecinoId]}, Predecesor = "${actualId}". Encolado.`,
          });
        }
      }
    }

    return {
      algoritmo: 'BFS',
      origen_id: origenId,
      ordenRecorrido,
      niveles,
      predecesores,
      aristasRecorrido,
      traza,
      complejidad: {
        tiempo: 'O(V + E)',
        espacio: 'O(V)',
        verticesTotales: this.vertices.size,
        aristasTotales: this.aristas.size,
        verticesAlcanzados: ordenRecorrido.length,
      },
    };
  }

  // =========================================================================
  // 5. ALGORITMO DFS — RECORRIDO EN PROFUNDIDAD RECURSIVO (Sección 11)
  // Intención académica: Relacionar Grafo + Recursividad
  // Incluye: condición de existencia, conjunto de visitados, recorrido de vecinos y caso base
  // Complejidad Temporal: O(V + E) | Espacio Auxiliar: O(V) (pila de recursión + visitados)
  // =========================================================================

  public ejecutarDFS(origenId: string): ResultadoDFS {
    // 1. Condición de existencia del nodo inicial
    if (!this.vertices.has(origenId)) {
      throw new Error(`No se puede ejecutar DFS: la entidad origen "${origenId}" no existe en el grafo.`);
    }

    const visitados = new Set<string>();
    const ordenRecorrido: string[] = [];
    const predecesores: Record<string, string | null> = {};
    const tiemposDescubrimiento: Record<string, number> = {};
    const tiemposFinalizacion: Record<string, number> = {};
    const aristasRecorrido: string[] = [];
    const traza: PasoTrazaAlgoritmo[] = [];
    const pilaRecursivaActiva: string[] = [];

    let reloj = 0;
    let pasoCounter = 1;

    predecesores[origenId] = null;

    // Función recursiva pura interna
    const dfsRecursivo = (nodoActualId: string): void => {
      // Caso base implícito: si ya fue visitado, retornar inmediatamente (evita ciclos infinitos)
      if (visitados.has(nodoActualId)) {
        return;
      }

      visitados.add(nodoActualId);
      ordenRecorrido.push(nodoActualId);
      pilaRecursivaActiva.push(nodoActualId);
      reloj++;
      tiemposDescubrimiento[nodoActualId] = reloj;

      traza.push({
        paso: pasoCounter++,
        accion: 'LLAMADA_RECURSIVA_DFS',
        nodoActual: nodoActualId,
        visitados: Array.from(visitados),
        estructuraAuxiliar: [...pilaRecursivaActiva],
        detalle: `Entrada recursiva dfs("${nodoActualId}"). Marcado visitado. Tiempo descubrimiento d=${reloj}.`,
      });

      const adyacentes = this.listaAdyacencia.get(nodoActualId) || [];
      for (const conexion of adyacentes) {
        const vecinoId = conexion.destino_id;
        if (!visitados.has(vecinoId)) {
          predecesores[vecinoId] = nodoActualId;
          aristasRecorrido.push(conexion.relacion_id);
          // Paso recursivo: explorar en profundidad al vecino no visitado
          dfsRecursivo(vecinoId);
        } else {
          traza.push({
            paso: pasoCounter++,
            accion: 'CASO_BASE_YA_VISITADO',
            nodoActual: vecinoId,
            visitados: Array.from(visitados),
            estructuraAuxiliar: [...pilaRecursivaActiva],
            detalle: `Vecino "${vecinoId}" ya pertenece al conjunto de visitados; caso base evita ciclo.`,
          });
        }
      }

      reloj++;
      tiemposFinalizacion[nodoActualId] = reloj;
      pilaRecursivaActiva.pop();

      traza.push({
        paso: pasoCounter++,
        accion: 'RETORNO_RECURSIVO_DFS',
        nodoActual: nodoActualId,
        visitados: Array.from(visitados),
        estructuraAuxiliar: [...pilaRecursivaActiva],
        detalle: `Finaliza exploración de vecinos de "${nodoActualId}". Retorno de llamada recursiva (f=${reloj}).`,
      });
    };

    dfsRecursivo(origenId);

    return {
      algoritmo: 'DFS',
      origen_id: origenId,
      ordenRecorrido,
      predecesores,
      tiemposDescubrimiento,
      tiemposFinalizacion,
      aristasRecorrido,
      traza,
      complejidad: {
        tiempo: 'O(V + E)',
        espacio: 'O(V)',
        verticesTotales: this.vertices.size,
        aristasTotales: this.aristas.size,
        verticesAlcanzados: ordenRecorrido.length,
      },
    };
  }

  // =========================================================================
  // 6. BÚSQUEDA DE CAMINOS MÍNIMOS (Sección 12)
  // Cadena: BFS -> Predecesores -> Destino encontrado -> Reconstrucción inversa -> Camino
  // Obtiene el camino dirigido con cantidad mínima de aristas cuando exista.
  // =========================================================================

  public buscarCamino(origenId: string, destinoId: string): ResultadoCamino {
    if (!this.vertices.has(origenId)) {
      throw new Error(`No se puede buscar camino: la entidad origen "${origenId}" no existe en el grafo.`);
    }
    if (!this.vertices.has(destinoId)) {
      throw new Error(`No se puede buscar camino: la entidad destino "${destinoId}" no existe en el grafo.`);
    }

    // Caso especial: origen === destino (camino de 0 aristas)
    if (origenId === destinoId) {
      return {
        algoritmo: 'BFS_CAMINO_MINIMO',
        origen_id: origenId,
        destino_id: destinoId,
        existeCamino: true,
        cantidadAristas: 0,
        caminoNodos: [origenId],
        caminoRelaciones: [],
        pasosDetallados: [
          {
            entidad_id: origenId,
            relacion_id_entrante: null,
            tipo_relacion_entrante: null,
          },
        ],
        predecesoresEvaluados: { [origenId]: null },
        nivelesEvaluados: { [origenId]: 0 },
        traza: [
          {
            paso: 1,
            accion: 'ORIGEN_IGUAL_DESTINO',
            nodoActual: origenId,
            visitados: [origenId],
            estructuraAuxiliar: [],
            detalle: `El nodo origen y destino coinciden ("${origenId}"). Distancia mínima = 0 aristas.`,
          },
        ],
        complejidad: {
          tiempo: 'O(1)',
          espacio: 'O(1)',
        },
      };
    }

    const cola = new ColaFIFO<string>();
    const visitados = new Set<string>();
    const predecesores: Record<string, string | null> = {};
    const aristaPredecesora: Record<string, EntradaAdyacencia | null> = {};
    const niveles: Record<string, number> = {};
    const traza: PasoTrazaAlgoritmo[] = [];
    let pasoCounter = 1;

    visitados.add(origenId);
    predecesores[origenId] = null;
    aristaPredecesora[origenId] = null;
    niveles[origenId] = 0;
    cola.encolar(origenId);

    let destinoEncontrado = false;

    while (!cola.estaVacia() && !destinoEncontrado) {
      const actualId = cola.desencolar();

      traza.push({
        paso: pasoCounter++,
        accion: 'EXPLORAR_NODO_BFS',
        nodoActual: actualId,
        visitados: Array.from(visitados),
        estructuraAuxiliar: cola.toArray(),
        detalle: `Explorando adyacencias de "${actualId}" (nivel ${niveles[actualId]}).`,
      });

      const adyacentes = this.listaAdyacencia.get(actualId) || [];
      for (const conexion of adyacentes) {
        const vecinoId = conexion.destino_id;
        if (!visitados.has(vecinoId)) {
          visitados.add(vecinoId);
          predecesores[vecinoId] = actualId;
          aristaPredecesora[vecinoId] = conexion;
          niveles[vecinoId] = niveles[actualId] + 1;

          if (vecinoId === destinoId) {
            destinoEncontrado = true;
            traza.push({
              paso: pasoCounter++,
              accion: 'DESTINO_ENCONTRADO',
              nodoActual: vecinoId,
              visitados: Array.from(visitados),
              estructuraAuxiliar: cola.toArray(),
              detalle: `Destino "${destinoId}" alcanzado desde "${actualId}" vía [${conexion.tipo_relacion}] en nivel ${niveles[vecinoId]}. Deteniendo BFS para reconstrucción inversa.`,
            });
            break;
          }

          cola.encolar(vecinoId);
        }
      }
    }

    if (!destinoEncontrado) {
      return {
        algoritmo: 'BFS_CAMINO_MINIMO',
        origen_id: origenId,
        destino_id: destinoId,
        existeCamino: false,
        cantidadAristas: -1,
        caminoNodos: [],
        caminoRelaciones: [],
        pasosDetallados: [],
        predecesoresEvaluados: predecesores,
        nivelesEvaluados: niveles,
        traza,
        complejidad: {
          tiempo: 'O(V + E)',
          espacio: 'O(V)',
        },
      };
    }

    // Reconstrucción inversa desde destino hasta origen usando el diccionario de predecesores
    const caminoNodosInvertido: string[] = [];
    const caminoRelacionesInvertido: string[] = [];
    const pasosInvertidos: PasoCamino[] = [];

    let cursor: string | null = destinoId;
    while (cursor !== null) {
      caminoNodosInvertido.push(cursor);
      const conexionEntrante = aristaPredecesora[cursor];
      if (conexionEntrante) {
        caminoRelacionesInvertido.push(conexionEntrante.relacion_id);
        pasosInvertidos.push({
          entidad_id: cursor,
          relacion_id_entrante: conexionEntrante.relacion_id,
          tipo_relacion_entrante: conexionEntrante.tipo_relacion,
        });
      } else {
        pasosInvertidos.push({
          entidad_id: cursor,
          relacion_id_entrante: null,
          tipo_relacion_entrante: null,
        });
      }
      cursor = predecesores[cursor] ?? null;
    }

    const caminoNodos = caminoNodosInvertido.reverse();
    const caminoRelaciones = caminoRelacionesInvertido.reverse();
    const pasosDetallados = pasosInvertidos.reverse();

    traza.push({
      paso: pasoCounter++,
      accion: 'RECONSTRUCCION_INVERSA',
      nodoActual: destinoId,
      visitados: Array.from(visitados),
      estructuraAuxiliar: caminoNodos,
      detalle: `Reconstrucción inversa de predecesores completada: ${caminoNodos.join(' -> ')} (${caminoRelaciones.length} aristas).`,
    });

    return {
      algoritmo: 'BFS_CAMINO_MINIMO',
      origen_id: origenId,
      destino_id: destinoId,
      existeCamino: true,
      cantidadAristas: caminoRelaciones.length,
      caminoNodos,
      caminoRelaciones,
      pasosDetallados,
      predecesoresEvaluados: predecesores,
      nivelesEvaluados: niveles,
      traza,
      complejidad: {
        tiempo: 'O(V + E)',
        espacio: 'O(V)',
      },
    };
  }
}
