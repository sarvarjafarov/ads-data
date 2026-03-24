"""Tests for the TF-IDF text encoder."""

import os
import tempfile

import numpy as np
import pytest

from vectordb.embeddings import TextEncoder


class TestTextEncoder:
    def test_add_document_returns_vector(self):
        encoder = TextEncoder()
        vec = encoder.add_document("hello world")
        assert isinstance(vec, np.ndarray)
        assert vec.ndim == 1
        assert len(vec) > 0

    def test_encode_before_fit_raises(self):
        encoder = TextEncoder()
        with pytest.raises(ValueError, match="no vocabulary"):
            encoder.encode("hello")

    def test_encode_returns_same_dimension(self):
        encoder = TextEncoder()
        encoder.add_document("the cat sat on the mat")
        encoder.add_document("the dog ran in the park")
        vec = encoder.encode("a cat in the park")
        # Dimension should match the vocabulary size
        all_vecs = encoder.get_all_vectors()
        assert vec.shape[0] == all_vecs.shape[1]

    def test_similar_texts_have_closer_vectors(self):
        encoder = TextEncoder()
        encoder.add_document("machine learning algorithms")
        encoder.add_document("deep neural networks")
        encoder.add_document("cooking pasta recipes")

        vec_ml = encoder.encode("machine learning")
        vec_cook = encoder.encode("cooking recipes")

        all_vecs = encoder.get_all_vectors()
        vec_doc0 = all_vecs[0]  # machine learning algorithms

        # "machine learning" should be closer to doc 0 than "cooking recipes"
        from vectordb.similarity import cosine_similarity
        sim_ml = cosine_similarity(vec_ml, vec_doc0)
        sim_cook = cosine_similarity(vec_cook, vec_doc0)
        assert sim_ml > sim_cook

    def test_get_all_vectors_shape(self):
        encoder = TextEncoder()
        encoder.add_document("hello world")
        encoder.add_document("foo bar baz")
        vecs = encoder.get_all_vectors()
        assert vecs.shape[0] == 2  # 2 documents

    def test_get_all_vectors_empty(self):
        encoder = TextEncoder()
        vecs = encoder.get_all_vectors()
        assert len(vecs) == 0

    def test_save_and_load(self):
        encoder = TextEncoder()
        encoder.add_document("hello world")
        encoder.add_document("testing save load")

        with tempfile.TemporaryDirectory() as tmpdir:
            encoder.save(tmpdir)
            loaded = TextEncoder.load(tmpdir)

        assert loaded.documents == encoder.documents
        assert loaded._is_fitted is True
        vec_orig = encoder.encode("test query")
        vec_loaded = loaded.encode("test query")
        np.testing.assert_array_almost_equal(vec_orig, vec_loaded)

    def test_load_nonexistent_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            encoder = TextEncoder.load(os.path.join(tmpdir, "nope"))
        assert encoder.documents == []
        assert encoder._is_fitted is False
