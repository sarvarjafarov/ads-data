"""Load sample documents into the vector database for testing."""

from vectordb import VectorDatabase

SAMPLE_DOCUMENTS = [
    # Technology / AI
    "Machine learning is a branch of artificial intelligence",
    "Neural networks are inspired by the human brain",
    "Deep learning models require large amounts of training data",
    "Natural language processing helps computers understand human text",
    "Python is the most popular programming language for data science",

    # Sports
    "Basketball players need to be tall and agile",
    "The FIFA World Cup is the biggest football tournament",
    "Tennis requires excellent hand-eye coordination",
    "Swimming is a great full-body workout exercise",
    "The Olympic Games bring athletes from around the world together",

    # Food / Cooking
    "Italian pasta is best served with fresh tomato sauce",
    "Sushi is a traditional Japanese dish made with rice and fish",
    "Baking bread requires flour water yeast and patience",
    "French cuisine is known for its butter and wine sauces",
    "Chocolate cake is a popular dessert for birthday parties",

    # Science / Space
    "The sun is a star at the center of our solar system",
    "Black holes have gravity so strong that light cannot escape",
    "DNA contains the genetic instructions for all living organisms",
    "Climate change is caused by greenhouse gas emissions",
    "Water is composed of two hydrogen atoms and one oxygen atom",
]

TEST_QUERIES = [
    ("AI and computer science", 3),
    ("soccer match", 3),
    ("cooking dinner", 3),
    ("planets and the universe", 3),
    ("training a model on data", 3),
]


def main():
    db = VectorDatabase(storage_path="vectordb_data")

    print("Loading sample documents...\n")
    for text in SAMPLE_DOCUMENTS:
        doc_id = db.add(text)
        print(f"  [{doc_id}] {text}")

    db.save()
    print(f"\nLoaded {len(SAMPLE_DOCUMENTS)} documents.\n")
    print("=" * 60)

    print("\nRunning test queries:\n")
    for query, k in TEST_QUERIES:
        print(f'  Query: "{query}"')
        results = db.query(query, k=k)
        for i, r in enumerate(results, 1):
            print(f"    {i}. [{r['score']:.4f}] {r['text']}")
        print()


if __name__ == "__main__":
    main()
