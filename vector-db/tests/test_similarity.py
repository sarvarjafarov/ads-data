"""Tests for the cosine similarity module."""

import numpy as np
import pytest

from vectordb.similarity import cosine_distance, cosine_similarity


class TestCosineSimilarity:
    def test_identical_vectors(self):
        vec = np.array([1.0, 2.0, 3.0])
        assert cosine_similarity(vec, vec) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        vec_a = np.array([1.0, 0.0])
        vec_b = np.array([0.0, 1.0])
        assert cosine_similarity(vec_a, vec_b) == pytest.approx(0.0)

    def test_opposite_vectors(self):
        vec_a = np.array([1.0, 0.0])
        vec_b = np.array([-1.0, 0.0])
        assert cosine_similarity(vec_a, vec_b) == pytest.approx(-1.0)

    def test_similar_vectors(self):
        vec_a = np.array([1.0, 1.0])
        vec_b = np.array([1.0, 0.9])
        sim = cosine_similarity(vec_a, vec_b)
        assert sim > 0.99  # Very similar

    def test_zero_vector(self):
        vec_a = np.array([0.0, 0.0])
        vec_b = np.array([1.0, 2.0])
        assert cosine_similarity(vec_a, vec_b) == 0.0

    def test_high_dimensional(self):
        rng = np.random.default_rng(42)
        vec_a = rng.random(100)
        sim = cosine_similarity(vec_a, vec_a)
        assert sim == pytest.approx(1.0)


class TestCosineDistance:
    def test_identical_vectors(self):
        vec = np.array([1.0, 2.0, 3.0])
        assert cosine_distance(vec, vec) == pytest.approx(0.0)

    def test_orthogonal_vectors(self):
        vec_a = np.array([1.0, 0.0])
        vec_b = np.array([0.0, 1.0])
        assert cosine_distance(vec_a, vec_b) == pytest.approx(1.0)

    def test_distance_is_inverse_of_similarity(self):
        vec_a = np.array([1.0, 2.0, 3.0])
        vec_b = np.array([4.0, 5.0, 6.0])
        sim = cosine_similarity(vec_a, vec_b)
        dist = cosine_distance(vec_a, vec_b)
        assert sim + dist == pytest.approx(1.0)
