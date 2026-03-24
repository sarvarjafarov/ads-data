"""Tests for the HNSW index."""

import tempfile

import numpy as np
import pytest

from vectordb.hnsw import HNSWIndex


class TestHNSWIndex:
    def _make_index_with_data(self, n=50, dim=10, seed=42):
        """Helper to create an index with random vectors."""
        rng = np.random.default_rng(seed)
        index = HNSWIndex(M=8, ef_construction=50, ef_search=30)
        vectors = {}
        for i in range(n):
            vec = rng.random(dim)
            vectors[i] = vec
            index.insert(i, vec)
        return index, vectors

    def test_empty_search(self):
        index = HNSWIndex()
        results = index.search(np.array([1.0, 2.0, 3.0]), k=5)
        assert results == []

    def test_single_element(self):
        index = HNSWIndex()
        vec = np.array([1.0, 0.0, 0.0])
        index.insert(0, vec)
        results = index.search(vec, k=1)
        assert len(results) == 1
        assert results[0][1] == 0  # doc_id
        assert results[0][0] == pytest.approx(0.0, abs=1e-6)  # distance ≈ 0

    def test_returns_correct_k(self):
        index, _ = self._make_index_with_data(n=20)
        rng = np.random.default_rng(99)
        query = rng.random(10)
        results = index.search(query, k=5)
        assert len(results) == 5

    def test_k_larger_than_size(self):
        index, _ = self._make_index_with_data(n=3)
        rng = np.random.default_rng(99)
        query = rng.random(10)
        results = index.search(query, k=10)
        assert len(results) == 3

    def test_results_sorted_by_distance(self):
        index, _ = self._make_index_with_data(n=30)
        rng = np.random.default_rng(99)
        query = rng.random(10)
        results = index.search(query, k=10)
        distances = [d for d, _ in results]
        assert distances == sorted(distances)

    def test_nearest_neighbor_accuracy(self):
        """The true nearest neighbor should be in the top results most of the time."""
        rng = np.random.default_rng(42)
        index = HNSWIndex(M=16, ef_construction=100, ef_search=50)
        n, dim = 100, 10
        vectors = {}
        for i in range(n):
            vec = rng.random(dim)
            vectors[i] = vec
            index.insert(i, vec)

        # Run several queries and check recall
        from vectordb.similarity import cosine_distance
        hits = 0
        trials = 20
        for _ in range(trials):
            query = rng.random(dim)
            # Brute-force true nearest neighbor
            true_nn = min(vectors.keys(), key=lambda i: cosine_distance(query, vectors[i]))
            # HNSW results
            results = index.search(query, k=5)
            result_ids = {doc_id for _, doc_id in results}
            if true_nn in result_ids:
                hits += 1

        recall = hits / trials
        assert recall >= 0.7, f"Recall too low: {recall}"

    def test_size_property(self):
        index = HNSWIndex()
        assert index.size == 0
        index.insert(0, np.array([1.0, 2.0]))
        assert index.size == 1
        index.insert(1, np.array([3.0, 4.0]))
        assert index.size == 2

    def test_save_and_load(self):
        index, vectors = self._make_index_with_data(n=20)
        rng = np.random.default_rng(99)
        query = rng.random(10)

        # Get results before save
        results_before = index.search(query, k=5)

        with tempfile.TemporaryDirectory() as tmpdir:
            index.save(tmpdir)
            loaded = HNSWIndex.load(tmpdir)

        results_after = loaded.search(query, k=5)

        assert loaded.size == index.size
        assert len(results_after) == len(results_before)
        # Same results (same IDs and distances)
        for (d1, id1), (d2, id2) in zip(results_before, results_after):
            assert id1 == id2
            assert d1 == pytest.approx(d2, abs=1e-6)

    def test_load_nonexistent_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            index = HNSWIndex.load(tmpdir)
        assert index.size == 0
