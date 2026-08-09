"""
Magneetar Database Connection Pool
Provides connection pooling for SQLite to handle high concurrency.

SQLite's single-writer limitation means we need to be smart about connections:
- Readers can run concurrently (WAL mode)
- Writers must serialize (but we batch writes)
- Connection pooling reduces overhead of creating/destroying connections

This module provides a thread-safe connection pool that:
1. Reuses connections instead of creating new ones
2. Limits total connections to prevent resource exhaustion
3. Provides health checking for stale connections
4. Supports both sync and async patterns
"""

import logging
import sqlite3
import threading
import time
from collections import deque
from contextlib import contextmanager
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

# Pool configuration
_MIN_CONNECTIONS = 2
_MAX_CONNECTIONS = 10  # SQLite doesn't benefit from many connections
_MAX_IDLE_SECONDS = 300  # Close connections idle for 5 minutes
_HEALTH_CHECK_INTERVAL = 60  # Check connection health every minute


class SQLiteConnectionPool:
    """Thread-safe SQLite connection pool with health checking."""

    def __init__(self, db_path: str, min_connections: int = _MIN_CONNECTIONS, max_connections: int = _MAX_CONNECTIONS):
        self._db_path = db_path
        self._min_connections = min_connections
        self._max_connections = max_connections
        self._pool: deque = deque()
        self._lock = threading.Lock()
        self._total_created = 0
        self._total_reused = 0
        self._total_failed = 0
        self._last_health_check = time.time()

        # Pre-create minimum connections
        for _ in range(min_connections):
            conn = self._create_connection()
            if conn:
                self._pool.append((conn, time.time()))

    def _create_connection(self) -> Optional[sqlite3.Connection]:
        """Create a new database connection with optimal settings."""
        try:
            conn = sqlite3.connect(self._db_path, check_same_thread=False, timeout=10)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA busy_timeout=5000")
            conn.execute("PRAGMA synchronous=NORMAL")  # Faster than FULL, still safe with WAL
            conn.execute("PRAGMA cache_size=-64000")  # 64MB cache
            conn.execute("PRAGMA temp_store=MEMORY")
            self._total_created += 1
            return conn
        except Exception as e:
            logger.error(f"Failed to create database connection: {e}")
            self._total_failed += 1
            return None

    def _is_connection_healthy(self, conn: sqlite3.Connection) -> bool:
        """Check if a connection is still usable."""
        try:
            conn.execute("SELECT 1")
            return True
        except Exception:
            return False

    def _cleanup_stale_connections(self):
        """Remove connections that have been idle too long."""
        now = time.time()
        stale_threshold = now - _MAX_IDLE_SECONDS
        cleaned = 0

        with self._lock:
            while self._pool and self._pool[0][1] < stale_threshold:
                conn, _ = self._pool.popleft()
                try:
                    conn.close()
                except Exception:
                    pass
                cleaned += 1

        if cleaned > 0:
            logger.debug(f"Cleaned up {cleaned} stale database connections")

    def _periodic_health_check(self):
        """Run health check periodically."""
        now = time.time()
        if now - self._last_health_check < _HEALTH_CHECK_INTERVAL:
            return

        self._last_health_check = now
        self._cleanup_stale_connections()

        # Log pool stats
        with self._lock:
            stats = {
                "pool_size": len(self._pool),
                "total_created": self._total_created,
                "total_reused": self._total_reused,
                "total_failed": self._total_failed,
            }
        logger.debug(f"DB pool stats: {stats}")

    @contextmanager
    def get_connection(self):
        """Get a connection from the pool. Returns it to the pool when done."""
        self._periodic_health_check()
        conn = None

        with self._lock:
            # Try to get from pool
            while self._pool:
                candidate, _ = self._pool.popleft()
                if self._is_connection_healthy(candidate):
                    conn = candidate
                    self._total_reused += 1
                    break
                else:
                    try:
                        candidate.close()
                    except Exception:
                        pass

        # Create new connection if pool is empty
        if conn is None:
            conn = self._create_connection()

        if conn is None:
            raise RuntimeError("Could not create database connection")

        try:
            yield conn
        finally:
            # Return to pool if under limit
            returned_to_pool = False
            with self._lock:
                if len(self._pool) < self._max_connections:
                    try:
                        # Reset connection state
                        conn.rollback()
                        self._pool.append((conn, time.time()))
                        returned_to_pool = True
                    except Exception:
                        pass
            # Close if can't return to pool
            if not returned_to_pool:
                try:
                    conn.close()
                except Exception:
                    pass

    def close_all(self):
        """Close all connections in the pool."""
        with self._lock:
            while self._pool:
                conn, _ = self._pool.popleft()
                try:
                    conn.close()
                except Exception:
                    pass
            self._total_created = 0
            self._total_reused = 0
            self._total_failed = 0

    def get_stats(self) -> dict:
        """Get pool statistics."""
        with self._lock:
            return {
                "pool_size": len(self._pool),
                "min_connections": self._min_connections,
                "max_connections": self._max_connections,
                "total_created": self._total_created,
                "total_reused": self._total_reused,
                "total_failed": self._total_failed,
                "db_path": self._db_path,
            }


# Global pool instance
_pool: Optional[SQLiteConnectionPool] = None


def get_pool() -> SQLiteConnectionPool:
    """Get or create the global connection pool."""
    global _pool
    if _pool is None:
        _pool = SQLiteConnectionPool(settings.DB_PATH)
        logger.info(f"Database connection pool initialized (min={_MIN_CONNECTIONS}, max={_MAX_CONNECTIONS})")
    return _pool


@contextmanager
def get_pooled_connection():
    """Get a connection from the global pool."""
    pool = get_pool()
    with pool.get_connection() as conn:
        yield conn


def get_pool_stats() -> dict:
    """Get pool statistics."""
    pool = get_pool()
    return pool.get_stats()


def close_pool():
    """Close the global pool."""
    global _pool
    if _pool is not None:
        _pool.close_all()
        _pool = None
