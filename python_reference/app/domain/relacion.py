"""
Modelo de Dominio: Evidencia y Relación Dirigida
Mini-Maltego Académico — v1.0 (AED3)
"""

from datetime import date
from enum import Enum
from typing import List, Optional


class TipoRelacion(str, Enum):
    POSEE = "POSEE"
    UTILIZA = "UTILIZA"
    TRABAJA_EN = "TRABAJA_EN"
    ADMINISTRA = "ADMINISTRA"
    PERTENECE_A = "PERTENECE_A"
    APUNTA_A = "APUNTA_A"


class Evidencia:
    """Representa la procedencia o respaldo documental de una relación."""

    def __init__(
        self,
        id: str,
        source: str,
        description: str,
        fecha: Optional[str] = None,
    ) -> None:
        if not id or not id.strip():
            raise ValueError("El id de la evidencia es obligatorio.")
        if not source or not source.strip():
            raise ValueError("La fuente (source) de la evidencia es obligatoria.")
        if not description or not description.strip():
            raise ValueError("La descripción de la evidencia es obligatoria.")

        self.id: str = id.strip()
        self.source: str = source.strip()
        self.description: str = description.strip()
        self.date: str = (fecha or date.today().isoformat()).strip()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source": self.source,
            "description": self.description,
            "date": self.date,
        }


class Relacion:
    """Representa una conexión dirigida (arista): Entidad origen -> Relación -> Entidad destino."""

    def __init__(
        self,
        id: str,
        origen_id: str,
        destino_id: str,
        tipo: TipoRelacion,
        descripcion: str = "",
        fecha: Optional[str] = None,
        evidencias: Optional[List[Evidencia]] = None,
    ) -> None:
        if not id or not id.strip():
            raise ValueError("El id de la relación es obligatorio.")
        if not origen_id or not origen_id.strip():
            raise ValueError("El origen_id es obligatorio.")
        if not destino_id or not destino_id.strip():
            raise ValueError("El destino_id es obligatorio.")
        if not isinstance(tipo, TipoRelacion):
            tipo = TipoRelacion(tipo)

        self.id: str = id.strip()
        self.origen_id: str = origen_id.strip()
        self.destino_id: str = destino_id.strip()
        self.tipo: TipoRelacion = tipo
        self.descripcion: str = (descripcion or "").strip()
        self.fecha: str = (fecha or date.today().isoformat()).strip()
        self.evidencias: List[Evidencia] = list(evidencias) if evidencias else []

    def agregar_evidencia(self, evidencia: Evidencia) -> None:
        if any(e.id == evidencia.id for e in self.evidencias):
            raise ValueError(f"La evidencia '{evidencia.id}' ya existe en la relación.")
        self.evidencias.append(evidencia)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "origen_id": self.origen_id,
            "destino_id": self.destino_id,
            "tipo": self.tipo.value,
            "descripcion": self.descripcion,
            "fecha": self.fecha,
            "evidencias": [e.to_dict() for e in self.evidencias],
        }
