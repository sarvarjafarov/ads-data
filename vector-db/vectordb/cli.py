"""Command-line interface for the vector database.

Usage:
    python -m vectordb add "some text to store"
    python -m vectordb query "search query" --k 5
"""

import argparse
import sys

from vectordb.database import VectorDatabase

DEFAULT_STORAGE = "vectordb_data"


def main():
    parser = argparse.ArgumentParser(
        prog="vectordb",
        description="A vector database with TF-IDF embeddings and HNSW indexing.",
    )
    parser.add_argument(
        "--storage",
        default=DEFAULT_STORAGE,
        help=f"Path to the storage directory (default: {DEFAULT_STORAGE})",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # --- add command ---
    add_parser = subparsers.add_parser("add", help="Add a text document to the database")
    add_parser.add_argument("text", help="The text to add")

    # --- query command ---
    query_parser = subparsers.add_parser(
        "query", help="Query the database for similar documents"
    )
    query_parser.add_argument("text", help="The query text")
    query_parser.add_argument(
        "--k", type=int, default=5, help="Number of results to return (default: 5)"
    )

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    # Load or create the database
    db = VectorDatabase.load(args.storage)

    if args.command == "add":
        doc_id = db.add(args.text)
        db.save()
        print(f"Added document with ID {doc_id}")

    elif args.command == "query":
        results = db.query(args.text, k=args.k)
        if not results:
            print("No results found. Add some documents first.")
        else:
            print(f"Top {len(results)} results:\n")
            for i, result in enumerate(results, 1):
                print(f"  {i}. [score: {result['score']:.4f}] {result['text']}")


if __name__ == "__main__":
    main()
