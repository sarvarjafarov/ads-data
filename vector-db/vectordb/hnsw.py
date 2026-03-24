"""Hierarchical Navigable Small World (HNSW) graph index for approximate nearest neighbor search.

This is a from-scratch implementation of the HNSW algorithm as described in:
    Malkov & Yashunin, "Efficient and robust approximate nearest neighbor search
    using Hierarchical Navigable Small World graphs" (2018).

The graph consists of multiple layers. The bottom layer (layer 0) contains all
elements, while higher layers contain exponentially fewer elements, forming a
hierarchy that enables efficient logarithmic-time search.
"""

from __future__ import annotations

import heapq
import json
import math
import os
import random

import numpy as np

from vectordb.similarity import cosine_distance


class HNSWIndex:
    """HNSW graph index for approximate nearest neighbor search.

    Args:
        M: Maximum number of connections per element per layer.
        ef_construction: Size of the dynamic candidate list during construction.
        ef_search: Size of the dynamic candidate list during search.
        m_l: Level generation factor. Controls the probability of an element
             being promoted to higher layers. Default is 1/ln(M).
    """

    def __init__(self, M: int = 16, ef_construction: int = 200, ef_search: int = 50):
        self.M = M
        self.M_max0 = 2 * M  # Max connections at layer 0 (as per the paper)
        self.ef_construction = ef_construction
        self.ef_search = ef_search
        self.m_l = 1.0 / math.log(M) if M > 1 else 1.0

        # Storage
        self._vectors: dict[int, np.ndarray] = {}  # id → vector
        self._graphs: list[dict[int, list[int]]] = []  # layer → {id → [neighbor_ids]}
        self._entry_point: int | None = None
        self._max_layer: int = -1

    @property
    def size(self) -> int:
        """Return the number of elements in the index."""
        return len(self._vectors)

    def insert(self, doc_id: int, vector: np.ndarray):
        """Insert an element into the HNSW index.

        Args:
            doc_id: Unique identifier for the element.
            vector: The vector to insert.
        """
        vector = np.asarray(vector, dtype=np.float64).flatten()
        self._vectors[doc_id] = vector

        # Determine the layer for this element
        level = self._random_level()

        # Ensure we have enough layers
        while len(self._graphs) <= level:
            self._graphs.append({})

        # First element — set as entry point
        if self._entry_point is None:
            self._entry_point = doc_id
            self._max_layer = level
            for layer in range(level + 1):
                self._graphs[layer][doc_id] = []
            return

        entry_point = self._entry_point

        # Phase 1: Traverse from the top layer down to (level + 1),
        # greedily finding the closest element at each layer.
        for layer in range(self._max_layer, level, -1):
            if entry_point not in self._graphs[layer]:
                continue
            entry_point = self._search_layer_greedy(vector, entry_point, layer)

        # Phase 2: From layer min(level, max_layer) down to 0,
        # insert the element and connect it to its nearest neighbors.
        for layer in range(min(level, self._max_layer), -1, -1):
            # Find candidates at this layer
            candidates = self._search_layer(
                vector, entry_point, self.ef_construction, layer
            )

            # Select M best neighbors
            m_max = self.M_max0 if layer == 0 else self.M
            neighbors = self._select_neighbors(candidates, m_max)

            # Add the new element to this layer with its connections
            self._graphs[layer][doc_id] = neighbors

            # Add bidirectional connections
            for neighbor_id in neighbors:
                neighbor_connections = self._graphs[layer].get(neighbor_id, [])
                neighbor_connections.append(doc_id)

                # Shrink connections if exceeding the maximum
                if len(neighbor_connections) > m_max:
                    neighbor_connections = self._shrink_connections(
                        neighbor_id, neighbor_connections, m_max, layer
                    )
                self._graphs[layer][neighbor_id] = neighbor_connections

            # Update entry point for next layer down
            if candidates:
                entry_point = candidates[0][1]  # closest candidate

        # Update global entry point if the new element has a higher level
        if level > self._max_layer:
            self._entry_point = doc_id
            self._max_layer = level

    def search(self, query_vector: np.ndarray, k: int = 5) -> list[tuple[int, float]]:
        """Search for the k approximate nearest neighbors of a query vector.

        Args:
            query_vector: The query vector.
            k: Number of nearest neighbors to return.

        Returns:
            A list of (doc_id, distance) tuples sorted by distance (ascending).
        """
        if self._entry_point is None:
            return []

        query_vector = np.asarray(query_vector, dtype=np.float64).flatten()
        entry_point = self._entry_point

        # Traverse from the top layer down to layer 1 greedily
        for layer in range(self._max_layer, 0, -1):
            if entry_point not in self._graphs[layer]:
                continue
            entry_point = self._search_layer_greedy(query_vector, entry_point, layer)

        # Search layer 0 with ef_search candidates
        candidates = self._search_layer(
            query_vector, entry_point, max(self.ef_search, k), 0
        )

        # Return top-k results
        return candidates[:k]

    def _random_level(self) -> int:
        """Generate a random level for a new element using exponential decay."""
        return int(-math.log(random.random()) * self.m_l)

    def _distance(self, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """Compute distance between two vectors."""
        return cosine_distance(vec_a, vec_b)

    def _search_layer_greedy(self, query: np.ndarray, entry: int, layer: int) -> int:
        """Greedy search at a single layer — returns the single closest element.

        Used during the top-layer traversal phase of insert and search.
        """
        current = entry
        current_dist = self._distance(query, self._vectors[current])

        while True:
            changed = False
            neighbors = self._graphs[layer].get(current, [])
            for neighbor_id in neighbors:
                if neighbor_id not in self._vectors:
                    continue
                dist = self._distance(query, self._vectors[neighbor_id])
                if dist < current_dist:
                    current = neighbor_id
                    current_dist = dist
                    changed = True
            if not changed:
                break

        return current

    def _search_layer(
        self, query: np.ndarray, entry: int, ef: int, layer: int
    ) -> list[tuple[float, int]]:
        """Search a single layer with a dynamic candidate list.

        Returns a list of (distance, doc_id) sorted by distance ascending.
        """
        entry_dist = self._distance(query, self._vectors[entry])

        # Min-heap of candidates to explore: (distance, id)
        candidates = [(entry_dist, entry)]
        # Max-heap of current best results: (-distance, id)
        results = [(-entry_dist, entry)]
        visited = {entry}

        while candidates:
            candidate_dist, candidate_id = heapq.heappop(candidates)

            # Furthest element in results
            furthest_dist = -results[0][0]

            # If closest candidate is further than the furthest result, stop
            if candidate_dist > furthest_dist:
                break

            # Explore neighbors of this candidate
            for neighbor_id in self._graphs[layer].get(candidate_id, []):
                if neighbor_id in visited:
                    continue
                visited.add(neighbor_id)

                if neighbor_id not in self._vectors:
                    continue

                dist = self._distance(query, self._vectors[neighbor_id])
                furthest_dist = -results[0][0]

                if dist < furthest_dist or len(results) < ef:
                    heapq.heappush(candidates, (dist, neighbor_id))
                    heapq.heappush(results, (-dist, neighbor_id))
                    if len(results) > ef:
                        heapq.heappop(results)

        # Convert results to sorted list (ascending distance)
        output = [(-neg_dist, doc_id) for neg_dist, doc_id in results]
        output.sort(key=lambda x: x[0])
        return output

    def _select_neighbors(
        self, candidates: list[tuple[float, int]], m: int
    ) -> list[int]:
        """Select the best m neighbors from the candidate list (simple strategy)."""
        return [doc_id for _, doc_id in candidates[:m]]

    def _shrink_connections(
        self, node_id: int, connections: list[int], m_max: int, layer: int
    ) -> list[int]:
        """Shrink the connection list to m_max by keeping the closest neighbors."""
        node_vec = self._vectors[node_id]
        scored = []
        for conn_id in connections:
            if conn_id in self._vectors:
                dist = self._distance(node_vec, self._vectors[conn_id])
                scored.append((dist, conn_id))
        scored.sort(key=lambda x: x[0])
        return [conn_id for _, conn_id in scored[:m_max]]

    def save(self, directory: str):
        """Save the HNSW index to disk.

        Args:
            directory: Path to the directory where files will be saved.
        """
        os.makedirs(directory, exist_ok=True)

        # Save graph structure as JSON
        graphs_serializable = []
        for layer_graph in self._graphs:
            graphs_serializable.append(
                {str(k): v for k, v in layer_graph.items()}
            )

        metadata = {
            "M": self.M,
            "M_max0": self.M_max0,
            "ef_construction": self.ef_construction,
            "ef_search": self.ef_search,
            "entry_point": self._entry_point,
            "max_layer": self._max_layer,
            "graphs": graphs_serializable,
        }
        with open(os.path.join(directory, "hnsw_meta.json"), "w") as f:
            json.dump(metadata, f, indent=2)

        # Save vectors as a single numpy file
        if self._vectors:
            ids = sorted(self._vectors.keys())
            vectors = np.array([self._vectors[i] for i in ids])
            np.savez(
                os.path.join(directory, "hnsw_vectors.npz"),
                ids=np.array(ids),
                vectors=vectors,
            )

    @classmethod
    def load(cls, directory: str) -> "HNSWIndex":
        """Load an HNSW index from disk.

        Args:
            directory: Path to the directory containing saved index files.

        Returns:
            A restored HNSWIndex instance.
        """
        meta_path = os.path.join(directory, "hnsw_meta.json")
        if not os.path.exists(meta_path):
            return cls()

        with open(meta_path, "r") as f:
            metadata = json.load(f)

        index = cls(
            M=metadata["M"],
            ef_construction=metadata["ef_construction"],
            ef_search=metadata["ef_search"],
        )
        index.M_max0 = metadata["M_max0"]
        index._entry_point = metadata["entry_point"]
        index._max_layer = metadata["max_layer"]

        # Restore graph structure
        index._graphs = []
        for layer_data in metadata["graphs"]:
            index._graphs.append({int(k): v for k, v in layer_data.items()})

        # Restore vectors
        vectors_path = os.path.join(directory, "hnsw_vectors.npz")
        if os.path.exists(vectors_path):
            data = np.load(vectors_path)
            ids = data["ids"]
            vectors = data["vectors"]
            for i, doc_id in enumerate(ids):
                index._vectors[int(doc_id)] = vectors[i]

        return index
