"""
Motor del Grafo Dirigido (AED3) — Implementación de Referencia en Python Puro
Mini-Maltego Académico — v1.0

REGLA ARQUITECTÓNICA (Sección 8):
El motor del grafo conoce exclusivamente:
- Entidades (vértices)
- Relaciones dirigidas (aristas)
- Lista de adyacencia en memoria
- Cola FIFO para BFS (O(V + E))
- Recursividad para DFS (O(V + E))
- Búsqueda de caminos mínimos por reconstrucción inversa de predecesores

NO conoce SQL, SQLite, HTML, CSS, HTTP, FastAPI ni Cytoscape.js.
"""

from typing import Dict, Generic, List, Optional, Set, TypeVar
from .entidad import Entidad
from .relacion import Relacion

T = TypeVar("T")


class _NodoCola(Generic[T]):
    def __init__(self, valor: T) -> None:
        self.valor: T = valor
        self.siguiente: Optional["_NodoCola[T]"] = None


class ColaFIFO(Generic[T]):
    """Estructura de datos Cola FIFO enlazada con encolar/desencolar en O(1)."""

    def __init__(self) -> None:
        self._frente: Optional[_NodoCola[T]] = None
        self._final: Optional[_NodoCola[T]] = None
        self._tamano: int = 0

    def encolar(self, elemento: T) -> None:
        nuevo = _NodoCola(elemento)
        if self._final is None:
            self._frente = nuevo
            self._final = nuevo
        else:
            self._final.siguiente = nuevo
            self._final = nuevo
        self._tamano += 1

    def desencolar(self) -> T:
        if self._frente is None:
            raise IndexError("No se puede desencolar de una Cola FIFO vacía.")
        valor = self._frente.valor
        self._frente = self._frente.siguiente
        if self._frente is None:
            self._final = None
        self._tamano -= 1
        return valor

    def esta_vacia(self) -> bool:
        return self._tamano == 0

    def __len__(self) -> int:
        return self._tamano


