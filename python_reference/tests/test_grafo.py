"""
Pruebas Unitarias del Motor del Grafo (Sección 19 del Contrato Técnico)
Compatible con pytest y unittest estándar de Python 3.
"""

import unittest
from app.domain.entidad import Entidad, TipoEntidad
from app.domain.relacion import Relacion, TipoRelacion, Evidencia
from app.domain.grafo import GrafoDirigido


class TestMotorGrafoAED3(unittest.TestCase):
    def setUp(self) -> None:
        self.grafo = GrafoDirigido()

    def test_entidades_creacion_duplicados_y_eliminacion(self) -> None:
        e1 = Entidad("E1", TipoEntidad.EMAIL, "  Admin@Dominio.ORG ")
        self.assertEqual(e1.valor_normalizado, "admin@dominio.org")
        self.grafo.agregar_entidad(e1)

        # Duplicado por tipo + valor_normalizado debe fallar
        with self.assertRaises(ValueError):
            self.grafo.agregar_entidad(Entidad("E2", TipoEntidad.EMAIL, "admin@dominio.org"))

        # Entidad inexistente al eliminar
        with self.assertRaises(KeyError):
            self.grafo.eliminar_entidad("NO_EXISTE")

        self.grafo.eliminar_entidad("E1")
        self.assertNotIn("E1", self.grafo.vertices)

    def test_relaciones_creacion_duplicados_y_nodos_inexistentes(self) -> None:
        self.grafo.agregar_entidad(Entidad("A", TipoEntidad.DOMINIO, "https://www.ejemplo.org/"))
        self.grafo.agregar_entidad(Entidad("B", TipoEntidad.IP, "192.0.2.1"))

        ev = Evidencia("EV1", "DNS A", "Resolución directa")
        rel = Relacion("R1", "A", "B", TipoRelacion.APUNTA_A, evidencias=[ev])
        self.grafo.agregar_relacion(rel)

        # Relación duplicada
        with self.assertRaises(ValueError):
            self.grafo.agregar_relacion(Relacion("R2", "A", "B", TipoRelacion.APUNTA_A))

        # Origen o destino inexistente
        with self.assertRaises(KeyError):
            self.grafo.agregar_relacion(Relacion("R3", "FANTASMA", "B", TipoRelacion.POSEE))
        with self.assertRaises(KeyError):
            self.grafo.agregar_relacion(Relacion("R4", "A", "FANTASMA", TipoRelacion.POSEE))

    def test_bfs_niveles_ciclos_y_aislados(self) -> None:
        for nodo in ["A", "B", "C", "D", "E", "AISLADO"]:
            self.grafo.agregar_entidad(Entidad(nodo, TipoEntidad.USUARIO, f"user_{nodo}"))

        # Grafo de la Sección 9: A -> [B, C], B -> [D], C -> [D, E] + ciclo E -> A
        self.grafo.agregar_relacion(Relacion("R1", "A", "B", TipoRelacion.POSEE))
        self.grafo.agregar_relacion(Relacion("R2", "A", "C", TipoRelacion.POSEE))
        self.grafo.agregar_relacion(Relacion("R3", "B", "D", TipoRelacion.APUNTA_A))
        self.grafo.agregar_relacion(Relacion("R4", "C", "D", TipoRelacion.APUNTA_A))
        self.grafo.agregar_relacion(Relacion("R5", "C", "E", TipoRelacion.APUNTA_A))
        self.grafo.agregar_relacion(Relacion("R6", "E", "A", TipoRelacion.PERTENECE_A))

        res_bfs = self.grafo.ejecutar_bfs("A")
        self.assertEqual(res_bfs["ordenRecorrido"], ["A", "B", "C", "D", "E"])
        self.assertEqual(res_bfs["niveles"]["D"], 2)
        self.assertEqual(res_bfs["predecesores"]["D"], "B")

        res_aislado = self.grafo.ejecutar_bfs("AISLADO")
        self.assertEqual(res_aislado["ordenRecorrido"], ["AISLADO"])

        with self.assertRaises(KeyError):
            self.grafo.ejecutar_bfs("INEXISTENTE")

    def test_dfs_recursivo_ramas_y_ciclos(self) -> None:
        for nodo in ["A", "B", "C", "D", "E"]:
            self.grafo.agregar_entidad(Entidad(nodo, TipoEntidad.USUARIO, f"u_{nodo}"))

        self.grafo.agregar_relacion(Relacion("R1", "A", "B", TipoRelacion.POSEE))
        self.grafo.agregar_relacion(Relacion("R2", "A", "C", TipoRelacion.POSEE))
        self.grafo.agregar_relacion(Relacion("R3", "B", "D", TipoRelacion.APUNTA_A))
        self.grafo.agregar_relacion(Relacion("R4", "D", "A", TipoRelacion.APUNTA_A))  # Ciclo
        self.grafo.agregar_relacion(Relacion("R5", "C", "E", TipoRelacion.APUNTA_A))

        res_dfs = self.grafo.ejecutar_dfs("A")
        self.assertEqual(res_dfs["ordenRecorrido"], ["A", "B", "D", "C", "E"])

    def test_busqueda_caminos_minimos(self) -> None:
        for nodo in ["A", "B", "C", "D", "E", "Z"]:
            self.grafo.agregar_entidad(Entidad(nodo, TipoEntidad.USUARIO, f"cam_{nodo}"))

        # Camino largo: A -> B -> C -> D (3 aristas)
        self.grafo.agregar_relacion(Relacion("R1", "A", "B", TipoRelacion.POSEE))
        self.grafo.agregar_relacion(Relacion("R2", "B", "C", TipoRelacion.POSEE))
        self.grafo.agregar_relacion(Relacion("R3", "C", "D", TipoRelacion.POSEE))
        # Camino corto: A -> E -> D (2 aristas)
        self.grafo.agregar_relacion(Relacion("R4", "A", "E", TipoRelacion.UTILIZA))
        self.grafo.agregar_relacion(Relacion("R5", "E", "D", TipoRelacion.ADMINISTRA))

        camino = self.grafo.buscar_camino("A", "D")
        self.assertEqual(camino, ["A", "E", "D"])

        # Origen == Destino
        self.assertEqual(self.grafo.buscar_camino("A", "A"), ["A"])

        # Camino inexistente
        self.assertIsNone(self.grafo.buscar_camino("A", "Z"))


if __name__ == "__main__":
    unittest.main()
