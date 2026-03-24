"""Integration tests for the VectorDatabase."""

import tempfile

import pytest

from vectordb.database import VectorDatabase


class TestVectorDatabase:
    def test_add_returns_id(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            doc_id = db.add("hello world")
            assert doc_id == 0

    def test_add_increments_id(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            id0 = db.add("first")
            id1 = db.add("second")
            assert id0 == 0
            assert id1 == 1

    def test_query_empty_database(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            results = db.query("anything")
            assert results == []

    def test_query_returns_results(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            db.add("machine learning algorithms")
            db.add("deep learning neural networks")
            db.add("cooking pasta recipes")

            results = db.query("artificial intelligence", k=2)
            assert len(results) == 2
            assert all("id" in r and "text" in r and "score" in r for r in results)

    def test_query_ranks_by_relevance(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            db.add("machine learning algorithms and data science")
            db.add("italian cooking pasta recipes and food")
            db.add("deep learning neural networks and AI")

            results = db.query("machine learning AI", k=3)
            texts = [r["text"] for r in results]

            # ML/AI docs should rank higher than cooking
            cooking_idx = next(i for i, t in enumerate(texts) if "cooking" in t)
            ml_idx = next(i for i, t in enumerate(texts) if "machine" in t)
            assert ml_idx < cooking_idx, "ML doc should rank higher than cooking doc"

    def test_query_scores_are_descending(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            db.add("python programming language")
            db.add("java programming language")
            db.add("french cooking cuisine")

            results = db.query("programming", k=3)
            scores = [r["score"] for r in results]
            assert scores == sorted(scores, reverse=True)

    def test_query_k_larger_than_database(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            db.add("only document")
            results = db.query("test", k=10)
            assert len(results) == 1

    def test_save_and_load(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            db.add("machine learning")
            db.add("cooking recipes")
            db.save()

            # Load in a new instance
            db2 = VectorDatabase.load(tmpdir)
            results = db2.query("ML algorithms", k=2)
            assert len(results) == 2
            # The ML document should be the top result
            assert "machine" in results[0]["text"]

    def test_save_and_load_preserves_ids(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db = VectorDatabase(storage_path=tmpdir)
            db.add("first")
            db.add("second")
            db.save()

            db2 = VectorDatabase.load(tmpdir)
            next_id = db2.add("third")
            assert next_id == 2
