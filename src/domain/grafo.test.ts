/**
 * Suite de Pruebas Unitarias del Motor del Grafo y Dominio (Sección 19 del Contrato Técnico)
 * Cubre exhaustivamente:
 * - Entidades: creación, búsqueda, eliminación, duplicados, entidades inexistentes, normalización D-02.
 * - Relaciones: creación, eliminación, relaciones duplicadas, origen inexistente, destino inexistente, evidencias.
 * - Grafo: vecinos, grafo vacío, nodo inexistente, ciclos, nodos aislados, lista de adyacencia.
 * - BFS: grafo simple, grafo con ramas, ciclos, nodo aislado, nodo inexistente.
 * - DFS: grafo simple, ciclos, ramas, nodo inexistente, recursividad.
 * - Caminos: camino existente, múltiples caminos (mínimo garantizado), camino inexistente, origen = destino, nodos inexistentes.
 */

import { Entidad, TipoEntidad, normalizarValorEntidad } from './entidad.ts';
import { Relacion, TipoRelacion } from './relacion.ts';
import { Evidencia } from './evidencia.ts';
import { GrafoDirigido } from './grafo.ts';

export interface ResultadoPruebaUnitaria {
  id: string;
  categoria: 'ENTIDADES' | 'RELACIONES' | 'GRAFO' | 'BFS' | 'DFS' | 'CAMINOS';
  nombre: string;
  descripcion: string;
  exito: boolean;
  tiempoMs: number;
  detalleResultado: string;
}

export interface ResumenSuitePruebas {
  total: number;
  exitosas: number;
  fallidas: number;
  tiempoTotalMs: number;
  resultados: ResultadoPruebaUnitaria[];
}

function assertCondition(condicion: boolean, mensajeError: string): void {
  if (!condicion) {
    throw new Error(mensajeError);
  }
}

function assertThrows(fn: () => void, fragmentoEsperado?: string): void {
  let lanzo = false;
  let mensaje = '';
  try {
    fn();
  } catch (e: unknown) {
    lanzo = true;
    mensaje = e instanceof Error ? e.message : String(e);
  }
  if (!lanzo) {
    throw new Error('Se esperaba que la operación lanzara una excepción, pero finalizó sin error.');
  }
  if (fragmentoEsperado && !mensaje.toLowerCase().includes(fragmentoEsperado.toLowerCase())) {
    throw new Error(`Se esperaba error con "${fragmentoEsperado}", pero se recibió: "${mensaje}"`);
  }
}

