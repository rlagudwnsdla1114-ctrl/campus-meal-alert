from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parent
data = root.parent / "local-data"
data.mkdir(parents=True, exist_ok=True)

with sqlite3.connect(data / "campus-meal.db") as db:
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript((root / "schema.sql").read_text(encoding="utf-8"))

    applied = db.execute(
        "SELECT 1 FROM schema_versions WHERE version = 2"
    ).fetchone()

    if applied:
        print("Already applied: version 2")
    else:
        try:
            db.executescript(
                (root / "002_allergies.sql").read_text(encoding="utf-8")
            )
        except Exception:
            db.rollback()
            raise
        print("Migration complete: version 2")

    print("Database:", data / "campus-meal.db")
    print("Tables:")
    for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ):
        print(" -", row[0])