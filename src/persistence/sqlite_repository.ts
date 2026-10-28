/**
 * Capa de Persistencia Relacional SQLite (Secciones 4, 13, 14, 15, 16 y 17 del Contrato Técnico)
 * Mini-Maltego Académico — v1.0 (AED3)
 *
 * Implementa el modelo relacional (DER):
 * - TIPO_ENTIDAD
 * - ENTIDAD (con restricción UNIQUE(tipo_id, valor_normalizado))
 * - TIPO_RELACION
 * - RELACION (con FK hacia ENTIDAD origen y destino, y TIPO_RELACION)
 * - EVIDENCIA (con FK hacia RELACION en cascada)
 *
 * REGLA (Sección 13):
 * NO se almacenan en BD: GRAFO, LISTA_ADYACENCIA, COLA, VISITADOS ni PREDECESORES.
 * Todas las consultas utilizan sentencias parametrizadas (prevención de SQL Injection, Sección 17).
 */

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { Entidad, EntidadData, TIPOS_ENTIDAD_VALIDOS, TipoEntidad } from '../domain/entidad.ts';
import { Relacion, RelacionData, TIPOS_RELACION_VALIDOS, TipoRelacion } from '../domain/relacion.ts';
import { Evidencia, EvidenciaData } from '../domain/evidencia.ts';

const DB_FILE_PATH = path.resolve(process.cwd(), 'mini_maltego_aed3.sqlite');

