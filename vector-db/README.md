# VectorDB — A Vector Database from Scratch

A lightweight vector database that stores text documents, converts them to TF-IDF vector embeddings, indexes them using an HNSW (Hierarchical Navigable Small World) graph, and retrieves the most semantically similar documents for a given query.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 VectorDatabase                    │
│              (database.py — orchestrator)         │
├──────────┬──────────────────┬────────────────────┤
│ TextEncoder  │   HNSWIndex      │   VectorStore     │
│ (TF-IDF)     │   (ANN search)   │   (persistence)   │
│ embeddings.py│   hnsw.py        │   store.py         │
└──────────┴──────────────────┴────────────────────┘
         cosine similarity (similarity.py)
```

### Components

| Module | Purpose |
|--------|---------|
| `similarity.py` | Cosine similarity and cosine distance functions |
| `embeddings.py` | TF-IDF text encoder using scikit-learn's `TfidfVectorizer` |
| `hnsw.py` | HNSW index for approximate nearest neighbor search (implemented from scratch) |
| `store.py` | File-based persistent storage for vectors and text |
| `database.py` | Main orchestrator class tying all components together |
| `cli.py` | Command-line interface with `add` and `query` commands |

## Installation

### Prerequisites

- Python 3.9 or later
- pip

### Setup

```bash
# Navigate to the vector-db directory
cd vector-db

# (Recommended) Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Command-Line Interface

**Add documents:**

```bash
python -m vectordb add "machine learning is a subset of artificial intelligence"
python -m vectordb add "deep learning uses neural networks with many layers"
python -m vectordb add "Italian cooking includes pasta, pizza, and risotto"
python -m vectordb add "natural language processing deals with text and speech"
```

**Query for similar documents:**

```bash
python -m vectordb query "AI and neural networks" --k 3
```

Expected output:
```
Top 3 results:

  1. [score: 0.4523] deep learning uses neural networks with many layers
  2. [score: 0.3217] machine learning is a subset of artificial intelligence
  3. [score: 0.0891] natural language processing deals with text and speech
```

**Custom storage path:**

```bash
python -m vectordb --storage /path/to/data add "some text"
python -m vectordb --storage /path/to/data query "search" --k 5
```

### Python API

```python
from vectordb import VectorDatabase

# Create a new database
db = VectorDatabase(storage_path="my_data")

# Add documents
db.add("machine learning algorithms")
db.add("deep learning neural networks")
db.add("cooking pasta recipes")

# Query
results = db.query("artificial intelligence", k=2)
for r in results:
    print(f"[{r['score']:.4f}] {r['text']}")

# Persist to disk
db.save()

# Load later
db = VectorDatabase.load("my_data")
```

## How It Works

### 1. Text Encoding (TF-IDF)

Documents are converted to vectors using **TF-IDF** (Term Frequency–Inverse Document Frequency). Each dimension in the vector corresponds to a word in the vocabulary, and the value represents how important that word is to the document relative to the entire corpus. The vocabulary is rebuilt whenever a new document is added.

### 2. Similarity Metric (Cosine Similarity)

Vectors are compared using **cosine similarity**, which measures the angle between two vectors regardless of their magnitude. A score of 1.0 means identical direction (most similar), and 0.0 means orthogonal (unrelated).

### 3. Approximate Nearest Neighbor Search (HNSW)

The HNSW algorithm builds a multi-layer graph where:
- **Layer 0** contains all elements
- **Higher layers** contain exponentially fewer elements (selected randomly)
- Each element is connected to its nearest neighbors at each layer

Search starts at the top layer and greedily descends, using upper layers as "express lanes" to quickly narrow down the search region before doing a more thorough search at layer 0. This gives approximately **O(log n)** query time.

Key parameters:
- `M`: Maximum connections per element per layer (default: 16)
- `ef_construction`: Candidate list size during index building (default: 200)
- `ef_search`: Candidate list size during querying (default: 50)

### 4. Persistent Storage

Documents, vectors, and the index are stored on disk:
- **Text metadata**: JSON file mapping IDs to original text
- **Vectors**: NumPy `.npy` files for individual vectors, `.npz` for the HNSW index
- **Encoder state**: Pickled TF-IDF vectorizer
- **Graph structure**: JSON-serialized HNSW layers

## Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run a specific test file
pytest tests/test_hnsw.py -v

# Run with coverage (install pytest-cov first)
pip install pytest-cov
pytest tests/ -v --cov=vectordb
```

## Project Structure

```
vector-db/
├── README.md
├── requirements.txt
├── vectordb/
│   ├── __init__.py
│   ├── __main__.py
│   ├── cli.py
│   ├── database.py
│   ├── embeddings.py
│   ├── hnsw.py
│   ├── similarity.py
│   └── store.py
└── tests/
    ├── __init__.py
    ├── test_database.py
    ├── test_embeddings.py
    ├── test_hnsw.py
    ├── test_similarity.py
    └── test_store.py
```
