"""Cosine similarity metric for comparing vectors."""

import numpy as np


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Compute the cosine similarity between two vectors.

    Returns a value between -1 and 1, where 1 means identical direction,
    0 means orthogonal, and -1 means opposite direction.

    Args:
        vec_a: First vector (1-D numpy array or sparse matrix row).
        vec_b: Second vector (1-D numpy array or sparse matrix row).

    Returns:
        Cosine similarity as a float.
    """
    # Handle sparse matrices by converting to dense arrays
    if hasattr(vec_a, "toarray"):
        vec_a = vec_a.toarray().flatten()
    if hasattr(vec_b, "toarray"):
        vec_b = vec_b.toarray().flatten()

    vec_a = np.asarray(vec_a, dtype=np.float64).flatten()
    vec_b = np.asarray(vec_b, dtype=np.float64).flatten()

    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


def cosine_distance(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Compute cosine distance (1 - cosine_similarity).

    Returns a value between 0 and 2, where 0 means identical vectors.
    Used by the HNSW index for nearest-neighbor search.
    """
    return 1.0 - cosine_similarity(vec_a, vec_b)
