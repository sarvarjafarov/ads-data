"""Tests for the persistent vector store."""

import tempfile

import numpy as np
import pytest

from vectordb.store import VectorStore


class TestVectorStore:
    def test_add_and_get_text(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store = VectorStore(tmpdir)
            store.add(0, "hello world", np.array([1.0, 2.0]))
            assert store.get_text(0) == "hello world"

    def test_add_and_get_vector(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store = VectorStore(tmpdir)
            vec = np.array([1.0, 2.0, 3.0])
            store.add(0, "test", vec)
            loaded = store.get_vector(0)
            np.testing.assert_array_equal(loaded, vec)

    def test_get_nonexistent_text_raises(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store = VectorStore(tmpdir)
            with pytest.raises(KeyError):
                store.get_text(999)

    def test_multiple_documents(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store = VectorStore(tmpdir)
            store.add(0, "first", np.array([1.0]))
            store.add(1, "second", np.array([2.0]))
            store.add(2, "third", np.array([3.0]))
            assert store.count() == 3
            assert store.get_text(1) == "second"

    def test_get_all_ids(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store = VectorStore(tmpdir)
            store.add(2, "a", np.array([1.0]))
            store.add(0, "b", np.array([2.0]))
            store.add(5, "c", np.array([3.0]))
            assert store.get_all_ids() == [0, 2, 5]

    def test_persistence_across_instances(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store1 = VectorStore(tmpdir)
            store1.add(0, "persistent text", np.array([1.0, 2.0]))

            # Create a new instance pointing to the same directory
            store2 = VectorStore(tmpdir)
            assert store2.get_text(0) == "persistent text"
            np.testing.assert_array_equal(
                store2.get_vector(0), np.array([1.0, 2.0])
            )

    def test_count_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            store = VectorStore(tmpdir)
            assert store.count() == 0
