"""
Magneetar Storage Interface (ADR-0005, Phase 2a — 2026-08-11).

Two implementations of ONE synchronous interface, so every route, helper and
background loop keeps using the connection exactly as it did with SQLite:

    conn.execute(sql, params)   -> result with fetchone()/fetchall()
    result.rowcount / result.lastrowid
    conn.commit() / conn.close()

- ``SqliteStore`` wraps today's ``sqlite3.Connection`` — the zero-risk
  default (``MT_DATABASE_URL`` empty). Behavior is identical to before.
- ``PgStore`` is a synchronous facade over an asyncpg pool. Each call is
  marshalled onto a dedicated event-loop thread via
  ``asyncio.run_coroutine_threadsafe``; ``?`` placeholders are translated to
  ``$1, $2, ...`` (skipping quoted string literals), plain INSERTs get a
  ``RETURNING id`` clause so ``lastrowid`` keeps working, and row values are
  normalized to SQLite's semantics (bool -> 0/1, timestamps -> ISO strings)
  so route code that compares ``== 1`` or parses timestamps behaves
  identically on both backends.

NOT covered by Phase 2a (the documented SQL portability pass, §6.4 in
docs/postgres-migration.md): ``datetime('now', ?)`` string comparisons,
``INSERT OR REPLACE``, ``last_insert_rowid()``, boolean ``=1`` in WHERE
clauses, ``LIKE`` vs ``ILIKE``. Those are Phase 2b route-SQL fixes.
"""

import asyncio
import re
import threading
from datetime import date, datetime
from typing import Any, List, Optional, Tuple

from config import settings

# Boolean columns per table (mirrors the schema in database.py / the pg
# adapter). SQLite accepts 0/1 ints for BOOLEAN columns, but asyncpg requires
# real Python bools — the facade coerces params in these positions so route
# code that passes 0/1 keeps working on Postgres untouched.
BOOLEAN_COLUMNS = {
    "devices": {"is_stolen", "capture_armed", "sms_commands_enabled"},
    "locations": {
        "is_charging",
        "is_location_enabled",
        "is_airplane_mode",
        "sim_changed",
        "was_queued",
        "location_encrypted",
    },
    "media": set(),
    "commands": set(),
    "evidence_cases": {"pdf_generated"},
    "alerts": {"delivered"},
    "heartbeats": {"is_charging", "device_admin_active"},
    "geofences": {"is_safe_zone", "active"},
    "guardian_profiles": {"opted_in"},
    "recovery_requests": set(),
    "recovery_sightings": set(),
    "audit_log": set(),
    # NOTE: totp_enabled / totp_last_period are INTEGER in BOTH schemas (not
    # BOOLEAN) — deliberately absent here so 0/1 ints are never coerced to
    # bool for them (asyncpg would reject bool for an INTEGER column).
    "users": {"is_active", "email_verified"},
    "fcm_tokens": set(),
    "error_log": {"resolved"},
    "password_reset_tokens": {"used"},
    "email_verify_tokens": {"used"},
    "cell_location_cache": set(),
    "rate_limits": set(),
    "revoked_tokens": set(),
}

# Timestamp columns per table (mirrors the schema). asyncpg requires Python
# datetime objects for TIMESTAMP/TIMESTAMPTZ params — it does NOT auto-parse
# ISO strings like psycopg2 does — so the facade converts string params in
# these positions (SQLite stored them as strings, so route code passes
# strings today).
TIMESTAMP_COLUMNS = {
    "devices": {"last_seen", "registered", "theft_confirmed_at", "archived_at"},
    "locations": {"device_timestamp", "server_timestamp", "queued_at"},
    "media": {"timestamp"},
    "commands": {"issued_at", "executed_at", "expires_at"},
    "evidence_cases": {"created_at", "theft_time"},
    "alerts": {"sent_at"},
    "heartbeats": {"timestamp"},
    "geofences": {"created_at"},
    "guardian_profiles": {"created_at", "updated_at"},
    "recovery_requests": {"created_at", "closed_at"},
    "recovery_sightings": {"created_at"},
    "audit_log": {"timestamp"},
    "users": {"created_at", "last_login"},
    "fcm_tokens": {"created_at", "updated_at"},
    "error_log": {"timestamp", "resolved_at"},
    "password_reset_tokens": {"expires_at", "created_at"},
    "email_verify_tokens": {"expires_at", "created_at"},
    "cell_location_cache": {"resolved_at"},
    "rate_limits": {"timestamp"},
    "revoked_tokens": {"revoked_at"},
}