class GrafoDirigido:
    """Grafo dirigido representado mediante Lista de Adyacencia en memoria."""

    def __init__(self) -> None:
        self.vertices: Dict[str, Entidad] = {}
        self.aristas: Dict[str, Relacion] = {}
        # Lista de adyacencia: id_origen -> [{"destino_id": str, "relacion_id": str, "tipo": str}]
        self.lista_adyacencia: Dict[str, List[Dict[str, str]]] = {}

    def agregar_entidad(self, entidad: Entidad) -> None:
        if entidad.id in self.vertices:
            raise ValueError(f"Ya existe una entidad con id '{entidad.id}'.")
        for existente in self.vertices.values():
            if (
                existente.tipo == entidad.tipo
                and existente.valor_normalizado == entidad.valor_normalizado
            ):
                raise ValueError(
                    f"Entidad duplicada: ({entidad.tipo.value}, '{entidad.valor_normalizado}')."
                )
        self.vertices[entidad.id] = entidad
        self.lista_adyacencia[entidad.id] = []

    def eliminar_entidad(self, entidad_id: str) -> None:
        if entidad_id not in self.vertices:
            raise KeyError(f"La entidad '{entidad_id}' no existe en el grafo.")
        for conexion in self.lista_adyacencia.get(entidad_id, []):
            self.aristas.pop(conexion["relacion_id"], None)
        del self.lista_adyacencia[entidad_id]

        for origen_id, adyacentes in self.lista_adyacencia.items():
            filtrados = []
            for conexion in adyacentes:
                if conexion["destino_id"] == entidad_id:
                    self.aristas.pop(conexion["relacion_id"], None)
                else:
                    filtrados.append(conexion)
            self.lista_adyacencia[origen_id] = filtrados

        del self.vertices[entidad_id]

    def agregar_relacion(self, relacion: Relacion) -> None:
        if relacion.origen_id not in self.vertices:
            raise KeyError(f"La entidad origen '{relacion.origen_id}' no existe.")
        if relacion.destino_id not in self.vertices:
            raise KeyError(f"La entidad destino '{relacion.destino_id}' no existe.")
        if relacion.id in self.aristas:
            raise ValueError(f"Ya existe la relación '{relacion.id}'.")

        adyacentes = self.lista_adyacencia[relacion.origen_id]
        if any(
            c["destino_id"] == relacion.destino_id and c["tipo"] == relacion.tipo.value
            for c in adyacentes
        ):
            raise ValueError("Relación dirigida duplicada entre origen y destino con el mismo tipo.")

        self.aristas[relacion.id] = relacion
        adyacentes.append(
            {
                "destino_id": relacion.destino_id,
                "relacion_id": relacion.id,
                "tipo": relacion.tipo.value,
            }
        )

    def eliminar_relacion(self, relacion_id: str) -> None:
        if relacion_id not in self.aristas:
            raise KeyError(f"La relación '{relacion_id}' no existe.")
        rel = self.aristas.pop(relacion_id)
        self.lista_adyacencia[rel.origen_id] = [
            c for c in self.lista_adyacencia[rel.origen_id] if c["relacion_id"] != relacion_id
        ]

    def obtener_vecinos(self, entidad_id: str) -> List[str]:
        if entidad_id not in self.vertices:
            raise KeyError(f"La entidad '{entidad_id}' no existe.")
        vistos: Set[str] = set()
        vecinos: List[str] = []
        for c in self.lista_adyacencia[entidad_id]:
            dest = c["destino_id"]
            if dest not in vistos:
                vistos.add(dest)
                vecinos.append(dest)
        return vecinos

    def ejecutar_bfs(self, origen_id: str) -> dict:
        """
        Recorrido en Anchura (BFS) manual utilizando Cola FIFO.
        Complejidad Temporal: O(V + E) | Espacio Auxiliar: O(V)
        """
        if origen_id not in self.vertices:
            raise KeyError(f"El nodo origen '{origen_id}' no existe.")

        cola: ColaFIFO[str] = ColaFIFO()
        visitados: Set[str] = {origen_id}
        orden_recorrido: List[str] = []
        niveles: Dict[str, int] = {origen_id: 0}
        predecesores: Dict[str, Optional[str]] = {origen_id: None}

        cola.encolar(origen_id)

        while not cola.esta_vacia():
            actual = cola.desencolar()
            orden_recorrido.append(actual)

            for conexion in self.lista_adyacencia[actual]:
                vecino = conexion["destino_id"]
                if vecino not in visitados:
                    visitados.add(vecino)
                    niveles[vecino] = niveles[actual] + 1
                    predecesores[vecino] = actual
                    cola.encolar(vecino)

        return {
            "ordenRecorrido": orden_recorrido,
            "niveles": niveles,
            "predecesores": predecesores,
        }

    def ejecutar_dfs(self, origen_id: str) -> dict:
        """
        Recorrido en Profundidad (DFS) recursivo.
        Relaciona Grafo + Recursividad (condición de existencia, visitados, caso base).
        Complejidad Temporal: O(V + E)
        """
        if origen_id not in self.vertices:
            raise KeyError(f"El nodo origen '{origen_id}' no existe.")

        visitados: Set[str] = set()
        orden_recorrido: List[str] = []
        predecesores: Dict[str, Optional[str]] = {origen_id: None}

        def _dfs_recursivo(nodo_actual: str) -> None:
            if nodo_actual in visitados:
                return  # Caso base: nodo ya visitado (corta ciclos)

            visitados.add(nodo_actual)
            orden_recorrido.append(nodo_actual)

            for conexion in self.lista_adyacencia[nodo_actual]:
                vecino = conexion["destino_id"]
                if vecino not in visitados:
                    predecesores[vecino] = nodo_actual
                    _dfs_recursivo(vecino)

        _dfs_recursivo(origen_id)

        return {
            "ordenRecorrido": orden_recorrido,
            "predecesores": predecesores,
        }

    def buscar_camino(self, origen_id: str, destino_id: str) -> Optional[List[str]]:
        """
        Búsqueda de camino con cantidad mínima de aristas mediante BFS + reconstrucción inversa.
        """
        if origen_id not in self.vertices:
            raise KeyError(f"El nodo origen '{origen_id}' no existe.")
        if destino_id not in self.vertices:
            raise KeyError(f"El nodo destino '{destino_id}' no existe.")

        if origen_id == destino_id:
            return [origen_id]

        cola: ColaFIFO[str] = ColaFIFO()
        visitados: Set[str] = {origen_id}
        predecesores: Dict[str, Optional[str]] = {origen_id: None}
        cola.encolar(origen_id)

        encontrado = False
        while not cola.esta_vacia() and not encontrado:
            actual = cola.desencolar()
            for conexion in self.lista_adyacencia[actual]:
                vecino = conexion["destino_id"]
                if vecino not in visitados:
                    visitados.add(vecino)
                    predecesores[vecino] = actual
                    if vecino == destino_id:
                        encontrado = True
                        break
                    cola.encolar(vecino)

        if not encontrado:
            return None

        # Reconstrucción inversa desde destino hacia origen
        camino_inverso: List[str] = []
        cursor: Optional[str] = destino_id
        while cursor is not None:
            camino_inverso.append(cursor)
            cursor = predecesores.get(cursor)

        return list(reversed(camino_inverso))