export function ejecutarSuitePruebasMotor(): ResumenSuitePruebas {
  const resultados: ResultadoPruebaUnitaria[] = [];
  const inicioGlobal = performance.now();

  const registrarPrueba = (
    id: string,
    categoria: ResultadoPruebaUnitaria['categoria'],
    nombre: string,
    descripcion: string,
    fn: () => string
  ) => {
    const t0 = performance.now();
    try {
      const detalle = fn();
      const t1 = performance.now();
      resultados.push({
        id,
        categoria,
        nombre,
        descripcion,
        exito: true,
        tiempoMs: Number((t1 - t0).toFixed(3)),
        detalleResultado: detalle,
      });
    } catch (err: unknown) {
      const t1 = performance.now();
      resultados.push({
        id,
        categoria,
        nombre,
        descripcion,
        exito: false,
        tiempoMs: Number((t1 - t0).toFixed(3)),
        detalleResultado: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // =========================================================================
  // CATEGORÍA 1: ENTIDADES
  // =========================================================================

  registrarPrueba(
    'T-ENT-01',
    'ENTIDADES',
    'Creación, búsqueda y normalización D-02',
    'Verifica creación de entidades válidas y normalización canónica para EMAIL, DOMINIO, IP y PERSONA.',
    () => {
      const grafo = new GrafoDirigido();
      const e1 = new Entidad({
        id: 'E1',
        tipo: TipoEntidad.EMAIL,
        valor: '  Analista.OSINT@Lab-Seguridad.ORG ',
        descripcion: 'Correo institucional',
      });
      const e2 = new Entidad({
        id: 'E2',
        tipo: TipoEntidad.DOMINIO,
        valor: 'https://www.Lab-Seguridad.ORG/portal/',
      });
      grafo.agregarEntidad(e1);
      grafo.agregarEntidad(e2);

      assertCondition(
        e1.valor_normalizado === 'analista.osint@lab-seguridad.org',
        `Normalización email incorrecta: ${e1.valor_normalizado}`
      );
      assertCondition(
        e2.valor_normalizado === 'lab-seguridad.org',
        `Normalización dominio incorrecta: ${e2.valor_normalizado}`
      );
      assertCondition(grafo.obtenerEntidad('E1')?.id === 'E1', 'No se encontró entidad E1');
      return `Normalizados OK: "${e1.valor_normalizado}" y "${e2.valor_normalizado}".`;
    }
  );

  registrarPrueba(
    'T-ENT-02',
    'ENTIDADES',
    'Rechazo de entidades duplicadas (id o tipo + valor_normalizado)',
    'Verifica que el grafo rechace una entidad con distinto ID pero igual tipo y valor normalizado.',
    () => {
      const grafo = new GrafoDirigido();
      grafo.agregarEntidad(
        new Entidad({ id: 'E1', tipo: TipoEntidad.DOMINIO, valor: 'https://www.Acad-OSINT.edu/' })
      );
      assertThrows(() => {
        grafo.agregarEntidad(
          new Entidad({ id: 'E2', tipo: TipoEntidad.DOMINIO, valor: 'acad-osint.edu' })
        );
      }, 'duplicada');
      return 'Duplicado semántico (tipo + valor_normalizado) bloqueado correctamente.';
    }
  );

  registrarPrueba(
    'T-ENT-03',
    'ENTIDADES',
    'Eliminación de entidad y cascada en aristas incidentes',
    'Verifica que al eliminar una entidad se remuevan sus aristas salientes y entrantes de la lista de adyacencia.',
    () => {
      const grafo = new GrafoDirigido();
      grafo.agregarEntidad(new Entidad({ id: 'A', tipo: TipoEntidad.PERSONA, valor: 'Ana Gomez' }));
      grafo.agregarEntidad(new Entidad({ id: 'B', tipo: TipoEntidad.USUARIO, valor: '@anag' }));
      grafo.agregarRelacion(
        new Relacion({ id: 'R1', origen_id: 'A', destino_id: 'B', tipo: TipoRelacion.POSEE })
      );
      grafo.eliminarEntidad('B');
      assertCondition(!grafo.existeEntidad('B'), 'B sigue existiendo');
      assertCondition(grafo.cantidadAristas === 0, 'La arista R1 no fue eliminada en cascada');
      assertCondition(grafo.obtenerVecinos('A').length === 0, 'A todavía conserva a B como vecino');
      return 'Entidad B y arista incidente R1 eliminadas limpiamente.';
    }
  );

  registrarPrueba(
    'T-ENT-04',
    'ENTIDADES',
    'Operaciones sobre entidades inexistentes',
    'Verifica manejo seguro al buscar o eliminar una entidad que no existe en el grafo.',
    () => {
      const grafo = new GrafoDirigido();
      assertCondition(grafo.obtenerEntidad('NO_EXISTE') === undefined, 'Debería devolver undefined');
      assertThrows(() => grafo.eliminarEntidad('NO_EXISTE'), 'no existe');
      return 'Excepción controlada ante eliminación de entidad inexistente.';
    }
  );

  // =========================================================================
  // CATEGORÍA 2: RELACIONES
  // =========================================================================

  registrarPrueba(
    'T-REL-01',
    'RELACIONES',
    'Creación y eliminación de relación dirigida con evidencias',
    'Verifica creación de relación dirigida tipada con evidencias asociadas y su posterior eliminación.',
    () => {
      const grafo = new GrafoDirigido();
      grafo.agregarEntidad(new Entidad({ id: 'A', tipo: TipoEntidad.DOMINIO, valor: 'portal.org' }));
      grafo.agregarEntidad(new Entidad({ id: 'B', tipo: TipoEntidad.IP, valor: '192.0.2.10' }));

      const ev = new Evidencia({
        id: 'EV1',
        source: 'Registro DNS A',
        description: 'Resolución directa verificada',
        date: '2026-10-01',
      });
      const rel = new Relacion({
        id: 'R1',
        origen_id: 'A',
        destino_id: 'B',
        tipo: TipoRelacion.APUNTA_A,
        evidencias: [ev],
      });
      grafo.agregarRelacion(rel);

      assertCondition(grafo.cantidadAristas === 1, 'Arista no registrada');
      assertCondition(grafo.obtenerRelacion('R1')?.evidencias.length === 1, 'Evidencia no asociada');
      grafo.eliminarRelacion('R1');
      assertCondition(grafo.cantidadAristas === 0, 'Arista no eliminada');
      return 'Relación dirigida con evidencia creada, consultada y eliminada.';
    }
  );

  registrarPrueba(
    'T-REL-02',
    'RELACIONES',
    'Rechazo de relaciones duplicadas (mismo origen, destino y tipo)',
    'Impide registrar dos veces la misma relación dirigida del mismo tipo entre dos entidades.',
    () => {
      const grafo = new GrafoDirigido();
      grafo.agregarEntidad(new Entidad({ id: 'A', tipo: TipoEntidad.PERSONA, valor: 'Carlos Ruiz' }));
      grafo.agregarEntidad(new Entidad({ id: 'B', tipo: TipoEntidad.ORGANIZACION, valor: 'Acme Corp' }));
      grafo.agregarRelacion(
        new Relacion({ id: 'R1', origen_id: 'A', destino_id: 'B', tipo: TipoRelacion.TRABAJA_EN })
      );
      assertThrows(() => {
        grafo.agregarRelacion(
          new Relacion({ id: 'R2', origen_id: 'A', destino_id: 'B', tipo: TipoRelacion.TRABAJA_EN })
        );
      }, 'duplicada');
      return 'Relación dirigida duplicada bloqueada correctamente.';
    }
  );

  registrarPrueba(
    'T-REL-03',
    'RELACIONES',
    'Rechazo de relación con origen o destino inexistente',
    'Verifica integridad referencial dentro del motor del grafo antes de insertar en la lista de adyacencia.',
    () => {
      const grafo = new GrafoDirigido();
      grafo.agregarEntidad(new Entidad({ id: 'A', tipo: TipoEntidad.PERSONA, valor: 'Elena Paz' }));

      assertThrows(() => {
        grafo.agregarRelacion(
          new Relacion({ id: 'R1', origen_id: 'INEXISTENTE', destino_id: 'A', tipo: TipoRelacion.POSEE })
        );
      }, 'origen');

      assertThrows(() => {
        grafo.agregarRelacion(
          new Relacion({ id: 'R2', origen_id: 'A', destino_id: 'INEXISTENTE', tipo: TipoRelacion.POSEE })
        );
      }, 'destino');

      return 'Validación de vértice origen inexistente y destino inexistente superada.';
    }
  );

  // =========================================================================
  // CATEGORÍA 3: GRAFO Y LISTA DE ADYACENCIA
  // =========================================================================

  registrarPrueba(
    'T-GRA-01',
    'GRAFO',
    'Grafo vacío, nodos aislados y consulta de vecinos',
    'Verifica comportamiento de lista de adyacencia en grafo vacío, nodo aislado sin aristas y nodo con múltiples vecinos.',
    () => {
      const grafo = new GrafoDirigido();
      assertCondition(grafo.cantidadVertices === 0 && grafo.cantidadAristas === 0, 'Grafo no inicia vacío');

      grafo.agregarEntidad(new Entidad({ id: 'A', tipo: TipoEntidad.PERSONA, valor: 'Nodo A' }));
      grafo.agregarEntidad(new Entidad({ id: 'B', tipo: TipoEntidad.EMAIL, valor: 'b@test.org' }));
      grafo.agregarEntidad(new Entidad({ id: 'C', tipo: TipoEntidad.DOMINIO, valor: 'test.org' }));
      grafo.agregarEntidad(new Entidad({ id: 'AISLADO', tipo: TipoEntidad.IP, valor: '10.0.0.1' }));

      grafo.agregarRelacion(new Relacion({ id: 'R1', origen_id: 'A', destino_id: 'B', tipo: TipoRelacion.UTILIZA }));
      grafo.agregarRelacion(new Relacion({ id: 'R2', origen_id: 'A', destino_id: 'C', tipo: TipoRelacion.ADMINISTRA }));

      const vecinosA = grafo.obtenerVecinos('A');
      const vecinosAislado = grafo.obtenerVecinos('AISLADO');

      assertCondition(vecinosA.join(',') === 'B,C', `Vecinos de A inesperados: ${vecinosA}`);
      assertCondition(vecinosAislado.length === 0, 'Nodo aislado no debe tener vecinos');
      assertThrows(() => grafo.obtenerVecinos('NO_EXISTE'), 'no existe');

      return `A -> [${vecinosA.join(', ')}], AISLADO -> [] verificados en Lista de Adyacencia.`;
    }
  );

  // =========================================================================
  // CATEGORÍA 4: BFS (ANCHURA)
  // =========================================================================

  registrarPrueba(
    'T-BFS-01',
    'BFS',
    'BFS en grafo simple y con ramas (niveles y predecesores)',
    'Verifica orden por niveles O(V+E) sobre estructura A -> [B, C], B -> [D], C -> [D, E] del Contrato Técnico (Sección 9).',
    () => {
      const grafo = new GrafoDirigido();
      ['A', 'B', 'C', 'D', 'E'].forEach((id) =>
        grafo.agregarEntidad(new Entidad({ id, tipo: TipoEntidad.USUARIO, valor: `user_${id}` }))
      );
      grafo.agregarRelacion(new Relacion({ id: 'R1', origen_id: 'A', destino_id: 'B', tipo: TipoRelacion.POSEE }));
      grafo.agregarRelacion(new Relacion({ id: 'R2', origen_id: 'A', destino_id: 'C', tipo: TipoRelacion.POSEE }));
      grafo.agregarRelacion(new Relacion({ id: 'R3', origen_id: 'B', destino_id: 'D', tipo: TipoRelacion.APUNTA_A }));
      grafo.agregarRelacion(new Relacion({ id: 'R4', origen_id: 'C', destino_id: 'D', tipo: TipoRelacion.APUNTA_A }));
      grafo.agregarRelacion(new Relacion({ id: 'R5', origen_id: 'C', destino_id: 'E', tipo: TipoRelacion.APUNTA_A }));

      const res = grafo.ejecutarBFS('A');
      assertCondition(
        res.ordenRecorrido.join(',') === 'A,B,C,D,E',
        `Orden BFS incorrecto: ${res.ordenRecorrido.join(',')}`
      );
      assertCondition(res.niveles['A'] === 0 && res.niveles['B'] === 1 && res.niveles['D'] === 2, 'Niveles incorrectos');
      assertCondition(res.predecesores['D'] === 'B' && res.predecesores['E'] === 'C', 'Predecesores incorrectos');
      return `Orden BFS: [${res.ordenRecorrido.join(' -> ')}], Niveles: A=0, B=1, C=1, D=2, E=2.`;
    }
  );

  registrarPrueba(
    'T-BFS-02',
    'BFS',
    'BFS en grafo con ciclos dirigidos, nodo aislado y nodo inexistente',
    'Verifica que BFS no entre en bucle infinito ante ciclos A -> B -> C -> A y maneje nodos aislados/inexistentes.',
    () => {
      const grafo = new GrafoDirigido();
      ['A', 'B', 'C', 'AISLADO'].forEach((id) =>
        grafo.agregarEntidad(new Entidad({ id, tipo: TipoEntidad.USUARIO, valor: `u_${id}` }))
      );
      grafo.agregarRelacion(new Relacion({ id: 'R1', origen_id: 'A', destino_id: 'B', tipo: TipoRelacion.APUNTA_A }));
      grafo.agregarRelacion(new Relacion({ id: 'R2', origen_id: 'B', destino_id: 'C', tipo: TipoRelacion.APUNTA_A }));
      grafo.agregarRelacion(new Relacion({ id: 'R3', origen_id: 'C', destino_id: 'A', tipo: TipoRelacion.APUNTA_A }));

      const resCiclo = grafo.ejecutarBFS('A');
      assertCondition(resCiclo.ordenRecorrido.join(',') === 'A,B,C', 'Fallo en ciclo dirigido');

      const resAislado = grafo.ejecutarBFS('AISLADO');
      assertCondition(resAislado.ordenRecorrido.join(',') === 'AISLADO', 'Fallo en nodo aislado');

      assertThrows(() => grafo.ejecutarBFS('FANTASMA'), 'no existe');
      return 'Ciclo dirigido A->B->C->A recorrido en 3 pasos sin repetición; nodo aislado y fantasma validados.';
    }
  );

  // =========================================================================
  // CATEGORÍA 5: DFS RECURSIVO (PROFUNDIDAD)
  // =========================================================================

  registrarPrueba(
    'T-DFS-01',
    'DFS',
    'DFS recursivo en grafo con ramas y ciclos',
    'Verifica exploración en profundidad primero (A -> B -> D antes que C) y corte por caso base ante ciclos.',
    () => {
      const grafo = new GrafoDirigido();
      ['A', 'B', 'C', 'D', 'E'].forEach((id) =>
        grafo.agregarEntidad(new Entidad({ id, tipo: TipoEntidad.USUARIO, valor: `dfs_${id}` }))
      );
      grafo.agregarRelacion(new Relacion({ id: 'R1', origen_id: 'A', destino_id: 'B', tipo: TipoRelacion.POSEE }));
      grafo.agregarRelacion(new Relacion({ id: 'R2', origen_id: 'A', destino_id: 'C', tipo: TipoRelacion.POSEE }));
      grafo.agregarRelacion(new Relacion({ id: 'R3', origen_id: 'B', destino_id: 'D', tipo: TipoRelacion.APUNTA_A }));
      grafo.agregarRelacion(new Relacion({ id: 'R4', origen_id: 'D', destino_id: 'A', tipo: TipoRelacion.APUNTA_A })); // Ciclo hacia A
      grafo.agregarRelacion(new Relacion({ id: 'R5', origen_id: 'C', destino_id: 'E', tipo: TipoRelacion.APUNTA_A }));

      const res = grafo.ejecutarDFS('A');
      assertCondition(
        res.ordenRecorrido.join(',') === 'A,B,D,C,E',
        `Orden DFS recursivo inesperado: ${res.ordenRecorrido.join(',')}`
      );
      assertThrows(() => grafo.ejecutarDFS('INEXISTENTE'), 'no existe');
      return `Orden DFS recursivo verificado: [${res.ordenRecorrido.join(' -> ')}] con detección de ciclo D->A.`;
    }
  );

  // =========================================================================
  // CATEGORÍA 6: BÚSQUEDA DE CAMINOS
  // =========================================================================

  registrarPrueba(
    'T-CAM-01',
    'CAMINOS',
    'Camino mínimo entre múltiples caminos posibles',
    'Dado un camino largo A->B->C->D (3 aristas) y uno corto A->E->D (2 aristas), BFS garantiza encontrar el de 2 aristas.',
    () => {
      const grafo = new GrafoDirigido();
      ['A', 'B', 'C', 'D', 'E'].forEach((id) =>
        grafo.agregarEntidad(new Entidad({ id, tipo: TipoEntidad.USUARIO, valor: `cam_${id}` }))
      );
      // Camino de 3 aristas
      grafo.agregarRelacion(new Relacion({ id: 'R1', origen_id: 'A', destino_id: 'B', tipo: TipoRelacion.POSEE }));
      grafo.agregarRelacion(new Relacion({ id: 'R2', origen_id: 'B', destino_id: 'C', tipo: TipoRelacion.POSEE }));
      grafo.agregarRelacion(new Relacion({ id: 'R3', origen_id: 'C', destino_id: 'D', tipo: TipoRelacion.POSEE }));
      // Camino corto de 2 aristas
      grafo.agregarRelacion(new Relacion({ id: 'R4', origen_id: 'A', destino_id: 'E', tipo: TipoRelacion.UTILIZA }));
      grafo.agregarRelacion(new Relacion({ id: 'R5', origen_id: 'E', destino_id: 'D', tipo: TipoRelacion.ADMINISTRA }));

      const res = grafo.buscarCamino('A', 'D');
      assertCondition(res.existeCamino, 'Debería existir camino');
      assertCondition(res.cantidadAristas === 2, `Se esperaban 2 aristas, se obtuvo ${res.cantidadAristas}`);
      assertCondition(res.caminoNodos.join(',') === 'A,E,D', `Camino incorrecto: ${res.caminoNodos.join(',')}`);
      return `Camino mínimo reconstruido: ${res.caminoNodos.join(' -> ')} (${res.cantidadAristas} aristas).`;
    }
  );

  registrarPrueba(
    'T-CAM-02',
    'CAMINOS',
    'Camino inexistente, origen = destino y nodos inexistentes',
    'Verifica casos borde: grafos desconectados (o dirección opuesta), camino trivial de 0 aristas y validación de nodos.',
    () => {
      const grafo = new GrafoDirigido();
      grafo.agregarEntidad(new Entidad({ id: 'X', tipo: TipoEntidad.DOMINIO, valor: 'x.org' }));
      grafo.agregarEntidad(new Entidad({ id: 'Y', tipo: TipoEntidad.IP, valor: '1.1.1.1' }));
      // Relación sólo de Y -> X (como es dirigido, no hay camino de X -> Y)
      grafo.agregarRelacion(new Relacion({ id: 'R1', origen_id: 'Y', destino_id: 'X', tipo: TipoRelacion.APUNTA_A }));

      const sinCamino = grafo.buscarCamino('X', 'Y');
      assertCondition(!sinCamino.existeCamino, 'No debería existir camino dirigido de X a Y');

      const mismoNodo = grafo.buscarCamino('X', 'X');
      assertCondition(mismoNodo.existeCamino && mismoNodo.cantidadAristas === 0, 'Origen=Destino debe tener 0 aristas');

      assertThrows(() => grafo.buscarCamino('X', 'NO_EXISTE'), 'no existe');
      return 'Dirección estricta respetada (X -/-> Y), caso X->X (0 aristas) y nodo inexistente validados.';
    }
  );

  const finGlobal = performance.now();
  const exitosas = resultados.filter((r) => r.exito).length;

  return {
    total: resultados.length,
    exitosas,
    fallidas: resultados.length - exitosas,
    tiempoTotalMs: Number((finGlobal - inicioGlobal).toFixed(3)),
    resultados,
  };
}