# ─── ? → $n placeholder translation ─────────────────────────────────────────


def translate_placeholders(sql: str) -> str:
    """Rewrite SQLite ``?`` placeholders to Postgres ``$1, $2, ...``.

    ``?`` characters inside single-quoted string literals are left alone
    (e.g. a literal ``'?'`` in SQL text must not become a parameter).
    """
    out: List[str] = []
    i, n = 0, 0
    while i < len(sql):
        ch = sql[i]
        if ch == "'":
            out.append(ch)
            i += 1
            while i < len(sql):
                if sql[i] == "'":
                    if i + 1 < len(sql) and sql[i + 1] == "'":
                        out.append("''")  # escaped quote inside a literal
                        i += 2
                        continue
                    out.append(ch)
                    i += 1
                    break
                out.append(sql[i])
                i += 1
            continue
        if ch == "?":
            n += 1
            out.append(f"${n}")
            i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _statement_kind(sql: str) -> str:
    """'select' | 'insert' | 'other' — based on the leading keyword."""
    stripped = sql.lstrip().upper()
    if stripped.startswith("SELECT") or stripped.startswith("WITH"):
        return "select"
    if stripped.startswith("INSERT"):
        return "insert"
    return "other"


def _rewrite_insert_returning(sql: str) -> Tuple[str, bool]:
    """Append ``RETURNING id`` to a plain single-row INSERT so ``lastrowid``
    works. Skips ``INSERT OR REPLACE`` (a Phase 2b dialect gap) and any
    statement that already returns rows. Returns (rewritten_sql, is_plain)."""
    stripped = sql.strip()
    upper = stripped.upper()
    if upper.startswith("INSERT INTO") and " RETURNING " not in upper and " SELECT " not in upper:
        return stripped.rstrip().rstrip(";") + " RETURNING id", True
    return sql, False


# ─── Row value normalization (SQLite-equivalent semantics) ─────────────────


def _normalize_value(value: Any) -> Any:
    """Map a Postgres value to what SQLite would have returned:

    - bool -> 0/1 (route code compares ``== 1`` / ``== 0`` on BOOLEAN cols)
    - datetime/date -> ISO-8601 string (route code calls
      ``datetime.fromisoformat(...)`` on TIMESTAMP columns)
    """
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


class _DictRow(dict):
    """dict with sqlite3.Row-style attribute access (``row.col``). Routes in
    this codebase index with brackets, but keeping attribute access preserves
    the full sqlite3.Row contract so no future route breaks on the pg path."""

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name) from None


def _normalize_row(row: dict) -> dict:
    return _DictRow({k: _normalize_value(v) for k, v in row.items()})


# ─── Result contract ───────────────────────────────────────────────────────


class PgResult:
    """Returned by ``PgStore.execute`` — mimics a sqlite3.Cursor.

    NOTE: for SELECTs, rowcount is len(rows) here vs -1 on a sqlite3 cursor;
    no route reads rowcount after a SELECT today (all rowcount consumers are
    DELETE/UPDATE), so the difference is cosmetic — do not "fix" it to -1
    without auditing those call sites.
    """

    def __init__(self, rows: List[dict], rowcount: int, lastrowid: Optional[Any]):
        self._rows = rows
        self.rowcount = rowcount
        self.lastrowid = lastrowid

    def fetchone(self) -> Optional[dict]:
        return self._rows[0] if self._rows else None

    def fetchall(self) -> List[dict]:
        return list(self._rows)


