/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Network,
  Play,
  Plus,
  Trash2,
  GitBranch,
  Database,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  FileCode2,
  BookOpen,
  Search,
  Globe,
  ArrowRight,
} from 'lucide-react';
import {
  EntidadData,
  TIPOS_ENTIDAD_VALIDOS,
  TipoEntidad,
} from './domain/entidad.ts';
import {
  RelacionData,
  TIPOS_RELACION_VALIDOS,
  TipoRelacion,
} from './domain/relacion.ts';
import {
  EntradaAdyacencia,
  ResultadoBFS,
  ResultadoDFS,
  ResultadoCamino,
} from './domain/grafo.ts';
import { ResumenSuitePruebas } from './domain/grafo.test.ts';
import { CytoscapeCanvas } from './components/CytoscapeCanvas.tsx';

interface EstadoSistema {
  entidades: EntidadData[];
  relaciones: RelacionData[];
  listaAdyacencia: Record<string, EntradaAdyacencia[]>;
  estadisticasBD: Record<string, number>;
  consistenciaVerificada: boolean;
}

type SeccionPrincipal =
  | 'laboratorio'
  | 'estructura'
  | 'pruebas'
  | 'defensa'
  | 'python';

export default function App() {
  const [seccionActiva, setSeccionActiva] = useState<SeccionPrincipal>('laboratorio');
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Selección en el lienzo
  const [nodoSeleccionadoId, setNodoSeleccionadoId] = useState<string | null>(null);
  const [relacionSeleccionadaId, setRelacionSeleccionadaId] = useState<string | null>(null);

  // Pestaña lateral izquierda en el laboratorio
  const [tabLateral, setTabLateral] = useState<'entidad' | 'relacion' | 'algoritmos' | 'osint'>('algoritmos');

  // Formulario de Entidad
  const [tipoNuevaEntidad, setTipoNuevaEntidad] = useState<TipoEntidad>(TipoEntidad.DOMINIO);
  const [valorNuevaEntidad, setValorNuevaEntidad] = useState<string>('');
  const [descNuevaEntidad, setDescNuevaEntidad] = useState<string>('');
  const [metaClave, setMetaClave] = useState<string>('');
  const [metaValor, setMetaValor] = useState<string>('');

  // Formulario de Relación
  const [origenRelId, setOrigenRelId] = useState<string>('');
  const [destinoRelId, setDestinoRelId] = useState<string>('');
  const [tipoNuevaRel, setTipoNuevaRel] = useState<TipoRelacion>(TipoRelacion.APUNTA_A);
  const [descNuevaRel, setDescNuevaRel] = useState<string>('');
  const [evFuente, setEvFuente] = useState<string>('');
  const [evDesc, setEvDesc] = useState<string>('');

  // Formulario de Evidencia adicional sobre relación seleccionada
  const [nuevaEvFuente, setNuevaEvFuente] = useState<string>('');
  const [nuevaEvDesc, setNuevaEvDesc] = useState<string>('');

  // Controles de Algoritmos (BFS, DFS, Camino Mínimo)
  const [algoritmoOrigenId, setAlgoritmoOrigenId] = useState<string>('');
  const [algoritmoDestinoId, setAlgoritmoDestinoId] = useState<string>('');
  const [resultadoBFS, setResultadoBFS] = useState<ResultadoBFS | null>(null);
  const [resultadoDFS, setResultadoDFS] = useState<ResultadoDFS | null>(null);
  const [resultadoCamino, setResultadoCamino] = useState<ResultadoCamino | null>(null);
  const [nodosResaltados, setNodosResaltados] = useState<string[]>([]);
  const [aristasResaltadas, setAristasResaltadas] = useState<string[]>([]);
  const [nivelesActivos, setNivelesActivos] = useState<Record<string, number> | undefined>(undefined);

  // Integración OSINT opcional
  const [dominioOSINT, setDominioOSINT] = useState<string>('example.org');
  const [ejecutandoOSINT, setEjecutandoOSINT] = useState<boolean>(false);

  // Pruebas unitarias del motor
  const [suitePruebas, setSuitePruebas] = useState<ResumenSuitePruebas | null>(null);

  // Archivos de referencia Python
  const [archivosPython, setArchivosPython] = useState<Record<string, string>>({});
  const [archivoPythonActivo, setArchivoPythonActivo] = useState<string>('app/domain/grafo.py');

  // Filtro de búsqueda en estructura
  const [filtroEntidad, setFiltroEntidad] = useState<string>('');

  const notificarError = (msg: string) => {
    setMensajeExito(null);
    setMensajeError(msg);
  };

  const notificarExito = (msg: string) => {
    setMensajeError(null);
    setMensajeExito(msg);
  };

  const cargarEstadoInicial = async () => {
    setCargando(true);
    try {
      const resp = await fetch('/api/estado');
      const data = (await resp.json()) as EstadoSistema;
      setEstado(data);
      if (data.entidades.length > 0) {
        setAlgoritmoOrigenId((prev) => prev || data.entidades[0].id);
        setAlgoritmoDestinoId(
          (prev) => prev || data.entidades[Math.min(7, data.entidades.length - 1)].id
        );
        setOrigenRelId((prev) => prev || data.entidades[0].id);
        setDestinoRelId((prev) => prev || data.entidades[Math.min(1, data.entidades.length - 1)].id);
      }
    } catch {
      notificarError('No se pudo conectar con la capa de aplicación.');
    } finally {
      setCargando(false);
    }
  };

  const ejecutarTestsMotor = async () => {
    try {
      const resp = await fetch('/api/tests');
      const data = (await resp.json()) as ResumenSuitePruebas;
      setSuitePruebas(data);
    } catch {
      notificarError('Error al ejecutar la suite de pruebas del motor.');
    }
  };

  const cargarCodigoPython = async () => {
    try {
      const resp = await fetch('/api/codigo-python');
      const data = await resp.json();
      if (data.archivos) {
        setArchivosPython(data.archivos);
      }
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    cargarEstadoInicial();
    ejecutarTestsMotor();
    cargarCodigoPython();
  }, []);

  const limpiarResultadosAlgoritmo = () => {
    setResultadoBFS(null);
    setResultadoDFS(null);
    setResultadoCamino(null);
    setNodosResaltados([]);
    setAristasResaltadas([]);
    setNivelesActivos(undefined);
  };

  // =========================================================================
  // HANDLERS DE ENTIDADES, RELACIONES Y EVIDENCIAS
  // =========================================================================

  const handleCrearEntidad = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const metadata: Record<string, string> = {};
      if (metaClave.trim() && metaValor.trim()) {
        metadata[metaClave.trim()] = metaValor.trim();
      }
      const resp = await fetch('/api/entidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoNuevaEntidad,
          valor: valorNuevaEntidad,
          descripcion: descNuevaEntidad,
          metadata,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error al registrar entidad');
        return;
      }
      setEstado(data.estado);
      setValorNuevaEntidad('');
      setDescNuevaEntidad('');
      setMetaClave('');
      setMetaValor('');
      notificarExito(
        `Entidad creada: [${data.entidad.tipo}] "${data.entidad.valor_normalizado}" (${data.entidad.id})`
      );
    } catch {
      notificarError('Error de red al crear entidad.');
    }
  };

  const handleEliminarEntidad = async (id: string) => {
    try {
      const resp = await fetch(`/api/entidades/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error al eliminar entidad');
        return;
      }
      setEstado(data.estado);
      if (nodoSeleccionadoId === id) setNodoSeleccionadoId(null);
      limpiarResultadosAlgoritmo();
      notificarExito(data.mensaje);
    } catch {
      notificarError('Error al eliminar entidad.');
    }
  };

  const handleCrearRelacion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const evidencias =
        evFuente.trim() && evDesc.trim()
          ? [{ source: evFuente.trim(), description: evDesc.trim() }]
          : [];
      const resp = await fetch('/api/relaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origen_id: origenRelId,
          destino_id: destinoRelId,
          tipo: tipoNuevaRel,
          descripcion: descNuevaRel,
          evidencias,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error al registrar relación dirigida');
        return;
      }
      setEstado(data.estado);
      setDescNuevaRel('');
      setEvFuente('');
      setEvDesc('');
      notificarExito(
        `Relación dirigida creada: ${data.relacion.origen_id} --[${data.relacion.tipo}]--> ${data.relacion.destino_id}`
      );
    } catch {
      notificarError('Error de red al crear relación.');
    }
  };

  const handleAgregarEvidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relacionSeleccionadaId) return;
    try {
      const resp = await fetch(
        `/api/relaciones/${encodeURIComponent(relacionSeleccionadaId)}/evidencias`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: nuevaEvFuente,
            description: nuevaEvDesc,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error al agregar evidencia');
        return;
      }
      setEstado(data.estado);
      setNuevaEvFuente('');
      setNuevaEvDesc('');
      notificarExito(`Evidencia "${data.evidencia.id}" asociada a la relación ${relacionSeleccionadaId}.`);
    } catch {
      notificarError('Error al asociar evidencia.');
    }
  };

  const handleEliminarRelacion = async (id: string) => {
    try {
      const resp = await fetch(`/api/relaciones/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error al eliminar relación');
        return;
      }
      setEstado(data.estado);
      if (relacionSeleccionadaId === id) setRelacionSeleccionadaId(null);
      limpiarResultadosAlgoritmo();
      notificarExito(data.mensaje);
    } catch {
      notificarError('Error al eliminar relación.');
    }
  };

  // =========================================================================
  // HANDLERS DE ALGORITMOS DEL MOTOR DEL GRAFO (BFS, DFS, CAMINO MÍNIMO)
  // =========================================================================

  const handleEjecutarBFS = async () => {
    if (!algoritmoOrigenId) {
      notificarError('Seleccione una entidad origen para iniciar BFS.');
      return;
    }
    try {
      const resp = await fetch(`/api/grafo/bfs/${encodeURIComponent(algoritmoOrigenId)}`);
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error ejecutando BFS');
        return;
      }
      const bfs = data as ResultadoBFS;
      setResultadoBFS(bfs);
      setResultadoDFS(null);
      setResultadoCamino(null);
      setNodosResaltados(bfs.ordenRecorrido);
      setAristasResaltadas(bfs.aristasRecorrido);
      setNivelesActivos(bfs.niveles);
      notificarExito(
        `BFS completado desde ${algoritmoOrigenId}: ${bfs.ordenRecorrido.length} vértices alcanzados por niveles usando Cola FIFO.`
      );
    } catch {
      notificarError('Error al invocar BFS en el motor del grafo.');
    }
  };

  const handleEjecutarDFS = async () => {
    if (!algoritmoOrigenId) {
      notificarError('Seleccione una entidad origen para iniciar DFS recursivo.');
      return;
    }
    try {
      const resp = await fetch(`/api/grafo/dfs/${encodeURIComponent(algoritmoOrigenId)}`);
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error ejecutando DFS');
        return;
      }
      const dfs = data as ResultadoDFS;
      setResultadoDFS(dfs);
      setResultadoBFS(null);
      setResultadoCamino(null);
      setNodosResaltados(dfs.ordenRecorrido);
      setAristasResaltadas(dfs.aristasRecorrido);
      setNivelesActivos(undefined);
      notificarExito(
        `DFS recursivo completado desde ${algoritmoOrigenId}: ${dfs.ordenRecorrido.length} vértices explorados en profundidad.`
      );
    } catch {
      notificarError('Error al invocar DFS recursivo en el motor del grafo.');
    }
  };

  const handleBuscarCamino = async () => {
    if (!algoritmoOrigenId || !algoritmoDestinoId) {
      notificarError('Seleccione entidad origen y entidad destino.');
      return;
    }
    try {
      const resp = await fetch(
        `/api/grafo/camino?origen=${encodeURIComponent(algoritmoOrigenId)}&destino=${encodeURIComponent(algoritmoDestinoId)}`
      );
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error en búsqueda de camino');
        return;
      }
      const cam = data as ResultadoCamino;
      setResultadoCamino(cam);
      setResultadoBFS(null);
      setResultadoDFS(null);
      setNodosResaltados(cam.caminoNodos);
      setAristasResaltadas(cam.caminoRelaciones);
      setNivelesActivos(cam.nivelesEvaluados);
      if (cam.existeCamino) {
        notificarExito(
          `Camino mínimo encontrado (${cam.cantidadAristas} aristas): ${cam.caminoNodos.join(' → ')}`
        );
      } else {
        notificarError(
          `No existe un camino dirigido desde ${algoritmoOrigenId} hacia ${algoritmoDestinoId}.`
        );
      }
    } catch {
      notificarError('Error al buscar camino en el motor del grafo.');
    }
  };

  const handleResetearCaso = async (modo: 'demo' | 'vacio') => {
    try {
      const resp = await fetch('/api/sistema/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo }),
      });
      const data = (await resp.json()) as EstadoSistema;
      setEstado(data);
      setNodoSeleccionadoId(null);
      setRelacionSeleccionadaId(null);
      limpiarResultadosAlgoritmo();
      if (data.entidades.length > 0) {
        setAlgoritmoOrigenId(data.entidades[0].id);
        setAlgoritmoDestinoId(data.entidades[Math.min(7, data.entidades.length - 1)].id);
        setOrigenRelId(data.entidades[0].id);
        setDestinoRelId(data.entidades[Math.min(1, data.entidades.length - 1)].id);
      }
      notificarExito(
        modo === 'demo'
          ? 'Caso de investigación académico restaurado en SQLite y reconstruido en el Grafo.'
          : 'Base de datos SQLite y Grafo en memoria vaciados.'
      );
    } catch {
      notificarError('Error al reiniciar el estado del sistema.');
    }
  };

  const handleEnriquecerDNS = async (e: React.FormEvent) => {
    e.preventDefault();
    setEjecutandoOSINT(true);
    try {
      const resp = await fetch('/api/osint/dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dominio: dominioOSINT }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        notificarError(data.error || 'Error en adaptador OSINT');
        return;
      }
      setEstado(data.estado);
      notificarExito(
        `OSINT DNS completado para "${data.osint.dominioConsultado}": ${data.osint.registrosDetectados.length} registros A validados, normalizados y persistidos.`
      );
    } catch {
      notificarError('Error al consultar adaptador OSINT DNS.');
    } finally {
      setEjecutandoOSINT(false);
    }
  };

  const obtenerEtiquetaEntidad = (id: string): string => {
    const ent = estado?.entidades.find((e) => e.id === id);
    return ent ? `${ent.valor} (${ent.tipo})` : id;
  };

  const entidadSeleccionada = estado?.entidades.find((e) => e.id === nodoSeleccionadoId) || null;
  const relacionSeleccionada =
    estado?.relaciones.find((r) => r.id === relacionSeleccionadaId) || null;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1120] text-slate-100">
      {/* TOP BAR CONTRACT: Exactamente 3 zonas separadas por gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900/95 border-b border-slate-800 sticky top-0 z-30">
        {/* Zona 1: Brand Title en una sola línea */}
        <a
          href="#laboratorio"
          onClick={(e) => {
            e.preventDefault();
            setSeccionActiva('laboratorio');
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Mini-Maltego Académico
        </a>

        {/* Zona 2: 5 enlaces de navegación de texto en una sola línea */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-400 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSeccionActiva('laboratorio')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              seccionActiva === 'laboratorio'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : ''
            }`}
          >
            Laboratorio de Grafo
          </button>
          <button
            type="button"
            onClick={() => setSeccionActiva('estructura')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              seccionActiva === 'estructura'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : ''
            }`}
          >
            Lista de Adyacencia y BD
          </button>
          <button
            type="button"
            onClick={() => setSeccionActiva('pruebas')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              seccionActiva === 'pruebas'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : ''
            }`}
          >
            Pruebas del Motor
          </button>
          <button
            type="button"
            onClick={() => setSeccionActiva('defensa')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              seccionActiva === 'defensa'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : ''
            }`}
          >
            Trazabilidad AED3
          </button>
          <button
            type="button"
            onClick={() => setSeccionActiva('python')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-0.5 ${
              seccionActiva === 'python'
                ? 'text-sky-400 border-b-2 border-sky-400'
                : ''
            }`}
          >
            Código Python
          </button>
        </nav>

        {/* Zona 3: 1 acción primaria */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => handleResetearCaso('demo')}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Restaurar Caso Demo
          </button>
        </div>
      </header>

      {/* Franja de notificaciones contextuales y consistencia BD <-> Grafo */}
      {(mensajeError || mensajeExito) && (
        <div
          className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
            mensajeError
              ? 'bg-red-950/60 border-red-800/70 text-red-200'
              : 'bg-emerald-950/60 border-emerald-800/70 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {mensajeError ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{mensajeError || mensajeExito}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setMensajeError(null);
              setMensajeExito(null);
            }}
            className="text-slate-400 hover:text-slate-200 underline ml-4 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cerrar aviso
          </button>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL SEGÚN SECCIÓN */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5">
        {cargando || !estado ? (
          <div className="h-96 flex items-center justify-center text-sm text-slate-400">
            Inicializando motor del grafo dirigido y base de datos relacional SQLite...
          </div>
        ) : (
          <>
            {/* =========================================================
                SECCIÓN 1: LABORATORIO DE GRAFO (OPERACIONES + CYTOSCAPE)
               ========================================================= */}
            {seccionActiva === 'laboratorio' && (
              <div className="space-y-5">
                {/* Resumen superior de métricas reales y estado de sincronización BD <-> Grafo */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-slate-200 font-semibold">
                      Estado del Motor en Memoria y Persistencia SQLite
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Vértices (ENTIDAD): {estado.entidades.length}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Aristas Dirigidas (RELACION): {estado.relaciones.length}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Respaldos (EVIDENCIA): {estado.estadisticasBD['EVIDENCIA'] ?? 0}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        estado.consistenciaVerificada ? 'text-emerald-400' : 'text-amber-400'
                      }
                    >
                      {estado.consistenciaVerificada
                        ? 'Sincronización BD ↔ Grafo verificada'
                        : 'Resincronización requerida'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {nodosResaltados.length > 0 && (
                      <button
                        type="button"
                        onClick={limpiarResultadosAlgoritmo}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Limpiar Recorrido Activo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleResetearCaso('vacio')}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Vaciar Grafo
                    </button>
                  </div>
                </div>

                {/* Grilla principal de 12 columnas: Panel de Control (4 cols) + Lienzo Cytoscape y Traza (8 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* COLUMNA IZQUIERDA (4 COLUMNAS): Algoritmos, CRUD Entidades, CRUD Relaciones, OSINT */}
                  <div className="lg:col-span-4 space-y-5">
                    {/* Selector segmentado de modo de operación (Controles interactivos permitidos) */}
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setTabLateral('algoritmos')}
                        className={`px-2 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          tabLateral === 'algoritmos'
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Algoritmos
                      </button>
                      <button
                        type="button"
                        onClick={() => setTabLateral('entidad')}
                        className={`px-2 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          tabLateral === 'entidad'
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        + Entidad
                      </button>
                      <button
                        type="button"
                        onClick={() => setTabLateral('relacion')}
                        className={`px-2 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          tabLateral === 'relacion'
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        + Relación
                      </button>
                      <button
                        type="button"
                        onClick={() => setTabLateral('osint')}
                        className={`px-2 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          tabLateral === 'osint'
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        DNS OSINT
                      </button>
                    </div>

                    {/* PANEL 1: EJECUCIÓN DE ALGORITMOS AED3 (BFS, DFS RECURSIVO, CAMINO MÍNIMO) */}
                    {tabLateral === 'algoritmos' && (
                      <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-5">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-100">
                            Motor Algorítmico Propio (AED3)
                          </h2>
                          <p className="text-xs text-slate-400 mt-1">
                            Ejecuta BFS (Cola FIFO), DFS (Recursivo) o Búsqueda de Caminos Mínimos sobre la Lista de Adyacencia en memoria y proyecta el resultado JSON en Cytoscape.js.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Vértice Origen (BFS / DFS / Camino)
                            </label>
                            <select
                              value={algoritmoOrigenId}
                              onChange={(e) => setAlgoritmoOrigenId(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-sky-500"
                            >
                              {estado.entidades.map((ent) => (
                                <option key={ent.id} value={ent.id}>
                                  [{ent.tipo}] {ent.valor} ({ent.id})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={handleEjecutarBFS}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Ejecutar BFS
                            </button>
                            <button
                              type="button"
                              onClick={handleEjecutarDFS}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-indigo-500 hover:bg-indigo-400 text-white rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                              Ejecutar DFS
                            </button>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-800 space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Vértice Destino (Búsqueda de Camino Mínimo)
                            </label>
                            <select
                              value={algoritmoDestinoId}
                              onChange={(e) => setAlgoritmoDestinoId(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-sky-500"
                            >
                              {estado.entidades.map((ent) => (
                                <option key={ent.id} value={ent.id}>
                                  [{ent.tipo}] {ent.valor} ({ent.id})
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={handleBuscarCamino}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Buscar Camino Mínimo (BFS + Predecesores)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PANEL 2: REGISTRO Y NORMALIZACIÓN DE ENTIDAD */}
                    {tabLateral === 'entidad' && (
                      <form
                        onSubmit={handleCrearEntidad}
                        className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-4"
                      >
                        <div>
                          <h2 className="text-sm font-semibold text-slate-100">
                            Registrar Nueva Entidad (Vértice)
                          </h2>
                          <p className="text-xs text-slate-400 mt-1">
                            Se normaliza automáticamente según D-02 y se valida unicidad por (tipo + valor_normalizado).
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Tipo de Entidad
                          </label>
                          <select
                            value={tipoNuevaEntidad}
                            onChange={(e) => setTipoNuevaEntidad(e.target.value as TipoEntidad)}
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          >
                            {TIPOS_ENTIDAD_VALIDOS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Valor de la Entidad *
                          </label>
                          <input
                            type="text"
                            required
                            value={valorNuevaEntidad}
                            onChange={(e) => setValorNuevaEntidad(e.target.value)}
                            placeholder={
                              tipoNuevaEntidad === TipoEntidad.EMAIL
                                ? 'ej. contacto@dominio.org'
                                : tipoNuevaEntidad === TipoEntidad.IP
                                ? 'ej. 198.51.100.99'
                                : tipoNuevaEntidad === TipoEntidad.DOMINIO
                                ? 'ej. sub.investigacion.edu'
                                : 'Ingrese valor identificatorio'
                            }
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Descripción Contextual
                          </label>
                          <input
                            type="text"
                            value={descNuevaEntidad}
                            onChange={(e) => setDescNuevaEntidad(e.target.value)}
                            placeholder="Observaciones del analista..."
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                              Metadata (Clave opc.)
                            </label>
                            <input
                              type="text"
                              value={metaClave}
                              onChange={(e) => setMetaClave(e.target.value)}
                              placeholder="ej. asn"
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">
                              Metadata (Valor opc.)
                            </label>
                            <input
                              type="text"
                              value={metaValor}
                              onChange={(e) => setMetaValor(e.target.value)}
                              placeholder="ej. AS64496"
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Guardar en SQLite y Grafo
                        </button>
                      </form>
                    )}

                    {/* PANEL 3: REGISTRO DE RELACIÓN DIRIGIDA Y EVIDENCIA */}
                    {tabLateral === 'relacion' && (
                      <form
                        onSubmit={handleCrearRelacion}
                        className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-4"
                      >
                        <div>
                          <h2 className="text-sm font-semibold text-slate-100">
                            Registrar Relación Dirigida (Arista)
                          </h2>
                          <p className="text-xs text-slate-400 mt-1">
                            Conecta Entidad Origen → Relación Tipada → Entidad Destino en la Lista de Adyacencia.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Entidad Origen *
                          </label>
                          <select
                            value={origenRelId}
                            onChange={(e) => setOrigenRelId(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          >
                            {estado.entidades.map((ent) => (
                              <option key={ent.id} value={ent.id}>
                                [{ent.tipo}] {ent.valor} ({ent.id})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Tipo de Relación Dirigida *
                          </label>
                          <select
                            value={tipoNuevaRel}
                            onChange={(e) => setTipoNuevaRel(e.target.value as TipoRelacion)}
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
                          >
                            {TIPOS_RELACION_VALIDOS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Entidad Destino *
                          </label>
                          <select
                            value={destinoRelId}
                            onChange={(e) => setDestinoRelId(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          >
                            {estado.entidades.map((ent) => (
                              <option key={ent.id} value={ent.id}>
                                [{ent.tipo}] {ent.valor} ({ent.id})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Descripción de la Conexión
                          </label>
                          <input
                            type="text"
                            value={descNuevaRel}
                            onChange={(e) => setDescNuevaRel(e.target.value)}
                            placeholder="Detalle del vínculo observado..."
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          />
                        </div>

                        <div className="pt-3 border-t border-slate-800 space-y-2.5">
                          <div className="text-xs font-medium text-slate-300">
                            Evidencia Documental Asociada (Opcional)
                          </div>
                          <input
                            type="text"
                            value={evFuente}
                            onChange={(e) => setEvFuente(e.target.value)}
                            placeholder="Fuente (ej. Registro DNS SOA / WHOIS)"
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          />
                          <input
                            type="text"
                            value={evDesc}
                            onChange={(e) => setEvDesc(e.target.value)}
                            placeholder="Descripción del hallazgo o respaldo..."
                            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Registrar Relación Dirigida
                        </button>
                      </form>
                    )}

                    {/* PANEL 4: ADAPTADOR OSINT OPCIONAL (Sección 18) */}
                    {tabLateral === 'osint' && (
                      <form
                        onSubmit={handleEnriquecerDNS}
                        className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-4"
                      >
                        <div>
                          <h2 className="text-sm font-semibold text-slate-100">
                            Adaptador OSINT Pasivo (DNS-over-HTTPS)
                          </h2>
                          <p className="text-xs text-slate-400 mt-1">
                            Flujo estricto Sección 18: API externa → Adaptador → Validación → Normalización → Dominio → Persistencia SQLite → Grafo.
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Dominio a Consultar (Registros A IPv4)
                          </label>
                          <input
                            type="text"
                            required
                            value={dominioOSINT}
                            onChange={(e) => setDominioOSINT(e.target.value)}
                            placeholder="ej. example.org o uba.ar"
                            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={ejecutandoOSINT}
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          {ejecutandoOSINT
                            ? 'Consultando y Normalizando...'
                            : 'Resolver DNS e Incorporar al Grafo'}
                        </button>
                      </form>
                    )}

                    {/* INSPECTOR CONTEXTUAL DE SELECCIÓN (VÉRTICE O ARISTA/EVIDENCIAS) */}
                    {entidadSeleccionada && (
                      <div className="p-5 bg-slate-900/90 border border-slate-700 rounded-lg space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs text-slate-400 font-mono">
                              {entidadSeleccionada.tipo} · {entidadSeleccionada.id}
                            </div>
                            <h3 className="text-sm font-semibold text-slate-100 mt-0.5 break-all">
                              {entidadSeleccionada.valor}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleEliminarEntidad(entidadSeleccionada.id)}
                            className="px-2.5 py-1 text-xs bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/60 rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Eliminar
                          </button>
                        </div>

                        <div className="text-xs text-slate-300 space-y-1.5 pt-2 border-t border-slate-800">
                          <div>
                            <span className="text-slate-400">Valor normalizado (D-02): </span>
                            <span className="font-mono text-sky-300">
                              {entidadSeleccionada.valor_normalizado}
                            </span>
                          </div>
                          {entidadSeleccionada.descripcion && (
                            <div>
                              <span className="text-slate-400">Descripción: </span>
                              <span>{entidadSeleccionada.descripcion}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-slate-400">Vecinos salientes (Lista Adyacencia): </span>
                            <span className="font-mono">
                              {(estado.listaAdyacencia[entidadSeleccionada.id] || [])
                                .map((a) => `${a.destino_id} (${a.tipo_relacion})`)
                                .join(', ') || 'Ninguno (grado de salida 0)'}
                            </span>
                          </div>
                          {Object.keys(entidadSeleccionada.metadata || {}).length > 0 && (
                            <div className="pt-1">
                              <span className="text-slate-400 block mb-1">Metadata:</span>
                              <div className="font-mono text-[11px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                                {Object.entries(entidadSeleccionada.metadata).map(([k, v]) => (
                                  <div key={k}>
                                    {k}: {v}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {relacionSeleccionada && (
                      <div className="p-5 bg-slate-900/90 border border-slate-700 rounded-lg space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs text-slate-400 font-mono">
                              Arista Dirigida · {relacionSeleccionada.id} · {relacionSeleccionada.fecha}
                            </div>
                            <h3 className="text-sm font-semibold text-slate-100 mt-0.5">
                              {relacionSeleccionada.origen_id} → [{relacionSeleccionada.tipo}] →{' '}
                              {relacionSeleccionada.destino_id}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleEliminarRelacion(relacionSeleccionada.id)}
                            className="px-2.5 py-1 text-xs bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/60 rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Eliminar
                          </button>
                        </div>

                        {relacionSeleccionada.descripcion && (
                          <p className="text-xs text-slate-300">
                            {relacionSeleccionada.descripcion}
                          </p>
                        )}

                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <div className="text-xs font-semibold text-slate-200">
                            Evidencias Asociadas ({relacionSeleccionada.evidencias.length})
                          </div>
                          {relacionSeleccionada.evidencias.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              Sin evidencias documentales registradas para esta relación.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {relacionSeleccionada.evidencias.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs space-y-1"
                                >
                                  <div className="text-slate-300 font-medium">
                                    {ev.source}{' '}
                                    <span className="text-slate-500 font-mono">
                                      · {ev.date} · {ev.id}
                                    </span>
                                  </div>
                                  <div className="text-slate-400">{ev.description}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <form
                          onSubmit={handleAgregarEvidencia}
                          className="pt-3 border-t border-slate-800 space-y-2"
                        >
                          <div className="text-xs font-medium text-slate-300">
                            Añadir Nueva Evidencia a {relacionSeleccionada.id}
                          </div>
                          <input
                            type="text"
                            required
                            value={nuevaEvFuente}
                            onChange={(e) => setNuevaEvFuente(e.target.value)}
                            placeholder="Fuente documental (ej. Certificado TLS)"
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          />
                          <input
                            type="text"
                            required
                            value={nuevaEvDesc}
                            onChange={(e) => setNuevaEvDesc(e.target.value)}
                            placeholder="Descripción técnica verificable..."
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                          />
                          <button
                            type="submit"
                            className="w-full px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded transition-colors cursor-pointer"
                          >
                            Adjuntar Evidencia
                          </button>
                        </form>
                      </div>
                    )}
                  </div>

                  {/* COLUMNA DERECHA (8 COLUMNAS): LIENZO CYTOSCAPE.JS + RESULTADOS Y TRAZA ALGORÍTMICA */}
                  <div className="lg:col-span-8 space-y-5">
                    <div className="h-[500px]">
                      <CytoscapeCanvas
                        entidades={estado.entidades}
                        relaciones={estado.relaciones}
                        nodosResaltados={nodosResaltados}
                        aristasResaltadas={aristasResaltadas}
                        nivelesBFS={nivelesActivos}
                        nodoSeleccionadoId={nodoSeleccionadoId}
                        relacionSeleccionadaId={relacionSeleccionadaId}
                        onSelectNodo={setNodoSeleccionadoId}
                        onSelectRelacion={setRelacionSeleccionadaId}
                      />
                    </div>

                    {/* PANEL DE SALIDA DE ALGORITMOS (BFS / DFS / CAMINOS) */}
                    {resultadoBFS && (
                      <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div>
                            <h3 className="text-sm font-semibold text-sky-400">
                              Resultado del Recorrido en Anchura (BFS Manual con Cola FIFO)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Origen: <span className="font-mono text-slate-200">{resultadoBFS.origen_id}</span> · Complejidad Temporal:{' '}
                              <span className="font-mono text-slate-200">{resultadoBFS.complejidad.tiempo}</span> · Espacio Auxiliar:{' '}
                              <span className="font-mono text-slate-200">{resultadoBFS.complejidad.espacio}</span>
                            </p>
                          </div>
                          <div className="text-xs font-mono tabular-nums text-slate-300">
                            Alcanzados: {resultadoBFS.complejidad.verticesAlcanzados} / {resultadoBFS.complejidad.verticesTotales} vértices
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-slate-300 mb-2">
                            Orden de Recorrido por Niveles (ordenRecorrido · niveles · predecesores):
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-400">
                                  <th className="py-2 pr-3 font-medium">Orden #</th>
                                  <th className="py-2 px-3 font-medium">Vértice ID</th>
                                  <th className="py-2 px-3 font-medium">Entidad (Valor Normalizado)</th>
                                  <th className="py-2 px-3 font-medium text-right">Nivel (Distancia)</th>
                                  <th className="py-2 pl-3 font-medium">Predecesor Directo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                                {resultadoBFS.ordenRecorrido.map((nodoId, index) => (
                                  <tr key={nodoId} className="hover:bg-slate-800/40">
                                    <td className="py-2 pr-3 text-sky-400 font-semibold">
                                      {index + 1}
                                    </td>
                                    <td className="py-2 px-3 text-slate-200">{nodoId}</td>
                                    <td className="py-2 px-3 text-slate-300 font-sans">
                                      {obtenerEtiquetaEntidad(nodoId)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-emerald-400">
                                      Nivel {resultadoBFS.niveles[nodoId]}
                                    </td>
                                    <td className="py-2 pl-3 text-slate-400">
                                      {resultadoBFS.predecesores[nodoId] ?? 'null (Origen)'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800">
                          <div className="text-xs font-medium text-slate-300 mb-2">
                            Traza de Ejecución de la Cola FIFO:
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                            {resultadoBFS.traza.map((t) => (
                              <div
                                key={t.paso}
                                className="p-2 bg-slate-950 border border-slate-800/80 rounded flex flex-col gap-1"
                              >
                                <div className="flex items-center justify-between text-slate-400">
                                  <span className="text-sky-300 font-semibold">
                                    Paso {t.paso} · {t.accion}
                                  </span>
                                  <span>
                                    Cola FIFO: [{t.estructuraAuxiliar.join(', ')}]
                                  </span>
                                </div>
                                <div className="text-slate-300 font-sans">{t.detalle}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {resultadoDFS && (
                      <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div>
                            <h3 className="text-sm font-semibold text-indigo-400">
                              Resultado del Recorrido en Profundidad (DFS Recursivo)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Origen: <span className="font-mono text-slate-200">{resultadoDFS.origen_id}</span> · Relación académica: Grafo + Recursividad + Caso Base (Visitados) · Complejidad:{' '}
                              <span className="font-mono text-slate-200">{resultadoDFS.complejidad.tiempo}</span>
                            </p>
                          </div>
                          <div className="text-xs font-mono tabular-nums text-slate-300">
                            Alcanzados: {resultadoDFS.complejidad.verticesAlcanzados} / {resultadoDFS.complejidad.verticesTotales} vértices
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400">
                                <th className="py-2 pr-3 font-medium">Orden #</th>
                                <th className="py-2 px-3 font-medium">Vértice ID</th>
                                <th className="py-2 px-3 font-medium">Entidad</th>
                                <th className="py-2 px-3 font-medium text-right">Descubrimiento (d)</th>
                                <th className="py-2 px-3 font-medium text-right">Finalización (f)</th>
                                <th className="py-2 pl-3 font-medium">Predecesor Recursivo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                              {resultadoDFS.ordenRecorrido.map((nodoId, index) => (
                                <tr key={nodoId} className="hover:bg-slate-800/40">
                                  <td className="py-2 pr-3 text-indigo-400 font-semibold">
                                    {index + 1}
                                  </td>
                                  <td className="py-2 px-3 text-slate-200">{nodoId}</td>
                                  <td className="py-2 px-3 text-slate-300 font-sans">
                                    {obtenerEtiquetaEntidad(nodoId)}
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-300">
                                    {resultadoDFS.tiemposDescubrimiento[nodoId]}
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-300">
                                    {resultadoDFS.tiemposFinalizacion[nodoId]}
                                  </td>
                                  <td className="py-2 pl-3 text-slate-400">
                                    {resultadoDFS.predecesores[nodoId] ?? 'null (Raíz)'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="pt-2 border-t border-slate-800">
                          <div className="text-xs font-medium text-slate-300 mb-2">
                            Traza de la Pila de Llamadas Recursivas (Call Stack):
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                            {resultadoDFS.traza.map((t) => (
                              <div
                                key={t.paso}
                                className="p-2 bg-slate-950 border border-slate-800/80 rounded flex flex-col gap-1"
                              >
                                <div className="flex items-center justify-between text-slate-400">
                                  <span className="text-indigo-300 font-semibold">
                                    Paso {t.paso} · {t.accion}
                                  </span>
                                  <span>
                                    Pila Recursiva: [{t.estructuraAuxiliar.join(' → ')}]
                                  </span>
                                </div>
                                <div className="text-slate-300 font-sans">{t.detalle}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {resultadoCamino && (
                      <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div>
                            <h3 className="text-sm font-semibold text-emerald-400">
                              Búsqueda de Camino Mínimo (BFS → Predecesores → Reconstrucción Inversa)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Origen: <span className="font-mono text-slate-200">{resultadoCamino.origen_id}</span> → Destino:{' '}
                              <span className="font-mono text-slate-200">{resultadoCamino.destino_id}</span>
                            </p>
                          </div>
                          <div className="text-xs font-mono tabular-nums">
                            {resultadoCamino.existeCamino ? (
                              <span className="text-emerald-400 font-semibold">
                                Camino encontrado ({resultadoCamino.cantidadAristas} aristas)
                              </span>
                            ) : (
                              <span className="text-red-400 font-semibold">
                                Sin camino dirigido posible
                              </span>
                            )}
                          </div>
                        </div>

                        {resultadoCamino.existeCamino && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-slate-300">
                              Secuencia Reconstruida Paso a Paso:
                            </div>
                            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded text-xs">
                              {resultadoCamino.pasosDetallados.map((paso, idx) => (
                                <React.Fragment key={paso.entidad_id}>
                                  {idx > 0 && (
                                    <span className="inline-flex items-center gap-1 font-mono text-sky-400">
                                      <span>--[{paso.tipo_relacion_entrante}]--&gt;</span>
                                    </span>
                                  )}
                                  <span className="font-semibold text-slate-100">
                                    {obtenerEtiquetaEntidad(paso.entidad_id)}{' '}
                                    <span className="font-mono text-slate-400">
                                      ({paso.entidad_id})
                                    </span>
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                SECCIÓN 2: LISTA DE ADYACENCIA EN MEMORIA Y TABLAS SQLITE
               ========================================================= */}
            {seccionActiva === 'estructura' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h1 className="text-lg font-semibold text-slate-100">
                      Inspección de la Lista de Adyacencia en Memoria y Estado Relacional SQLite
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      Sección 9 y 13 del Contrato Técnico: La BD relacional almacena únicamente el estado persistente (TIPO_ENTIDAD, ENTIDAD, TIPO_RELACION, RELACION, EVIDENCIA). El motor construye la Lista de Adyacencia en memoria.
                    </p>
                  </div>
                  <div className="w-64">
                    <input
                      type="text"
                      value={filtroEntidad}
                      onChange={(e) => setFiltroEntidad(e.target.value)}
                      placeholder="Filtrar por ID, valor o tipo..."
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Representación interna de la Lista de Adyacencia: A -> [B, C] */}
                  <div className="lg:col-span-5 p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">
                        Estructura de Datos en Memoria: Lista de Adyacencia
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Representación <span className="font-mono">Vértice Origen → [Vecinos Dirigidos Salientes]</span>
                      </p>
                    </div>

                    <div className="space-y-2 font-mono text-xs max-h-[540px] overflow-y-auto pr-1">
                      {Object.entries(estado.listaAdyacencia)
                        .filter(([verticeId]) => {
                          if (!filtroEntidad.trim()) return true;
                          const q = filtroEntidad.toLowerCase();
                          const ent = estado.entidades.find((e) => e.id === verticeId);
                          return (
                            verticeId.toLowerCase().includes(q) ||
                            (ent && ent.valor.toLowerCase().includes(q)) ||
                            (ent && ent.tipo.toLowerCase().includes(q))
                          );
                        })
                        .map(([verticeId, conexiones]) => {
                          const ent = estado.entidades.find((e) => e.id === verticeId);
                          return (
                            <div
                              key={verticeId}
                              className="p-3 bg-slate-950 border border-slate-800/80 rounded space-y-1"
                            >
                              <div className="flex items-center justify-between text-slate-300">
                                <span className="font-semibold text-sky-400">
                                  {verticeId}{' '}
                                  <span className="text-slate-400 font-normal">
                                    ({ent?.valor})
                                  </span>
                                </span>
                                <span className="text-[11px] text-slate-500 tabular-nums">
                                  grado⁺ = {conexiones.length}
                                </span>
                              </div>
                              <div className="text-slate-300 pl-2">
                                → [{' '}
                                {conexiones.length === 0 ? (
                                  <span className="text-slate-600">∅ sin aristas salientes</span>
                                ) : (
                                  conexiones.map((c, i) => (
                                    <span key={c.relacion_id}>
                                      {i > 0 && ', '}
                                      <span className="text-emerald-400">{c.destino_id}</span>
                                      <span className="text-slate-500">:{c.tipo_relacion}</span>
                                    </span>
                                  ))
                                )}{' '}
                                ]
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Tablas persistentes SQLite: ENTIDAD y RELACION + EVIDENCIA */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-100">
                          Tabla Relacional SQLite: ENTIDAD (Unicidad: tipo + valor_normalizado)
                        </h2>
                        <span className="text-xs font-mono tabular-nums text-slate-400">
                          {estado.entidades.length} registros
                        </span>
                      </div>

                      <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2 pr-3 font-medium">ID</th>
                              <th className="py-2 px-3 font-medium">TIPO_ENTIDAD</th>
                              <th className="py-2 px-3 font-medium">Valor Original</th>
                              <th className="py-2 px-3 font-medium">valor_normalizado</th>
                              <th className="py-2 pl-3 font-medium text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {estado.entidades
                              .filter((e) => {
                                if (!filtroEntidad.trim()) return true;
                                const q = filtroEntidad.toLowerCase();
                                return (
                                  e.id.toLowerCase().includes(q) ||
                                  e.valor.toLowerCase().includes(q) ||
                                  e.valor_normalizado.toLowerCase().includes(q) ||
                                  e.tipo.toLowerCase().includes(q)
                                );
                              })
                              .map((e) => (
                                <tr key={e.id} className="hover:bg-slate-800/40">
                                  <td className="py-2 pr-3 font-mono text-slate-300">{e.id}</td>
                                  <td className="py-2 px-3 font-mono text-sky-400">{e.tipo}</td>
                                  <td className="py-2 px-3 text-slate-200">{e.valor}</td>
                                  <td className="py-2 px-3 font-mono text-emerald-400">
                                    {e.valor_normalizado}
                                  </td>
                                  <td className="py-2 pl-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleEliminarEntidad(e.id)}
                                      className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                                    >
                                      Eliminar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-100">
                          Tablas Relacionales SQLite: RELACION y EVIDENCIA
                        </h2>
                        <span className="text-xs font-mono tabular-nums text-slate-400">
                          {estado.relaciones.length} relaciones ·{' '}
                          {estado.estadisticasBD['EVIDENCIA'] ?? 0} evidencias
                        </span>
                      </div>

                      <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2 pr-3 font-medium">ID</th>
                              <th className="py-2 px-3 font-medium">Origen → Destino</th>
                              <th className="py-2 px-3 font-medium">TIPO_RELACION</th>
                              <th className="py-2 px-3 font-medium text-right">Evidencias</th>
                              <th className="py-2 pl-3 font-medium text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {estado.relaciones.map((r) => (
                              <tr key={r.id} className="hover:bg-slate-800/40">
                                <td className="py-2 pr-3 font-mono text-slate-300">{r.id}</td>
                                <td className="py-2 px-3 font-mono text-slate-200">
                                  {r.origen_id} → {r.destino_id}
                                </td>
                                <td className="py-2 px-3 font-mono text-indigo-400">{r.tipo}</td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">
                                  {r.evidencias.length}
                                </td>
                                <td className="py-2 pl-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarRelacion(r.id)}
                                    className="text-red-400 hover:text-red-300 font-medium cursor-pointer"
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                SECCIÓN 3: SUITE DE PRUEBAS UNITARIAS DEL MOTOR (Sección 19)
               ========================================================= */}
            {seccionActiva === 'pruebas' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h1 className="text-lg font-semibold text-slate-100">
                      Verificación Automatizada del Motor del Grafo (Sección 19 del Contrato Técnico)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      Prueba exhaustivamente Entidades, Relaciones, Lista de Adyacencia, BFS, DFS Recursivo y Búsqueda de Caminos Mínimos en aislamiento de la base de datos y de la interfaz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={ejecutarTestsMotor}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Re-ejecutar Suite de Pruebas
                  </button>
                </div>

                {suitePruebas && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
                        <div className="text-xs text-slate-400">Total Casos de Prueba</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                          {suitePruebas.total}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
                        <div className="text-xs text-slate-400">Pruebas Superadas</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                          {suitePruebas.exitosas}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
                        <div className="text-xs text-slate-400">Pruebas Fallidas</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                          {suitePruebas.fallidas}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg">
                        <div className="text-xs text-slate-400">Tiempo de Ejecución</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-sky-400 mt-1">
                          {suitePruebas.tiempoTotalMs} ms
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2.5 pr-3 font-medium">ID</th>
                            <th className="py-2.5 px-3 font-medium">Categoría</th>
                            <th className="py-2.5 px-3 font-medium">Caso de Prueba y Escenario</th>
                            <th className="py-2.5 px-3 font-medium">Verificación Obtenida</th>
                            <th className="py-2.5 px-3 font-medium text-right">Tiempo</th>
                            <th className="py-2.5 pl-3 font-medium text-right">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {suitePruebas.resultados.map((test) => (
                            <tr key={test.id} className="hover:bg-slate-800/40">
                              <td className="py-3 pr-3 font-mono text-slate-300 whitespace-nowrap">
                                {test.id}
                              </td>
                              <td className="py-3 px-3 font-mono text-sky-400 whitespace-nowrap">
                                {test.categoria}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-200">{test.nombre}</div>
                                <div className="text-slate-400 mt-0.5">{test.descripcion}</div>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-300">
                                {test.detalleResultado}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                                {test.tiempoMs} ms
                              </td>
                              <td className="py-3 pl-3 text-right whitespace-nowrap">
                                {test.exito ? (
                                  <span className="text-emerald-400 font-semibold">APROBADO</span>
                                ) : (
                                  <span className="text-red-400 font-semibold">FALLÓ</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* =========================================================
                SECCIÓN 4: TRAZABILIDAD ACADÉMICA Y PREPARACIÓN DE DEFENSA ORAL
               ========================================================= */}
            {seccionActiva === 'defensa' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <h1 className="text-lg font-semibold text-slate-100">
                    Cadena de Trazabilidad Académica AED3 y Defensa Oral (Secciones 24, 26 y 27)
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Requisito → Funcionalidad → Estructura de Datos → Algoritmo → Implementación → Prueba.
                  </p>
                </div>

                {/* Preguntas fundamentales de defensa oral (Sección 26) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      pregunta: '01. ¿Por qué un grafo dirigido?',
                      respuesta:
                        'Porque el problema modela relaciones OSINT asimétricas con dirección y significado semántico (ej. una PERSONA POSEE un EMAIL, o un DOMINIO APUNTA_A una IP). El sentido de la arista altera la alcanzabilidad.',
                    },
                    {
                      pregunta: '02. ¿Por qué Lista de Adyacencia?',
                      respuesta:
                        'Porque los grafos de investigación OSINT son dispersos (sparse, E << V²). La Lista de Adyacencia consume espacio O(V + E) y permite iterar sobre los vecinos salientes de un nodo en tiempo proporcional a su grado de salida.',
                    },
                    {
                      pregunta: '03. ¿Por qué BFS y una Cola FIFO?',
                      respuesta:
                        'Porque BFS explora el grafo por capas o niveles de distancia utilizando una estructura Cola FIFO (First-In, First-Out). Esto garantiza tiempo O(V + E) y permite hallar caminos con la cantidad mínima de aristas en grafos no ponderados.',
                    },
                    {
                      pregunta: '04. ¿Por qué DFS Recursivo?',
                      respuesta:
                        'Porque permite explorar cada rama en profundidad hasta alcanzar un caso base (nodo sin vecinos nuevos o nodo ya presente en el conjunto de visitados), vinculando directamente la teoría de Grafos con Recursividad en tiempo O(V + E).',
                    },
                    {
                      pregunta: '05. ¿Por qué Base de Datos Relacional SQLite y no Graph DB?',
                      respuesta:
                        'Porque el objetivo académico de AED3 es programar manualmente la estructura del grafo, su lista de adyacencia y los recorridos en memoria. SQLite persiste únicamente las tablas normalizadas (ENTIDAD, RELACION, EVIDENCIA) sin almacenar estructuras de ejecución.',
                    },
                    {
                      pregunta: '06. ¿Por qué Cytoscape.js separado del motor?',
                      respuesta:
                        'Para respetar la separación arquitectónica: el motor propio calcula BFS, DFS y caminos sobre su lista de adyacencia y emite JSON puro; Cytoscape.js actúa exclusivamente como lienzo de renderizado visual.',
                    },
                  ].map((item) => (
                    <div
                      key={item.pregunta}
                      className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-2"
                    >
                      <h3 className="text-sm font-semibold text-sky-400">{item.pregunta}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.respuesta}</p>
                    </div>
                  ))}
                </div>

                {/* Resoluciones de Decisiones Abiertas D-01 a D-05 (Sección 24) */}
                <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg space-y-4">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Resolución Documentada de Decisiones Abiertas (Sección 24 del Contrato Técnico)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 pr-3 font-medium">Código</th>
                          <th className="py-2 px-3 font-medium">Decisión</th>
                          <th className="py-2 pl-3 font-medium">Definición Adoptada y Justificación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        <tr>
                          <td className="py-2.5 pr-3 font-mono text-sky-400">D-01</td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            Persistencia / Consultas Parametrizadas
                          </td>
                          <td className="py-2.5 pl-3 text-slate-300">
                            Se implementó el esquema relacional de 5 tablas (<span className="font-mono">TIPO_ENTIDAD, ENTIDAD, TIPO_RELACION, RELACION, EVIDENCIA</span>) en SQLite con sentencias preparadas parametrizadas y claves foráneas con <span className="font-mono">ON DELETE CASCADE</span>, evitando inyección SQL y manteniendo portabilidad directa a PostgreSQL.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-mono text-sky-400">D-02</td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            Normalización por Tipo de Entidad
                          </td>
                          <td className="py-2.5 pl-3 text-slate-300">
                            Criterio único <span className="font-mono">UNIQUE(tipo_codigo, valor_normalizado)</span>: EMAIL en minúsculas validado; DOMINIO sin esquema ni www.; SITIO_WEB con URL canónica; IP con validación de rango de octetos (0-255); USUARIO en minúsculas sin @ inicial; PERSONA y ORGANIZACION con espacios colapsados y formato Title Case.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-mono text-sky-400">D-03</td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">Metadata</td>
                          <td className="py-2.5 pl-3 text-slate-300">
                            Diccionario plano <span className="font-mono">Record&lt;string, string&gt;</span> serializado en JSON en la columna <span className="font-mono">metadata_json</span> de ENTIDAD. Totalmente desacoplado de BFS, DFS y la Lista de Adyacencia.
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 pr-3 font-mono text-sky-400">D-04</td>
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            Coordinación BD ↔ Grafo
                          </td>
                          <td className="py-2.5 pl-3 text-slate-300">
                            El <span className="font-mono">ServicioCoordinadorGrafo</span> valida primero las invariantes en el motor, ejecuta la transacción SQLite y actualiza el grafo en memoria; ante cualquier discrepancia, invoca <span className="font-mono">reconstruirGrafoDesdeBD()</span> para garantizar consistencia fuerte.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                SECCIÓN 5: REFERENCIA COMPLETA EN PYTHON + PYTEST/UNITTEST
               ========================================================= */}
            {seccionActiva === 'python' && (
              <div className="space-y-5">
                <div className="border-b border-slate-800 pb-4">
                  <h1 className="text-lg font-semibold text-slate-100">
                    Módulos del Motor y Persistencia en Python 3 (Estructura Sección 6 del Contrato)
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Código fuente en Python (<span className="font-mono">python_reference/</span>) verificado con el intérprete Python 3 del entorno, listo para su presentación o ejecución local junto con el entorno web interactivo.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-300 mb-2">
                      Archivos del Proyecto Python:
                    </div>
                    {Object.keys(archivosPython).map((ruta) => (
                      <button
                        key={ruta}
                        type="button"
                        onClick={() => setArchivoPythonActivo(ruta)}
                        className={`w-full text-left px-3 py-2 text-xs font-mono rounded border transition-colors cursor-pointer ${
                          archivoPythonActivo === ruta
                            ? 'bg-sky-950/80 border-sky-700 text-sky-300'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ruta}
                      </button>
                    ))}
                  </div>

                  <div className="lg:col-span-9">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
                        <span>python_reference/{archivoPythonActivo}</span>
                        <span className="text-emerald-400">Python 3.10 · Verificado</span>
                      </div>
                      <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[600px]">
                        <code>{archivosPython[archivoPythonActivo] || 'Seleccione un archivo...'}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
