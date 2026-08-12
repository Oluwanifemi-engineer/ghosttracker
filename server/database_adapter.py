"""
Magneetar Unified Database Adapter
Provides a consistent interface across SQLite and PostgreSQL backends.
Enables seamless migration from SQLite to PostgreSQL for scaling.

STATUS (2026-08-12): **EXPERIMENTAL — NOT THE PRODUCTION DATA PLANE.**
Production runs SQLite (server/database.py). See docs/postgres-migration.md
(DECISION: migration frozen pending a real multi-tenant / HA requirement).
"""

import logging
import os
from typing import Any, Dict, List

from config import settings

logger = logging.getLogger(__name__)


class DatabaseAdapter:
    """Unified database adapter that transparently handles SQLite and PostgreSQL."""

    def __init__(self):
        self._backend = None
        self._initialized = False

    def initialize(self):
        """Initialize the appropriate database backend."""
        if self._initialized:
            return

        if settings.DATABASE_URL:
            self._backend = "postgresql"
            logger.info("Database adapter: PostgreSQL backend selected")
        else:
            self._backend = "sqlite"
            logger.info("Database adapter: SQLite backend selected")

        self._initialized = True

    @property
    def is_postgres(self) -> bool:
        return self._backend == "postgresql"

    @property
    def is_sqlite(self) -> bool:
        return self._backend == "sqlite"

    def get_backend(self) -> str:
        return self._backend or "sqlite"


# Global adapter instance
db_adapter = DatabaseAdapter()


class PostgresQueryBuilder:
    """Builds PostgreSQL-compatible queries with proper parameterization."""

    @staticmethod
    def upsert(table: str, data: Dict[str, Any], conflict_columns: List[str]) -> str:
        """Generate PostgreSQL UPSERT (INSERT ... ON CONFLICT) query."""
        columns = list(data.keys())
        values = [f"${i+1}" for i in range(len(columns))]
        update_cols = [f"{c} = EXCLUDED.{c}" for c in columns if c not in conflict_columns]

        query = f"""
            INSERT INTO {table} ({', '.join(columns)})
            VALUES ({', '.join(values)})
            ON CONFLICT ({', '.join(conflict_columns)})
            DO UPDATE SET {', '.join(update_cols)}
        """
        return query

    @staticmethod
    def now() -> str:
        """PostgreSQL NOW() function."""
        return "NOW()"

    @staticmethod
    def interval_days(days: int) -> str:
        """PostgreSQL interval expression."""
        return f"NOW() - INTERVAL '{days} days'"

    @staticmethod
    def ilike(column: str, value: str) -> str:
        """PostgreSQL ILIKE for case-insensitive search."""
        return f"{column} ILIKE %{value}%"

    @staticmethod
    def json_extract(column: str, key: str) -> str:
        """PostgreSQL JSON extraction."""
        return f"{column} ->> '{key}'"


class SQLiteQueryBuilder:
    """Builds SQLite-compatible queries with proper parameterization."""

    @staticmethod
    def upsert(table: str, data: Dict[str, Any], conflict_columns: List[str]) -> str:
        """Generate SQLite UPSERT (INSERT ... ON CONFLICT) query."""
        columns = list(data.keys())
        values = ["?" for _ in range(len(columns))]
        update_cols = [f"{c} = excluded.{c}" for c in columns if c not in conflict_columns]

        query = f"""
            INSERT INTO {table} ({', '.join(columns)})
            VALUES ({', '.join(values)})
            ON CONFLICT ({', '.join(conflict_columns)})
            DO UPDATE SET {', '.join(update_cols)}
        """
        return query

    @staticmethod
    def now() -> str:
        """SQLite current timestamp."""
        return "datetime('now')"

    @staticmethod
    def interval_days(days: int) -> str:
        """SQLite interval expression."""
        return f"datetime('now', '-{days} days')"

    @staticmethod
    def ilike(column: str, value: str) -> str:
        """SQLite LIKE for case-insensitive search (SQLite LIKE is case-insensitive by default)."""
        return f"{column} LIKE %{value}%"

    @staticmethod
    def json_extract(column: str, key: str) -> str:
        """SQLite JSON extraction."""
        return f"json_extract({column}, '$.{key}')"


def get_query_builder():
    """Get the appropriate query builder based on the database backend."""
    db_adapter.initialize()
    if db_adapter.is_postgres:
        return PostgresQueryBuilder()
    return SQLiteQueryBuilder()


# ─── Schema Migration Helpers ──────────────────────────────────────────────


class SchemaMigrator:
    """Database schema migration manager."""

    def __init__(self):
        self._migration_dir = os.path.join(os.path.dirname(__file__), "migrations")

    def get_current_version(self, conn) -> int:
        """Get current schema version."""
        try:
            if db_adapter.is_postgres:
                # For PostgreSQL, this should be called with an async connection
                # This is a placeholder - actual implementation uses asyncpg
                return 0
            else:
                row = conn.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1").fetchone()
                return row[0] if row else 0
        except Exception:
            return 0

    def ensure_version_table(self, conn):
        """Create schema_version table if it doesn't exist."""
        try:
            if db_adapter.is_postgres:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS schema_version (
                        version INTEGER PRIMARY KEY,
                        applied_at TIMESTAMPTZ DEFAULT NOW(),
                        description TEXT
                    )
                """
                )
            else:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS schema_version (
                        version INTEGER PRIMARY KEY,
                        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        description TEXT
                    )
                """
                )
        except Exception as e:
            logger.warning(f"Could not create schema_version table: {e}")

    def record_migration(self, conn, version: int, description: str):
        """Record a completed migration."""
        try:
            if db_adapter.is_postgres:
                conn.execute(
                    "INSERT INTO schema_version (version, description) VALUES ($1, $2)",
                    version,
                    description,
                )
            else:
                conn.execute(
                    "INSERT INTO schema_version (version, description) VALUES (?, ?)",
                    (version, description),
                )
        except Exception as e:
            logger.warning(f"Could not record migration: {e}")


# Singleton
schema_migrator = SchemaMigrator()