def _coerce_bool_params(sql: str, params: tuple) -> tuple:
    """Coerce int 0/1 to Python bool for BOOLEAN columns in INSERT/UPDATE.

    SQLite's type system accepts any value for any column; asyncpg validates
    the Python type against the declared column type, so an int 1 for a
    BOOLEAN column (legal today) would fail on Postgres. Map the named
    columns in the statement to their parameter positions and coerce only
    those positions — numeric columns are left untouched.
    """
    if not params:
        return params
    stripped = sql.lstrip()
    table, cols = None, None
    m = re.match(r"INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]*)\)", stripped, re.IGNORECASE)
    if m:
        table = m.group(1).lower()
        cols = [c.strip().strip('"') for c in m.group(2).split(",")]
    else:
        m = re.match(r"UPDATE\s+(\w+)\s+SET\s+(.*?)(?:\s+WHERE|\s*$)", stripped, re.IGNORECASE | re.DOTALL)
        if m:
            table = m.group(1).lower()
            cols = [a.split("=", 1)[0].strip().strip('"') for a in m.group(2).split(",")]
    if not cols:
        return params
    bool_cols = BOOLEAN_COLUMNS.get(table, set())
    coerced = list(params)
    for i, col in enumerate(cols):
        if i >= len(coerced):
            break
        val = coerced[i]
        if col in bool_cols and isinstance(val, int) and val in (0, 1):
            coerced[i] = bool(val)
    return tuple(coerced)


def _coerce_timestamp_params(sql: str, params: tuple) -> tuple:
    """Convert ISO-8601 string params to datetime objects for TIMESTAMP/
    TIMESTAMPTZ columns (asyncpg strictness — same mechanism as the boolean
    coercion above). Strings that do not parse are passed through unchanged
    so the error surfaces with the original value.
    """
    if not params:
        return params
    stripped = sql.lstrip()
    table, cols = None, None
    m = re.match(r"INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]*)\)", stripped, re.IGNORECASE)
    if m:
        table = m.group(1).lower()
        cols = [c.strip().strip('"') for c in m.group(2).split(",")]
    else:
        m = re.match(r"UPDATE\s+(\w+)\s+SET\s+(.*?)(?:\s+WHERE|\s*$)", stripped, re.IGNORECASE | re.DOTALL)
        if m:
            table = m.group(1).lower()
            cols = [a.split("=", 1)[0].strip().strip('"') for a in m.group(2).split(",")]
    if not cols:
        return params
    ts_cols = TIMESTAMP_COLUMNS.get(table, set())
    coerced = list(params)
    for i, col in enumerate(cols):
        if i >= len(coerced):
            break
        val = coerced[i]
        if col in ts_cols and isinstance(val, str):
            try:
                coerced[i] = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except ValueError:
                pass  # leave unchanged; the DB will surface the real error
    return tuple(coerced)


def _parse_rowcount(status: str) -> int:
    """asyncpg returns status strings like 'INSERT 0 1' / 'UPDATE 3'."""
    if not status:
        return 0
    try:
        return int(status.rsplit(" ", 1)[-1])
    except (ValueError, IndexError):
        return 0


# ─── PgStore: sync facade over asyncpg ─────────────────────────────────────


