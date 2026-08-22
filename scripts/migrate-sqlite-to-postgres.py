#!/usr/bin/env python3
"""
Magneetar — SQLite → PostgreSQL Migration Script

One-shot migration: reads all data from the SQLite database and inserts it
into the Postgres database. Run AFTER setting MT_DATABASE_URL and confirming
the Postgres schema auto-creates on server start.

Usage:
    # 1. Start the server with MT_DATABASE_URL set (creates Postgres schema)
    # 2. Run this script:
    python scripts/migrate-sqlite-to-postgres.py

    # Or with explicit paths:
    python scripts/migrate-sqlite-to-postgres.py \
        --sqlite /app/data/magneetar.db \
        --postgres postgresql://magneetar:magneetar@localhost:5432/magneetar

Requirements: psycopg2-binary (pip install psycopg2-binary)
"""

import argparse
import os
import sqlite3
import sys
import time

# Tables to migrate, in order (respects foreign key dependencies)
TABLES = [
    "users",
    "devices",
    "locations",
    "media",
    "commands",
    "evidence_cases",
    "alerts",
    "heartbeats",
    "geofences",
    "device_shares",
    "api_keys",
    "guardian_profiles",
    "recovery_requests",
    "recovery_sightings",
    "p2p_pairings",
    "audit_log",
    "fcm_tokens",
    "error_log",
    "password_reset_tokens",
    "email_verify_tokens",
    "cell_location_cache",
    "rate_limits",
    "revoked_tokens",
    "data_retention",
    "schema_migrations",
]


def migrate_table(sqlite_conn, pg_conn, table_name: str) -> int:
    """Copy all rows from one SQLite table to Postgres. Returns row count."""
    try:
        rows = sqlite_conn.execute(f"SELECT * FROM {table_name}").fetchall()
    except sqlite3.OperationalError:
        return 0  # table doesn't exist in SQLite

    if not rows:
        return 0

    # Get column names from SQLite
    columns = [desc[0] for desc in sqlite_conn.execute(f"SELECT * FROM {table_name} LIMIT 0").description]

    # Check which columns exist in Postgres
    try:
        pg_cols = pg_conn.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = %s ORDER BY ordinal_position",
            (table_name,),
        ).fetchall()
        pg_col_names = {row[0] for row in pg_cols}
    except Exception:
        pg_col_names = set(columns)

    # Filter to columns that exist in both
    common_cols = [c for c in columns if c in pg_col_names]
    if not common_cols:
        return 0

    placeholders = ", ".join(["%s"] * len(common_cols))
    col_names = ", ".join(common_cols)
    sql = f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"

    count = 0
    for row in rows:
        # Map row dict to common columns
        row_dict = dict(zip(columns, row))
        values = [row_dict[c] for c in common_cols]
        try:
            pg_conn.execute(sql, values)
            count += 1
        except Exception as e:
            if count == 0:
                print(f"  WARNING: {table_name}: {e}")
    pg_conn.commit()
    return count


def main():
    parser = argparse.ArgumentParser(description="Migrate SQLite → PostgreSQL")
    parser.add_argument("--sqlite", default=os.environ.get("MT_DB_PATH", "magneetar.db"))
    parser.add_argument("--postgres", default=os.environ.get("MT_DATABASE_URL", ""))
    args = parser.parse_args()

    if not args.postgres:
        print("ERROR: Set MT_DATABASE_URL or pass --postgres")
        sys.exit(1)

    print(f"Magneetar SQLite → PostgreSQL Migration")
    print(f"SQLite: {args.sqlite}")
    print(f"Postgres: {args.postgres.split('@')[-1] if '@' in args.postgres else args.postgres}")
    print()

    # Connect to SQLite
    sqlite_conn = sqlite3.connect(args.sqlite)
    sqlite_conn.row_factory = sqlite3.Row

    # Connect to Postgres
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 required. Install with: pip install psycopg2-binary")
        sys.exit(1)

    pg_conn = psycopg2.connect(args.postgres)
    pg_conn.autocommit = False

    total_rows = 0
    start = time.time()

    for table in TABLES:
        count = migrate_table(sqlite_conn, pg_conn, table)
        total_rows += count
        if count > 0:
            print(f"  {table}: {count:,} rows")

    elapsed = time.time() - start
    print(f"\nMigration complete: {total_rows:,} rows in {elapsed:.1f}s")

    sqlite_conn.close()
    pg_conn.close()


if __name__ == "__main__":
    main()
