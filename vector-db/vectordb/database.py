"""Main VectorDatabase class that orchestrates all components."""

from __future__ import annotations

import json
import os

from vectordb.embeddings import TextEncoder
from vectordb.hnsw import HNSWIndex
from vectordb.store import VectorStore


class VectorDatabase:
    """A vector database that stores text documents and retrieves them by semantic similarity.

    Combines TF-IDF encoding, HNSW indexing, and file-based storage into a
    single interface with two main operations: add and query.

    Args:
        storage_path: Directory where all persistent data is stored.
        M: HNSW parameter — max connections per node per layer.
        ef_construction: HNSW parameter — candidate list size during build.
        ef_search: HNSW parameter — candidate list size during query.
    """

    def __init__(
        self,
        storage_path: str = "vectordb_data",
        M: int = 16,
        ef_construction: int = 200,
        ef_search: int = 50,
    ):
        self.storage_path = os.path.abspath(storage_path)
        self._store = VectorStore(os.path.join(self.storage_path, "store"))
        self._encoder = TextEncoder()
        self._index = HNSWIndex(M=M, ef_construction=ef_construction, ef_search=ef_search)
        self._next_id = 0

    def add(self, text: str) -> int:
        """Add a text document to the database.

        The text is encoded into a TF-IDF vector, stored persistently, and
        inserted into the HNSW index. After adding, the index is rebuilt with
        updated vectors since TF-IDF vocabulary may have changed.

        Args:
            text: The document text to add.

        Returns:
            The assigned document ID.
        """
        doc_id = self._next_id
        self._next_id += 1

        # Add to encoder (refits vocabulary) and get the vector
        self._encoder.add_document(text)

        # Rebuild the index with updated vectors since TF-IDF vocabulary changes
        self._rebuild_index()

        # Store the current vector
        current_vector = self._encoder.encode(text)
        self._store.add(doc_id, text, current_vector)

        return doc_id

    def query(self, text: str, k: int = 5) -> list[dict]:
        """Find the k most similar documents to the query text.

        Args:
            text: The query text.
            k: Number of results to return.

        Returns:
            A list of dicts with keys "id", "text", and "score" (cosine similarity),
            sorted by score descending (most similar first).
        """
        if self._index.size == 0:
            return []

        query_vector = self._encoder.encode(text)
        k = min(k, self._index.size)

        # Search the HNSW index
        neighbors = self._index.search(query_vector, k)

        results = []
        for distance, doc_id in neighbors:
            results.append({
                "id": doc_id,
                "text": self._store.get_text(doc_id),
                "score": round(1.0 - distance, 4),  # Convert distance back to similarity
            })

        return results

    def save(self):
        """Persist the entire database state to disk."""
        self._encoder.save(os.path.join(self.storage_path, "encoder"))
        self._index.save(os.path.join(self.storage_path, "index"))
        # Store already saves on every add, but save next_id
        meta_path = os.path.join(self.storage_path, "db_meta.json")
        with open(meta_path, "w") as f:
            json.dump({"next_id": self._next_id}, f)

    @classmethod
    def load(cls, storage_path: str = "vectordb_data") -> "VectorDatabase":
        """Load a previously saved database from disk.

        Args:
            storage_path: Path to the storage directory.

        Returns:
            A restored VectorDatabase instance.
        """
        db = cls(storage_path=storage_path)
        db._encoder = TextEncoder.load(os.path.join(db.storage_path, "encoder"))
        db._index = HNSWIndex.load(os.path.join(db.storage_path, "index"))
        db._store = VectorStore(os.path.join(db.storage_path, "store"))

        # Restore next_id
        meta_path = os.path.join(db.storage_path, "db_meta.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                meta = json.load(f)
            db._next_id = meta["next_id"]
        else:
            db._next_id = db._store.count()

        return db

    def _rebuild_index(self):
        """Rebuild the HNSW index from scratch with current TF-IDF vectors.

        This is necessary because TF-IDF vectors change when the vocabulary
        is updated (new documents add new terms).
        """
        all_vectors = self._encoder.get_all_vectors()
        if len(all_vectors) == 0:
            return

        self._index = HNSWIndex(
            M=self._index.M,
            ef_construction=self._index.ef_construction,
            ef_search=self._index.ef_search,
        )

        for i, vector in enumerate(all_vectors):
            self._index.insert(i, vector)
