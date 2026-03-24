"""TF-IDF text encoder for converting text to vector embeddings."""

from __future__ import annotations

import os
import pickle

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


class TextEncoder:
    """Encodes text documents into TF-IDF vector representations.

    The encoder maintains a vocabulary fitted on all documents seen so far.
    When new documents are added, the vocabulary is rebuilt to include new terms.

    Attributes:
        vectorizer: The underlying scikit-learn TfidfVectorizer.
        documents: List of all documents used to build the vocabulary.
    """

    def __init__(self):
        self.vectorizer = TfidfVectorizer()
        self.documents: list[str] = []
        self._is_fitted = False

    def add_document(self, text: str) -> np.ndarray:
        """Add a document to the corpus and return its TF-IDF vector.

        The vectorizer is refit on the entire corpus each time a new document
        is added, ensuring the vocabulary stays up to date.

        Args:
            text: The document text to add.

        Returns:
            The TF-IDF vector for the added document as a dense 1-D array.
        """
        self.documents.append(text)
        self._refit()
        # Return the vector for the newly added document (last one)
        vector = self.vectorizer.transform([text]).toarray().flatten()
        return vector

    def encode(self, text: str) -> np.ndarray:
        """Encode a query text using the current vocabulary.

        Does NOT add the text to the corpus or refit the vectorizer.

        Args:
            text: The query text to encode.

        Returns:
            The TF-IDF vector as a dense 1-D array.

        Raises:
            ValueError: If the encoder has not been fitted yet.
        """
        if not self._is_fitted:
            raise ValueError("Encoder has no vocabulary yet. Add documents first.")
        return self.vectorizer.transform([text]).toarray().flatten()

    def get_all_vectors(self) -> np.ndarray:
        """Re-encode all stored documents with the current vocabulary.

        Returns:
            A 2-D numpy array of shape (n_documents, vocabulary_size).
        """
        if not self._is_fitted:
            return np.array([])
        return self.vectorizer.transform(self.documents).toarray()

    def _refit(self):
        """Rebuild the vectorizer on the full document corpus."""
        self.vectorizer.fit(self.documents)
        self._is_fitted = True

    def save(self, directory: str):
        """Persist the encoder state to disk.

        Args:
            directory: Path to the directory where files will be saved.
        """
        os.makedirs(directory, exist_ok=True)
        state = {
            "documents": self.documents,
            "vectorizer": self.vectorizer,
            "is_fitted": self._is_fitted,
        }
        with open(os.path.join(directory, "encoder.pkl"), "wb") as f:
            pickle.dump(state, f)

    @classmethod
    def load(cls, directory: str) -> "TextEncoder":
        """Load an encoder from disk.

        Args:
            directory: Path to the directory containing saved encoder files.

        Returns:
            A restored TextEncoder instance.
        """
        encoder = cls()
        path = os.path.join(directory, "encoder.pkl")
        if os.path.exists(path):
            with open(path, "rb") as f:
                state = pickle.load(f)
            encoder.documents = state["documents"]
            encoder.vectorizer = state["vectorizer"]
            encoder._is_fitted = state["is_fitted"]
        return encoder
