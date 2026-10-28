import React, { useEffect, useRef } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { EntidadData, TipoEntidad } from '../domain/entidad.ts';
import { RelacionData } from '../domain/relacion.ts';

interface CytoscapeCanvasProps {
  entidades: EntidadData[];
  relaciones: RelacionData[];
  nodosResaltados: string[];
  aristasResaltadas: string[];
  nivelesBFS?: Record<string, number>;
  nodoSeleccionadoId: string | null;
  relacionSeleccionadaId: string | null;
  onSelectNodo: (id: string | null) => void;
  onSelectRelacion: (id: string | null) => void;
}

const COLORES_POR_TIPO: Record<TipoEntidad, { bg: string; border: string }> = {
  [TipoEntidad.PERSONA]: { bg: '#1D4ED8', border: '#60A5FA' },
  [TipoEntidad.ORGANIZACION]: { bg: '#0F766E', border: '#2DD4BF' },
  [TipoEntidad.EMAIL]: { bg: '#B45309', border: '#FBBF24' },
  [TipoEntidad.USUARIO]: { bg: '#4338CA', border: '#818CF8' },
  [TipoEntidad.DOMINIO]: { bg: '#0369A1', border: '#38BDF8' },
  [TipoEntidad.SITIO_WEB]: { bg: '#15803D', border: '#4ADE80' },
  [TipoEntidad.IP]: { bg: '#B91C1C', border: '#F87171' },
};

