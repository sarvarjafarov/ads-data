"""Flask web server for the vector database.

Provides a browser-based UI for adding documents and querying the database.

Usage:
    python -m vectordb.web
    python -m vectordb.web --port 8080 --storage my_data
"""

from __future__ import annotations

import argparse
import os

from flask import Flask, jsonify, render_template, request

from vectordb.database import VectorDatabase

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "static"),
)

db: VectorDatabase | None = None


def get_db() -> VectorDatabase:
    global db
    if db is None:
        storage = app.config.get("STORAGE_PATH", "vectordb_data")
        db = VectorDatabase.load(storage)
    return db


@app.route("/")
def index():
    """Serve the main UI page."""
    return render_template("index.html")


@app.route("/api/add", methods=["POST"])
def add_document():
    """Add a document to the database."""
    data = request.get_json()
    if not data or not data.get("text", "").strip():
        return jsonify({"error": "Text is required"}), 400

    text = data["text"].strip()
    database = get_db()
    doc_id = database.add(text)
    database.save()

    return jsonify({"id": doc_id, "text": text, "message": f"Document added with ID {doc_id}"})


@app.route("/api/query", methods=["POST"])
def query_documents():
    """Query the database for similar documents."""
    data = request.get_json()
    if not data or not data.get("text", "").strip():
        return jsonify({"error": "Query text is required"}), 400

    text = data["text"].strip()
    k = data.get("k", 5)

    database = get_db()
    results = database.query(text, k=k)

    return jsonify({"query": text, "results": results})


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Get database statistics."""
    database = get_db()
    return jsonify({"document_count": database._store.count()})


def main():
    parser = argparse.ArgumentParser(description="VectorDB Web Interface")
    parser.add_argument("--port", type=int, default=5001, help="Port to run on (default: 5001)")
    parser.add_argument("--storage", default="vectordb_data", help="Storage directory")
    args = parser.parse_args()

    app.config["STORAGE_PATH"] = args.storage
    print(f"Starting VectorDB web server on http://localhost:{args.port}")
    print(f"Storage: {os.path.abspath(args.storage)}")
    app.run(debug=False, port=args.port)


if __name__ == "__main__":
    main()
