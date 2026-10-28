"""
Modelo de Dominio: Entidad y Reglas de Normalización (D-02)
Mini-Maltego Académico — v1.0 (AED3)
"""

from enum import Enum
from typing import Dict, Optional
from urllib.parse import urlparse


class TipoEntidad(str, Enum):
    PERSONA = "PERSONA"
    ORGANIZACION = "ORGANIZACION"
    EMAIL = "EMAIL"
    USUARIO = "USUARIO"
    DOMINIO = "DOMINIO"
    SITIO_WEB = "SITIO_WEB"
    IP = "IP"


def normalizar_valor_entidad(tipo: TipoEntidad, valor_crudo: str) -> str:
    """
    Normaliza el valor de la entidad según su tipo (D-02) para garantizar
    el criterio conceptual de unicidad: (tipo + valor_normalizado).
    """
    limpio = (valor_crudo or "").strip()
    if not limpio:
        raise ValueError("El valor de la entidad no puede estar vacío.")

    if tipo == TipoEntidad.EMAIL:
        norm = limpio.lower()
        partes = norm.split("@")
        if len(partes) != 2 or not partes[0] or "." not in partes[1]:
            raise ValueError(f"Formato de EMAIL inválido: '{valor_crudo}'")
        return norm

    if tipo == TipoEntidad.DOMINIO:
        norm = limpio.lower()
        for prefijo in ("https://", "http://"):
            if norm.startswith(prefijo):
                norm = norm[len(prefijo):]
        norm = norm.split("/")[0]
        if norm.startswith("www."):
            norm = norm[4:]
        norm = norm.rstrip(".")
        if not norm or "." not in norm or " " in norm:
            raise ValueError(f"Formato de DOMINIO inválido: '{valor_crudo}'")
        return norm

    if tipo == TipoEntidad.SITIO_WEB:
        url_str = limpio if limpio.lower().startswith(("http://", "https://")) else f"https://{limpio}"
        parsed = urlparse(url_str)
        if not parsed.netloc or "." not in parsed.netloc:
            raise ValueError(f"Formato de SITIO_WEB inválido: '{valor_crudo}'")
        path = "" if parsed.path == "/" else parsed.path.rstrip("/")
        return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}"

    if tipo == TipoEntidad.IP:
        partes = limpio.split(".")
        if len(partes) == 4 and all(p.isdigit() for p in partes):
            octetos = [int(p) for p in partes]
            if any(o < 0 or o > 255 for o in octetos):
                raise ValueError(f"Octeto IPv4 fuera de rango (0-255): '{valor_crudo}'")
            return ".".join(str(o) for o in octetos)
        if ":" in limpio:
            return limpio.lower()
        raise ValueError(f"Formato de IP inválido: '{valor_crudo}'")

    if tipo == TipoEntidad.USUARIO:
        sin_arroba = limpio.lstrip("@").lower()
        if not sin_arroba or " " in sin_arroba:
            raise ValueError(f"Formato de USUARIO inválido: '{valor_crudo}'")
        return sin_arroba

    if tipo in (TipoEntidad.PERSONA, TipoEntidad.ORGANIZACION):
        colapsado = " ".join(limpio.split())
        return colapsado.title()

    raise ValueError(f"Tipo de entidad no soportado: {tipo}")


class Entidad:
    """Representa un elemento o vértice del universo OSINT investigado."""

    def __init__(
        self,
        id: str,
        tipo: TipoEntidad,
        valor: str,
        descripcion: str = "",
        metadata: Optional[Dict[str, str]] = None,
    ) -> None:
        if not id or not id.strip():
            raise ValueError("El id de la entidad es obligatorio.")
        if not isinstance(tipo, TipoEntidad):
            tipo = TipoEntidad(tipo)

        self.id: str = id.strip()
        self.tipo: TipoEntidad = tipo
        self.valor: str = valor.strip()
        self.valor_normalizado: str = normalizar_valor_entidad(self.tipo, self.valor)
        self.descripcion: str = (descripcion or "").strip()
        self.metadata: Dict[str, str] = dict(metadata) if metadata else {}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "tipo": self.tipo.value,
            "valor": self.valor,
            "valor_normalizado": self.valor_normalizado,
            "descripcion": self.descripcion,
            "metadata": dict(self.metadata),
        }
