"""Persistent file-based storage for vectors and their associated text."""

from __future__ import annotations

import json
import os

import numpy as np


class VectorStore:
    """Stores vectors and their associated text on disk.

    Uses a JSON index file for metadata (ID → text mapping) and individual
    numpy .npy files for each vector.

    Attributes:
        directory: The storage directory path.
    """

    INDEX_FILE = "index.json"
    VECTORS_DIR = "vectors"

    def __init__(self, directory: str):
        """Initialize the vector store.

        Args:
            directory: Path to the storage directory. Created if it doesn't exist.
        """
        self.directory = directory
        self._vectors_dir = os.path.join(directory, self.VECTORS_DIR)
        os.makedirs(self._vectors_dir, exist_ok=True)
        self._index = self._load_index()

    def add(self, doc_id: int, text: str, vector: np.ndarray):
        """Store a document's text and vector.

        Args:
            doc_id: Unique integer identifier for the document.
            text: The original document text.
            vector: The vector embedding as a 1-D numpy array.
        """
        self._index[str(doc_id)] = text
        self._save_index()
        np.save(self._vector_path(doc_id), vector)

    def get_text(self, doc_id: int) -> str:
        """Retrieve the original text for a given document ID.

        Args:
            doc_id: The document identifier.

        Returns:
            The original text string.

        Raises:
            KeyError: If the document ID is not found.
        """
        return self._index[str(doc_id)]

    def get_vector(self, doc_id: int) -> np.ndarray:
        """Retrieve the stored vector for a given document ID.

        Args:
            doc_id: The document identifier.

        Returns:
            The vector as a 1-D numpy array.
        """
        return np.load(self._vector_path(doc_id))

    def get_all_ids(self) -> list[int]:
        """Return all stored document IDs.

        Returns:
            A sorted list of integer document IDs.
        """
        return sorted(int(k) for k in self._index.keys())

    def count(self) -> int:
        """Return the number of stored documents."""
        return len(self._index)

    def _vector_path(self, doc_id: int) -> str:
        return os.path.join(self._vectors_dir, f"{doc_id}.npy")

    def _load_index(self) -> dict[str, str]:
        path = os.path.join(self.directory, self.INDEX_FILE)
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
        return {}

    def _save_index(self):
        path = os.path.join(self.directory, self.INDEX_FILE)
        with open(path, "w") as f:
            json.dump(self._index, f, indent=2)