export class RepositorioSQLite {
  private db!: SqlJsDatabase;
  private readonly dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || DB_FILE_PATH;
  }

  public async inicializar(): Promise<void> {
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run('PRAGMA foreign_keys = ON;');
    this.crearEsquemaRelacional();
    this.sembrarCatalogosTipos();
    this.guardarEnDisco();
  }

  private guardarEnDisco(): void {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  /**
   * Crea las 5 tablas estrictas del DER definido en la Sección 4 y 13:
   * TIPO_ENTIDAD, ENTIDAD, TIPO_RELACION, RELACION, EVIDENCIA
   */
  private crearEsquemaRelacional(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS TIPO_ENTIDAD (
        codigo TEXT PRIMARY KEY,
        nombre_visible TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ENTIDAD (
        id TEXT PRIMARY KEY,
        tipo_codigo TEXT NOT NULL,
        valor TEXT NOT NULL,
        valor_normalizado TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (tipo_codigo) REFERENCES TIPO_ENTIDAD(codigo),
        UNIQUE (tipo_codigo, valor_normalizado)
      );

      CREATE TABLE IF NOT EXISTS TIPO_RELACION (
        codigo TEXT PRIMARY KEY,
        descripcion_semantica TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS RELACION (
        id TEXT PRIMARY KEY,
        origen_id TEXT NOT NULL,
        destino_id TEXT NOT NULL,
        tipo_codigo TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        fecha TEXT NOT NULL,
        FOREIGN KEY (origen_id) REFERENCES ENTIDAD(id) ON DELETE CASCADE,
        FOREIGN KEY (destino_id) REFERENCES ENTIDAD(id) ON DELETE CASCADE,
        FOREIGN KEY (tipo_codigo) REFERENCES TIPO_RELACION(codigo),
        UNIQUE (origen_id, destino_id, tipo_codigo)
      );

      CREATE TABLE IF NOT EXISTS EVIDENCIA (
        id TEXT PRIMARY KEY,
        relacion_id TEXT NOT NULL,
        source TEXT NOT NULL,
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        FOREIGN KEY (relacion_id) REFERENCES RELACION(id) ON DELETE CASCADE
      );
    `);
  }

  private sembrarCatalogosTipos(): void {
    const stmtTipoEnt = this.db.prepare(
      'INSERT OR IGNORE INTO TIPO_ENTIDAD (codigo, nombre_visible) VALUES (?, ?)'
    );
    for (const codigo of TIPOS_ENTIDAD_VALIDOS) {
      stmtTipoEnt.run([codigo, codigo]);
    }
    stmtTipoEnt.free();

    const stmtTipoRel = this.db.prepare(
      'INSERT OR IGNORE INTO TIPO_RELACION (codigo, descripcion_semantica) VALUES (?, ?)'
    );
    for (const codigo of TIPOS_RELACION_VALIDOS) {
      stmtTipoRel.run([codigo, `Relación dirigida de tipo ${codigo}`]);
    }
    stmtTipoRel.free();
  }

  // =========================================================================
  // TRANSACCIONES Y OPERACIONES DE PERSISTENCIA (Consultas Parametrizadas)
  // =========================================================================

  public insertarEntidad(entidad: Entidad): void {
    const stmt = this.db.prepare(`
      INSERT INTO ENTIDAD (id, tipo_codigo, valor, valor_normalizado, descripcion, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    try {
      stmt.run([
        entidad.id,
        entidad.tipo,
        entidad.valor,
        entidad.valor_normalizado,
        entidad.descripcion,
        JSON.stringify(entidad.metadata || {}),
      ]);
      this.guardarEnDisco();
    } finally {
      stmt.free();
    }
  }

  public eliminarEntidad(id: string): void {
    const stmt = this.db.prepare('DELETE FROM ENTIDAD WHERE id = ?');
    try {
      stmt.run([id]);
      this.guardarEnDisco();
    } finally {
      stmt.free();
    }
  }

  public insertarRelacionConEvidencias(relacion: Relacion): void {
    this.db.run('BEGIN TRANSACTION;');
    try {
      const stmtRel = this.db.prepare(`
        INSERT INTO RELACION (id, origen_id, destino_id, tipo_codigo, descripcion, fecha)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmtRel.run([
        relacion.id,
        relacion.origen_id,
        relacion.destino_id,
        relacion.tipo,
        relacion.descripcion,
        relacion.fecha,
      ]);
      stmtRel.free();

      const stmtEv = this.db.prepare(`
        INSERT INTO EVIDENCIA (id, relacion_id, source, description, date)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const ev of relacion.evidencias) {
        stmtEv.run([ev.id, relacion.id, ev.source, ev.description, ev.date]);
      }
      stmtEv.free();

      this.db.run('COMMIT;');
      this.guardarEnDisco();
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
  }

  public insertarEvidenciaEnRelacion(relacionId: string, evidencia: Evidencia): void {
    const stmt = this.db.prepare(`
      INSERT INTO EVIDENCIA (id, relacion_id, source, description, date)
      VALUES (?, ?, ?, ?, ?)
    `);
    try {
      stmt.run([evidencia.id, relacionId, evidencia.source, evidencia.description, evidencia.date]);
      this.guardarEnDisco();
    } finally {
      stmt.free();
    }
  }

  public eliminarRelacion(id: string): void {
    const stmt = this.db.prepare('DELETE FROM RELACION WHERE id = ?');
    try {
      stmt.run([id]);
      this.guardarEnDisco();
    } finally {
      stmt.free();
    }
  }

  public vaciarDatosInvestigacion(): void {
    this.db.run('BEGIN TRANSACTION;');
    try {
      this.db.run('DELETE FROM EVIDENCIA;');
      this.db.run('DELETE FROM RELACION;');
      this.db.run('DELETE FROM ENTIDAD;');
      this.db.run('COMMIT;');
      this.guardarEnDisco();
    } catch (err) {
      this.db.run('ROLLBACK;');
      throw err;
    }
  }

  public listarEntidades(): EntidadData[] {
    const stmt = this.db.prepare(
      'SELECT id, tipo_codigo, valor, valor_normalizado, descripcion, metadata_json FROM ENTIDAD ORDER BY id ASC'
    );
    const resultado: EntidadData[] = [];
    try {
      while (stmt.step()) {
        const row = stmt.getAsObject() as {
          id: string;
          tipo_codigo: string;
          valor: string;
          valor_normalizado: string;
          descripcion: string;
          metadata_json: string;
        };
        let parsedMeta: Record<string, string> = {};
        try {
          parsedMeta = JSON.parse(row.metadata_json || '{}');
        } catch {
          parsedMeta = {};
        }
        resultado.push({
          id: row.id,
          tipo: row.tipo_codigo as TipoEntidad,
          valor: row.valor,
          valor_normalizado: row.valor_normalizado,
          descripcion: row.descripcion,
          metadata: parsedMeta,
        });
      }
    } finally {
      stmt.free();
    }
    return resultado;
  }

  public listarRelacionesConEvidencias(): RelacionData[] {
    const stmtRel = this.db.prepare(
      'SELECT id, origen_id, destino_id, tipo_codigo, descripcion, fecha FROM RELACION ORDER BY id ASC'
    );
    const stmtEv = this.db.prepare(
      'SELECT id, source, description, date FROM EVIDENCIA WHERE relacion_id = ? ORDER BY date ASC, id ASC'
    );

    const relaciones: RelacionData[] = [];
    try {
      while (stmtRel.step()) {
        const row = stmtRel.getAsObject() as {
          id: string;
          origen_id: string;
          destino_id: string;
          tipo_codigo: string;
          descripcion: string;
          fecha: string;
        };

        const evidencias: EvidenciaData[] = [];
        stmtEv.bind([row.id]);
        while (stmtEv.step()) {
          const evRow = stmtEv.getAsObject() as {
            id: string;
            source: string;
            description: string;
            date: string;
          };
          evidencias.push({
            id: evRow.id,
            source: evRow.source,
            description: evRow.description,
            date: evRow.date,
          });
        }
        stmtEv.reset();

        relaciones.push({
          id: row.id,
          origen_id: row.origen_id,
          destino_id: row.destino_id,
          tipo: row.tipo_codigo as TipoRelacion,
          descripcion: row.descripcion,
          fecha: row.fecha,
          evidencias,
        });
      }
    } finally {
      stmtRel.free();
      stmtEv.free();
    }

    return relaciones;
  }

  public obtenerEstadisticasTablas(): Record<string, number> {
    const tablas = ['TIPO_ENTIDAD', 'ENTIDAD', 'TIPO_RELACION', 'RELACION', 'EVIDENCIA'];
    const conteos: Record<string, number> = {};
    for (const tabla of tablas) {
      const res = this.db.exec(`SELECT COUNT(*) as total FROM ${tabla}`);
      conteos[tabla] = res[0]?.values[0]?.[0] ? Number(res[0].values[0][0]) : 0;
    }
    return conteos;
  }
}