export const CytoscapeCanvas: React.FC<CytoscapeCanvasProps> = ({
  entidades,
  relaciones,
  nodosResaltados,
  aristasResaltadas,
  nivelesBFS,
  nodoSeleccionadoId,
  relacionSeleccionadaId,
  onSelectNodo,
  onSelectRelacion,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  // Construir o actualizar el grafo visual cuando cambian las entidades o relaciones
  useEffect(() => {
    if (!containerRef.current) return;

    const elementos: ElementDefinition[] = [];

    for (const ent of entidades) {
      const paleta = COLORES_POR_TIPO[ent.tipo] || { bg: '#334155', border: '#94A3B8' };
      const ordenPaso = nodosResaltados.indexOf(ent.id);
      const etiquetaNivel =
        nivelesBFS && nivelesBFS[ent.id] !== undefined ? ` [N${nivelesBFS[ent.id]}]` : '';
      const etiquetaOrden = ordenPaso >= 0 ? `#${ordenPaso + 1} ` : '';

      elementos.push({
        group: 'nodes',
        data: {
          id: ent.id,
          label: `${etiquetaOrden}${ent.valor}${etiquetaNivel}`,
          subLabel: `${ent.tipo} · ${ent.id}`,
          tipo: ent.tipo,
          bgColor: paleta.bg,
          borderColor: paleta.border,
        },
        classes: [
          nodosResaltados.includes(ent.id) ? 'algoritmo-activo' : '',
          nodosResaltados.length > 0 && !nodosResaltados.includes(ent.id) ? 'atenuado' : '',
          nodoSeleccionadoId === ent.id ? 'seleccionado' : '',
        ]
          .filter(Boolean)
          .join(' '),
      });
    }

    for (const rel of relaciones) {
      elementos.push({
        group: 'edges',
        data: {
          id: rel.id,
          source: rel.origen_id,
          target: rel.destino_id,
          label: `${rel.tipo}${rel.evidencias.length > 0 ? ` (${rel.evidencias.length} ev)` : ''}`,
        },
        classes: [
          aristasResaltadas.includes(rel.id) ? 'arista-activa' : '',
          nodosResaltados.length > 0 && !aristasResaltadas.includes(rel.id) ? 'atenuado' : '',
          relacionSeleccionadaId === rel.id ? 'arista-seleccionada' : '',
        ]
          .filter(Boolean)
          .join(' '),
      });
    }

    if (!cyRef.current) {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: elementos,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(bgColor)',
              'border-color': 'data(borderColor)',
              'border-width': 2,
              label: 'data(label)',
              color: '#F8FAFC',
              'font-family': 'Plus Jakarta Sans, sans-serif',
              'font-size': 11,
              'font-weight': 600,
              'text-valign': 'bottom',
              'text-halign': 'center',
              'text-margin-y': 7,
              'text-background-color': '#0B1120',
              'text-background-opacity': 0.85,
              'text-background-padding': '3px',
              'text-background-shape': 'roundrectangle',
              width: 36,
              height: 36,
            },
          },
          {
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#475569',
              'target-arrow-color': '#64748B',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              label: 'data(label)',
              color: '#94A3B8',
              'font-family': 'JetBrains Mono, monospace',
              'font-size': 9,
              'text-rotation': 'autorotate',
              'text-margin-y': -8,
              'text-background-color': '#0B1120',
              'text-background-opacity': 0.85,
              'text-background-padding': '2px',
            },
          },
          {
            selector: 'node.algoritmo-activo',
            style: {
              'border-color': '#38BDF8',
              'border-width': 4,
              width: 44,
              height: 44,
              color: '#38BDF8',
              'font-weight': 700,
            },
          },
          {
            selector: 'edge.arista-activa',
            style: {
              width: 3.5,
              'line-color': '#38BDF8',
              'target-arrow-color': '#38BDF8',
              color: '#E0F2FE',
              'font-weight': 600,
            },
          },
          {
            selector: 'node.seleccionado',
            style: {
              'border-color': '#FACC15',
              'border-width': 4,
              width: 44,
              height: 44,
            },
          },
          {
            selector: 'edge.arista-seleccionada',
            style: {
              width: 3.5,
              'line-color': '#FACC15',
              'target-arrow-color': '#FACC15',
              color: '#FEF08A',
            },
          },
          {
            selector: '.atenuado',
            style: {
              opacity: 0.28,
            },
          },
        ],
        layout: {
          name: 'breadthfirst',
          directed: true,
          padding: 45,
          spacingFactor: 1.25,
        },
      });

      cyRef.current.on('tap', 'node', (evt) => {
        const nodeId = evt.target.id();
        onSelectRelacion(null);
        onSelectNodo(nodeId);
      });

      cyRef.current.on('tap', 'edge', (evt) => {
        const edgeId = evt.target.id();
        onSelectNodo(null);
        onSelectRelacion(edgeId);
      });

      cyRef.current.on('tap', (evt) => {
        if (evt.target === cyRef.current) {
          onSelectNodo(null);
          onSelectRelacion(null);
        }
      });
    } else {
      const cy = cyRef.current;
      const prevCount = cy.nodes().length + cy.edges().length;
      const newCount = elementos.length;

      cy.json({ elements: elementos });

      if (prevCount !== newCount) {
        cy.layout({
          name: 'breadthfirst',
          directed: true,
          padding: 45,
          spacingFactor: 1.25,
          animate: false,
        }).run();
      }
    }
  }, [
    entidades,
    relaciones,
    nodosResaltados,
    aristasResaltadas,
    nivelesBFS,
    nodoSeleccionadoId,
    relacionSeleccionadaId,
  ]);

  const aplicarLayout = (nombreLayout: 'breadthfirst' | 'circle' | 'cose' | 'grid') => {
    if (!cyRef.current) return;
    cyRef.current
      .layout({
        name: nombreLayout,
        directed: true,
        padding: 45,
        spacingFactor: 1.2,
        animate: false,
      })
      .run();
    cyRef.current.fit(undefined, 40);
  };

  const centrarVista = () => {
    if (!cyRef.current) return;
    cyRef.current.fit(undefined, 40);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0B1120] border border-slate-800 rounded-lg overflow-hidden">
      {/* Barra superior de control del lienzo Cytoscape.js */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3 text-slate-300">
          <span className="font-semibold text-slate-100">Visualizador Cytoscape.js</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono tabular-nums text-slate-400">
            |V| = {entidades.length} vértices
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono tabular-nums text-slate-400">
            |E| = {relaciones.length} aristas dirigidas
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 mr-1">Disposición:</span>
          <button
            type="button"
            onClick={() => aplicarLayout('breadthfirst')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Jerárquico (Niveles)
          </button>
          <button
            type="button"
            onClick={() => aplicarLayout('cose')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Fuerzas (CoSE)
          </button>
          <button
            type="button"
            onClick={() => aplicarLayout('circle')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Circular
          </button>
          <button
            type="button"
            onClick={centrarVista}
            className="px-2.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-800/60 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ajustar Vista
          </button>
        </div>
      </div>

      {/* Lienzo interactivo */}
      <div ref={containerRef} className="w-full flex-1 min-h-[420px]" />

      {/* Leyenda cromática de tipos de entidad (sin píldoras estáticas decorativas; texto limpio con separadores) */}
      <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-slate-300">Tipos de Vértice:</span>
          {Object.entries(COLORES_POR_TIPO).map(([tipo, col], idx) => (
            <React.Fragment key={tipo}>
              {idx > 0 && <span aria-hidden="true" className="text-slate-700">·</span>}
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm border"
                  style={{ backgroundColor: col.bg, borderColor: col.border }}
                />
                <span className="font-mono">{tipo}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
        <div className="text-slate-400">
          Cadena: <span className="font-mono text-slate-300">Motor Propio → Lista Adyacencia → Algoritmo → JSON → Cytoscape.js</span>
        </div>
      </div>
    </div>
  );
};
