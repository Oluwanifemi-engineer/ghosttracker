"""
PostgreSQL adapter schema-parity regression test.

`database_postgres.py` is the optional scale-out adapter for the SQLite data
plane (server/database.py + migrations.py). It is NOT wired into application
routes (main.py logs a warning when MT_DATABASE_URL is set), but when it IS
used its schema must cover the full SQLite schema — a missing table or column
breaks registration, push delivery, password reset, or error tracking the
moment someone flips the env var (this exact drift shipped once: the adapter
was missing `users`, `fcm_tokens`, `error_log`, the token tables, and
`cell_location_cache`).

This test parses the CREATE TABLE / ALTER TABLE DDL from both sides and
asserts the pg adapter covers every SQLite table AND every SQLite column. It
runs without a Postgres instance, so CI can always catch drift.
"""

import re
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
DATABASE_PY = SERVER_DIR / "database.py"
MIGRATIONS_PY = SERVER_DIR / "migrations.py"
PG_ADAPTER_PY = SERVER_DIR / "database_postgres.py"

# SQLite-internal bookkeeping tables the pg adapter is not required to mirror.
SQLITE_INTERNAL_TABLES = {"schema_migrations", "sqlite_sequence"}

_TABLE_RE = re.compile(r"CREATE TABLE IF NOT EXISTS (\w+)\s*\(")
_ALTER_RE = re.compile(r"ALTER TABLE (\w+) ADD COLUMN (\w+)")

# Column-definition lines inside a CREATE TABLE block. One column per line in
# both files; constraint lines (PRIMARY/UNIQUE/FOREIGN/CHECK) are not columns.
_SKIP_COLUMN_STARTS = ("primary", "unique", "foreign", "check", "constraint", ")")


def _parse_table_blocks(source: str, tables: dict[str, set[str]]):
    """Parse one-COLUMN-per-line CREATE TABLE blocks into table -> column set."""
    for match in _TABLE_RE.finditer(source):
        table = match.group(1)
        cols = tables.setdefault(table, set())
        for line in source[match.end() :].splitlines():
            stripped = line.strip()
            if stripped.startswith(")"):
                break
            if not stripped or stripped.startswith("--"):
                continue
            # Strip any parenthesized constraint args so a bare UNIQUE(cols)
            # line is recognized as a constraint, not a bogus column.
            first = stripped.split(maxsplit=1)[0].strip(",").split("(")[0]
            if first.lower() in _SKIP_COLUMN_STARTS or first.startswith("("):
                continue
            cols.add(first)


def _extract_sqlite_schema() -> dict[str, set[str]]:
    """Table -> column set for the SQLite schema (CREATE + ALTER DDL)."""
    tables: dict[str, set[str]] = {}
    _parse_table_blocks(DATABASE_PY.read_text(), tables)
    _parse_table_blocks(MIGRATIONS_PY.read_text(), tables)
    for match in _ALTER_RE.finditer(DATABASE_PY.read_text() + "\n" + MIGRATIONS_PY.read_text()):
        tables.setdefault(match.group(1), set()).add(match.group(2))
    return tables


def _extract_pg_schema() -> dict[str, set[str]]:
    """Table -> column set from the pg adapter's CREATE TABLE DDL."""
    tables: dict[str, set[str]] = {}
    _parse_table_blocks(PG_ADAPTER_PY.read_text(), tables)
    return tables


def test_pg_adapter_has_every_sqlite_table():
    sqlite_schema = _extract_sqlite_schema()
    pg_schema = _extract_pg_schema()
    missing = set(sqlite_schema) - set(pg_schema) - SQLITE_INTERNAL_TABLES
    assert not missing, (
        "PostgreSQL adapter is missing tables present in the SQLite schema: "
        f"{sorted(missing)}. Add them to database_postgres.py init_schema()."
    )


def test_pg_adapter_columns_cover_sqlite_columns():
    sqlite_schema = _extract_sqlite_schema()
    pg_schema = _extract_pg_schema()
    gaps: dict[str, list[str]] = {}
    for table, sqlite_cols in sorted(sqlite_schema.items()):
        if table in SQLITE_INTERNAL_TABLES:
            continue
        missing = sqlite_cols - pg_schema.get(table, set())
        if missing:
            gaps[table] = sorted(missing)
    assert not gaps, (
        "PostgreSQL adapter columns lag the SQLite schema for: " f"{gaps}. Update database_postgres.py init_schema()."
    )


def test_pg_adapter_no_sqlite_internal_tables_required():
    """Sanity: only the known SQLite-internal tables may be absent from pg."""
    sqlite_schema = _extract_sqlite_schema()
    pg_schema = _extract_pg_schema()
    absent = set(sqlite_schema) - set(pg_schema)
    assert absent <= SQLITE_INTERNAL_TABLES, f"Unexpected tables absent from the pg adapter: {sorted(absent)}"
