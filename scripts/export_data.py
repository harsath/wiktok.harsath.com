"""Export curated article titles from a Wiki-Indexer SQLite DB into data/<alias>.json.

Usage: python3 scripts/export_data.py path/to/wiki_cats.db
"""
import json
import sqlite3
import sys
from pathlib import Path

# feed alias -> category_name in wiki_cats.db (keep in sync with src/feeds.js)
CATEGORIES = {
    "cs": "ComputerScience",
    "math": "Mathematics",
    "physics": "Physics",
    "bio": "Biology",
    "health": "Health",
    "phil": "Philosophy",
    "biz": "Business",
    "econ": "Economics",
    "law": "Law",
    "psych": "Psychology",
    "electronics": "Electronics",
}

def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    conn = sqlite3.connect(sys.argv[1])
    out_dir = Path(__file__).resolve().parent.parent / "data"
    out_dir.mkdir(exist_ok=True)
    for alias, category in CATEGORIES.items():
        rows = conn.execute(
            "SELECT DISTINCT name FROM articles WHERE category_name = ? ORDER BY name",
            (category,),
        ).fetchall()
        titles = [name.replace("_", " ") for (name,) in rows]
        (out_dir / f"{alias}.json").write_text(json.dumps(titles, ensure_ascii=False, separators=(",", ":")))
        print(f"{alias}: {len(titles)} titles")
    conn.close()

if __name__ == "__main__":
    main()
