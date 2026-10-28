/**
 * Servidor Backend API HTTP (Sección 4, 14, 16, 17 del Contrato Técnico)
 * Mini-Maltego Académico — v1.0 (AED3)
 *
 * Responsabilidad de la capa API:
 * - Exponer endpoints HTTP RESTful
 * - Recibir solicitudes y validar entradas (campos obligatorios, tipos, tamaños, prevención XSS/SQLi)
 * - Invocar la capa de aplicación (ServicioCoordinadorGrafo)
 * - Devolver resultados serializados en JSON para consumo de Cytoscape.js y la interfaz web
 * - NO implementa BFS, DFS ni manipula la lista de adyacencia directamente.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GrafoDirigido } from './src/domain/grafo.ts';
import { TIPOS_ENTIDAD_VALIDOS, TipoEntidad } from './src/domain/entidad.ts';
import { TIPOS_RELACION_VALIDOS, TipoRelacion } from './src/domain/relacion.ts';
import { ejecutarSuitePruebasMotor } from './src/domain/grafo.test.ts';
import { RepositorioSQLite } from './src/persistence/sqlite_repository.ts';
import { ServicioCoordinadorGrafo } from './src/services/grafo_service.ts';
import { AdaptadorOSINTDominio } from './src/integrations/osint_adapter.ts';

function sanitizarTextoBasico(valor: unknown, maxLen: number = 500): string {
  if (typeof valor !== 'string') return '';
  return valor
    .trim()
    .slice(0, maxLen)
    .replace(/[<>]/g, ''); // Mitigación XSS básica en campos descriptivos
}

async function iniciarServidor() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // 1. Inicializar Persistencia SQLite y Motor del Grafo en Memoria
  const repositorioSQLite = new RepositorioSQLite();
  await repositorioSQLite.inicializar();

  const motorGrafo = new GrafoDirigido();
  const servicioGrafo = new ServicioCoordinadorGrafo(repositorioSQLite, motorGrafo);
  const adaptadorOSINT = new AdaptadorOSINTDominio(servicioGrafo);

  // Reconstruir el grafo desde SQLite; si está vacío, sembrar el caso de estudio académico inicial
  servicioGrafo.reconstruirGrafoDesdeBD();
  if (motorGrafo.cantidadVertices === 0) {
    servicioGrafo.cargarCasoInvestigacionAcademico();
  }

  // =========================================================================
  // ENDPOINTS API HTTP (/api/*)
  // =========================================================================

  // 1. Estado completo del sistema (Entidades, Relaciones, Lista de Adyacencia, Estadísticas SQLite)
  app.get('/api/estado', (_req: Request, res: Response) => {
    try {
      res.json(servicioGrafo.obtenerEstadoCompleto());
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Error interno del servidor' });
    }
  });

  // 2. Crear Entidad (POST /api/entidades)
  app.post('/api/entidades', (req: Request, res: Response) => {
    try {
      const { id, tipo, valor, descripcion, metadata } = req.body || {};
      if (!tipo || !TIPOS_ENTIDAD_VALIDOS.includes(tipo)) {
        res.status(400).json({
          error: `Tipo de entidad inválido. Valores permitidos: ${TIPOS_ENTIDAD_VALIDOS.join(', ')}`,
        });
        return;
      }
      if (!valor || typeof valor !== 'string' || !valor.trim()) {
        res.status(400).json({ error: 'El campo "valor" es obligatorio.' });
        return;
      }

      const metaSanitizada: Record<string, string> = {};
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        for (const [k, v] of Object.entries(metadata)) {
          const claveLimpia = sanitizarTextoBasico(k, 60);
          const valorLimpio = sanitizarTextoBasico(String(v ?? ''), 200);
          if (claveLimpia && valorLimpio) {
            metaSanitizada[claveLimpia] = valorLimpio;
          }
        }
      }

      const creada = servicioGrafo.crearEntidad({
        id: id ? sanitizarTextoBasico(id, 40) : undefined,
        tipo: tipo as TipoEntidad,
        valor: sanitizarTextoBasico(valor, 250),
        descripcion: sanitizarTextoBasico(descripcion, 500),
        metadata: metaSanitizada,
      });

      res.status(201).json({
        entidad: creada,
        estado: servicioGrafo.obtenerEstadoCompleto(),
      });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Error al crear entidad' });
    }
  });

  // 3. Eliminar Entidad (DELETE /api/entidades/:id)
  app.delete('/api/entidades/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '').trim();
      servicioGrafo.eliminarEntidad(id);
      res.json({
        mensaje: `Entidad "${id}" y sus relaciones incidentes eliminadas.`,
        estado: servicioGrafo.obtenerEstadoCompleto(),
      });
    } catch (err: unknown) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Error al eliminar entidad' });
    }
  });

  // 4. Crear Relación Dirigida con Evidencia Inicial (POST /api/relaciones)
  app.post('/api/relaciones', (req: Request, res: Response) => {
    try {
      const { id, origen_id, destino_id, tipo, descripcion, fecha, evidencias } = req.body || {};

      if (!origen_id || !destino_id) {
        res.status(400).json({ error: 'Los campos "origen_id" y "destino_id" son obligatorios.' });
        return;
      }
      if (!tipo || !TIPOS_RELACION_VALIDOS.includes(tipo)) {
        res.status(400).json({
          error: `Tipo de relación inválido. Valores permitidos: ${TIPOS_RELACION_VALIDOS.join(', ')}`,
        });
        return;
      }

      const listaEvidencias = Array.isArray(evidencias)
        ? evidencias
            .filter((ev) => ev && typeof ev.source === 'string' && ev.source.trim())
            .map((ev) => ({
              source: sanitizarTextoBasico(ev.source, 150),
              description: sanitizarTextoBasico(ev.description || 'Evidencia registrada', 400),
              date: sanitizarTextoBasico(ev.date, 20) || undefined,
            }))
        : [];

      const creada = servicioGrafo.crearRelacion({
        id: id ? sanitizarTextoBasico(id, 40) : undefined,
        origen_id: sanitizarTextoBasico(origen_id, 50),
        destino_id: sanitizarTextoBasico(destino_id, 50),
        tipo: tipo as TipoRelacion,
        descripcion: sanitizarTextoBasico(descripcion, 500),
        fecha: sanitizarTextoBasico(fecha, 20) || undefined,
        evidencias: listaEvidencias,
      });

      res.status(201).json({
        relacion: creada,
        estado: servicioGrafo.obtenerEstadoCompleto(),
      });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Error al crear relación' });
    }
  });

  // 5. Agregar Evidencia a una Relación Existente (POST /api/relaciones/:id/evidencias)
  app.post('/api/relaciones/:id/evidencias', (req: Request, res: Response) => {
    try {
      const relacionId = String(req.params.id || '').trim();
      const { source, description, date } = req.body || {};

      if (!source || typeof source !== 'string' || !source.trim()) {
        res.status(400).json({ error: 'La fuente (source) de la evidencia es obligatoria.' });
        return;
      }
      if (!description || typeof description !== 'string' || !description.trim()) {
        res.status(400).json({ error: 'La descripción de la evidencia es obligatoria.' });
        return;
      }

      const evidencia = servicioGrafo.agregarEvidenciaARelacion(relacionId, {
        source: sanitizarTextoBasico(source, 150),
        description: sanitizarTextoBasico(description, 400),
        date: sanitizarTextoBasico(date, 20) || undefined,
      });

      res.status(201).json({
        evidencia,
        estado: servicioGrafo.obtenerEstadoCompleto(),
      });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Error al agregar evidencia' });
    }
  });

  // 6. Eliminar Relación (DELETE /api/relaciones/:id)
  app.delete('/api/relaciones/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '').trim();
      servicioGrafo.eliminarRelacion(id);
      res.json({
        mensaje: `Relación "${id}" eliminada.`,
        estado: servicioGrafo.obtenerEstadoCompleto(),
      });
    } catch (err: unknown) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Error al eliminar relación' });
    }
  });

  // 7. Ejecutar Recorrido BFS Manual (GET /api/grafo/bfs/:origenId)
  app.get('/api/grafo/bfs/:origenId', (req: Request, res: Response) => {
    try {
      const origenId = String(req.params.origenId || '').trim();
      const resultado = servicioGrafo.ejecutarBFS(origenId);
      res.json(resultado);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Error en ejecución de BFS' });
    }
  });

  // 8. Ejecutar Recorrido DFS Recursivo (GET /api/grafo/dfs/:origenId)
  app.get('/api/grafo/dfs/:origenId', (req: Request, res: Response) => {
    try {
      const origenId = String(req.params.origenId || '').trim();
      const resultado = servicioGrafo.ejecutarDFS(origenId);
      res.json(resultado);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Error en ejecución de DFS' });
    }
  });

  // 9. Buscar Camino Mínimo con BFS + Predecesores (GET /api/grafo/camino)
  app.get('/api/grafo/camino', (req: Request, res: Response) => {
    try {
      const origenId = String(req.query.origen || '').trim();
      const destinoId = String(req.query.destino || '').trim();
      if (!origenId || !destinoId) {
        res.status(400).json({ error: 'Debe especificar los parámetros "origen" y "destino".' });
        return;
      }
      const resultado = servicioGrafo.buscarCamino(origenId, destinoId);
      res.json(resultado);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Error en búsqueda de camino' });
    }
  });

  // 10. Ejecutar Suite de Pruebas Unitarias del Motor (GET /api/tests)
  app.get('/api/tests', (_req: Request, res: Response) => {
    try {
      const resumen = ejecutarSuitePruebasMotor();
      res.json(resumen);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Error ejecutando suite de pruebas' });
    }
  });

  // 11. Restaurar Caso de Investigación Académico o Vaciar Grafo (POST /api/sistema/reset)
  app.post('/api/sistema/reset', (req: Request, res: Response) => {
    try {
      const modo = req.body?.modo === 'vacio' ? 'vacio' : 'demo';
      if (modo === 'vacio') {
        repositorioSQLite.vaciarDatosInvestigacion();
        servicioGrafo.reconstruirGrafoDesdeBD();
        res.json(servicioGrafo.obtenerEstadoCompleto());
      } else {
        const estado = servicioGrafo.cargarCasoInvestigacionAcademico();
        res.json(estado);
      }
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Error al reiniciar el sistema' });
    }
  });

  // 12. Integración OSINT Opcional: Resolución DNS Pasiva (POST /api/osint/dns)
  app.post('/api/osint/dns', async (req: Request, res: Response) => {
    try {
      const dominio = String(req.body?.dominio || '').trim();
      if (!dominio) {
        res.status(400).json({ error: 'Debe ingresar un nombre de dominio válido (ej. example.org).' });
        return;
      }
      const resultadoOSINT = await adaptadorOSINT.enriquecerDominioDNS(dominio);
      res.json({
        osint: resultadoOSINT,
        estado: servicioGrafo.obtenerEstadoCompleto(),
      });
    } catch (err: unknown) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Error en el adaptador OSINT DNS',
      });
    }
  });

  // 13. Exponer archivos de referencia Python / pytest del proyecto para inspección o descarga académica
  app.get('/api/codigo-python', (_req: Request, res: Response) => {
    try {
      const baseDir = path.resolve(process.cwd(), 'python_reference');
      const archivos: Record<string, string> = {};
      if (fs.existsSync(baseDir)) {
        const leerRecursivo = (dir: string, prefijo: string = '') => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const relPath = prefijo ? `${prefijo}/${entry.name}` : entry.name;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              leerRecursivo(fullPath, relPath);
            } else if (entry.name.endsWith('.py') || entry.name.endsWith('.md')) {
              archivos[relPath] = fs.readFileSync(fullPath, 'utf-8');
            }
          }
        };
        leerRecursivo(baseDir);
      }
      res.json({ archivos });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Error leyendo referencia Python' });
    }
  });

  // =========================================================================
  // MONTAJE DE VITE EN DESARROLLO O ESTÁTICOS EN PRODUCCIÓN
  // =========================================================================
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mini-Maltego Académico v1.0] Servidor activo en http://0.0.0.0:${PORT}`);
  });
}

iniciarServidor();
