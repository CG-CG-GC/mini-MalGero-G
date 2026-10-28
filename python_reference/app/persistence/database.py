"""
Capa de Persistencia SQLite y Servicio Coordinador (Python Reference)
Mini-Maltego Académico — v1.0 (AED3)
"""

import json
import sqlite3
from typing import Dict, List
from app.domain.entidad import Entidad, TipoEntidad
from app.domain.relacion import Relacion, TipoRelacion, Evidencia
from app.domain.grafo import GrafoDirigido


class RepositorioSQLitePython:
    """Persistencia relacional SQLite parametrizada (Secciones 4, 13, 14 y 17)."""

    def __init__(self, db_path: str = "mini_maltego.sqlite") -> None:
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.execute("PRAGMA foreign_keys = ON;")
        self._crear_tablas()

    def _crear_tablas(self) -> None:
        with self.conn:
            self.conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS TIPO_ENTIDAD (
                    codigo TEXT PRIMARY KEY,
                    nombre_visible TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS ENTIDAD (
                    id TEXT PRIMARY KEY,
                    tipo_codigo TEXT NOT NULL REFERENCES TIPO_ENTIDAD(codigo),
                    valor TEXT NOT NULL,
                    valor_normalizado TEXT NOT NULL,
                    descripcion TEXT NOT NULL DEFAULT '',
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    UNIQUE(tipo_codigo, valor_normalizado)
                );
                CREATE TABLE IF NOT EXISTS TIPO_RELACION (
                    codigo TEXT PRIMARY KEY,
                    descripcion_semantica TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS RELACION (
                    id TEXT PRIMARY KEY,
                    origen_id TEXT NOT NULL REFERENCES ENTIDAD(id) ON DELETE CASCADE,
                    destino_id TEXT NOT NULL REFERENCES ENTIDAD(id) ON DELETE CASCADE,
                    tipo_codigo TEXT NOT NULL REFERENCES TIPO_RELACION(codigo),
                    descripcion TEXT NOT NULL DEFAULT '',
                    fecha TEXT NOT NULL,
                    UNIQUE(origen_id, destino_id, tipo_codigo)
                );
                CREATE TABLE IF NOT EXISTS EVIDENCIA (
                    id TEXT PRIMARY KEY,
                    relacion_id TEXT NOT NULL REFERENCES RELACION(id) ON DELETE CASCADE,
                    source TEXT NOT NULL,
                    description TEXT NOT NULL,
                    date TEXT NOT NULL
                );
                """
            )
            for t_ent in TipoEntidad:
                self.conn.execute(
                    "INSERT OR IGNORE INTO TIPO_ENTIDAD (codigo, nombre_visible) VALUES (?, ?)",
                    (t_ent.value, t_ent.value),
                )
            for t_rel in TipoRelacion:
                self.conn.execute(
                    "INSERT OR IGNORE INTO TIPO_RELACION (codigo, descripcion_semantica) VALUES (?, ?)",
                    (t_rel.value, f"Relación dirigida {t_rel.value}"),
                )

    def guardar_entidad(self, entidad: Entidad) -> None:
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO ENTIDAD (id, tipo_codigo, valor, valor_normalizado, descripcion, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    entidad.id,
                    entidad.tipo.value,
                    entidad.valor,
                    entidad.valor_normalizado,
                    entidad.descripcion,
                    json.dumps(entidad.metadata),
                ),
            )

    def guardar_relacion(self, relacion: Relacion) -> None:
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO RELACION (id, origen_id, destino_id, tipo_codigo, descripcion, fecha)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    relacion.id,
                    relacion.origen_id,
                    relacion.destino_id,
                    relacion.tipo.value,
                    relacion.descripcion,
                    relacion.fecha,
                ),
            )
            for ev in relacion.evidencias:
                self.conn.execute(
                    """
                    INSERT INTO EVIDENCIA (id, relacion_id, source, description, date)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (ev.id, relacion.id, ev.source, ev.description, ev.date),
                )