class _PgLoop:
    """Dedicated daemon thread + asyncio event loop owning the asyncpg pool.

    Kept separate from uvicorn's loop so sync route code can block on results
    via ``run_coroutine_threadsafe`` without starving the server's loop.
    """

    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._ready = threading.Event()
        self._started = False
        self._lock = threading.Lock()

    def _run(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._ready.set()
        self._loop.run_forever()

    def _ensure_started(self):
        # Guarded: concurrent first-use from multiple request threads must not
        # double-start the daemon thread (RuntimeError) or double-connect the
        # pool. All further calls take the fast path under the GIL.
        if self._started:
            return
        with self._lock:
            if not self._started:
                self._thread = threading.Thread(target=self._run, name="magneetar-pg-loop", daemon=True)
                self._thread.start()
                self._ready.wait()
                self._started = True

    def run(self, coro_factory, timeout: float = 60.0):
        """Run a coroutine on the loop thread and block for its result."""
        self._ensure_started()
        future = asyncio.run_coroutine_threadsafe(coro_factory(), self._loop)
        return future.result(timeout=timeout)


_pg_loop = _PgLoop()
_pg_db = None  # PostgresDatabase instance whose pool lives on _pg_loop
_pg_db_lock = threading.Lock()


def _get_pg_db(database_url: str):
    global _pg_db
    if _pg_db is None:
        with _pg_db_lock:
            if _pg_db is None:
                from database_postgres import PostgresDatabase

                db = PostgresDatabase()
                _pg_loop.run(lambda: db.connect(database_url))
                _pg_db = db
    return _pg_db


class PgStore:
    """Synchronous facade exposing the route-facing connection contract.

    Each instance is cheap and per-request (like a sqlite3.Connection); the
    underlying asyncpg pool is a shared singleton. ``commit()`` is a no-op
    (asyncpg auto-commits every statement) and ``close()`` is a no-op (the
    pool outlives the request).
    """

    def __init__(self, database_url: str = None):
        self._database_url = database_url or settings.DATABASE_URL

    def execute(self, sql: str, *params):
        if len(params) == 1 and isinstance(params[0], (list, tuple)):
            params = tuple(params[0])

        # asyncpg is strict about Python types vs declared column types;
        # normalize 0/1 ints on BOOLEAN columns and ISO strings on TIMESTAMP
        # columns the way SQLite tolerated them.
        params = _coerce_bool_params(sql, params)
        params = _coerce_timestamp_params(sql, params)

        pg_sql = translate_placeholders(sql)
        db = _get_pg_db(self._database_url)
        kind = _statement_kind(pg_sql)

        if kind == "select":
            rows = _pg_loop.run(lambda: db.fetch_all(pg_sql, *params))
            return PgResult([_normalize_row(r) for r in rows], len(rows), None)

        if kind == "insert":
            rewritten, is_plain = _rewrite_insert_returning(pg_sql)
            if is_plain:
                row = _pg_loop.run(lambda: db.fetch_one(rewritten, *params))
                if row:
                    row = _normalize_row(row)
                    return PgResult([], 1, row["id"])
                return PgResult([], 0, None)
            status = _pg_loop.run(lambda: db.execute(pg_sql, *params))
            return PgResult([], _parse_rowcount(status), None)

        status = _pg_loop.run(lambda: db.execute(pg_sql, *params))
        return PgResult([], _parse_rowcount(status), None)

    def commit(self):
        """No-op: asyncpg auto-commits each statement (Phase 2a semantics)."""

    def close(self):
        """No-op: the pool is shared and outlives individual stores."""

    def executescript(self, script):
        raise NotImplementedError(
            "executescript is SQLite-only (used by init_db); the Postgres "
            "schema is created by init_pg_store() via init_schema()."
        )


def init_pg_store(database_url: str = None) -> bool:
    """Connect the facade pool and apply the full schema. Returns True on
    success, raises on failure (main.py falls back to SQLite)."""
    url = database_url or settings.DATABASE_URL
    if not url:
        return False
    db = _get_pg_db(url)
    _pg_loop.run(db.init_schema)
    return True


def is_pg_store_ready() -> bool:
    """True once the facade pool is connected and the schema is applied."""
    return _pg_db is not None and _pg_db.is_connected


def close_pg_store():
    """Close the shared pool (used at shutdown / by tests)."""
    global _pg_db
    if _pg_db is not None:
        with _pg_db_lock:
            if _pg_db is not None:
                _pg_loop.run(_pg_db.disconnect)
                _pg_db = None


# ─── SqliteStore: wraps today's sqlite3.Connection ─────────────────────────


class SqliteStore:
    """Zero-risk default implementation: a thin wrapper around a
    ``sqlite3.Connection``. ``execute()`` returns the real sqlite3 cursor
    (fetchone/fetchall/rowcount/lastrowid), everything else delegates."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, *params):
        return self._conn.execute(sql, *params)

    def commit(self):
        return self._conn.commit()

    def close(self):
        return self._conn.close()

    def executescript(self, script):
        return self._conn.executescript(script)

    def __getattr__(self, name):
        return getattr(self._conn, name)
