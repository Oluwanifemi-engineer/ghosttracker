"""
Magneetar Storage Interface (ADR-0005, Phase 2a — 2026-08-11).

STATUS (2026-08-12): **EXPERIMENTAL — NOT THE PRODUCTION DATA PLANE.**
Production runs SQLite (server/database.py); this PgStore facade is only
wired when MT_DATABASE_URL is set, which is unsupported in production until
Phase 2b (SQL portability pass) lands. See docs/postgres-migration.md.

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
from datetime import date, datetime, timedelta
from typing import Any, List, Optional, Tuple

from config import settings

# ─── Interval string parsing (for PostgreSQL ::interval params) ───────────────
# asyncpg cannot parse strings like '-10 minutes' as interval params — it
# expects Python timedelta objects. This map converts common SQLite-style
# modifier strings to timedelta values.
_INTERVAL_RE = re.compile(
    r"^([+-]?\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)$",
    re.IGNORECASE,
)
_INTERVAL_MULTIPLIERS = {
    "second": 1,
    "seconds": 1,
    "minute": 60,
    "minutes": 60,
    "hour": 3600,
    "hours": 3600,
    "day": 86400,
    "days": 86400,
    "week": 604800,
    "weeks": 604800,
}


def _parse_interval_to_timedelta(s: str) -> timedelta | None:
    """Parse a modifier string like '-10 minutes' to a timedelta.

    Returns None for values that cannot be parsed (they pass through unchanged
    and asyncpg will surface the original error).
    """
    m = _INTERVAL_RE.match(s.strip())
    if not m:
        return None
    amount = int(m.group(1))
    unit = m.group(2).lower()
    multiplier = _INTERVAL_MULTIPLIERS.get(unit)
    if multiplier is None:
        return None
    return timedelta(seconds=amount * multiplier)


def _coerce_interval_params(params: tuple) -> tuple:
    """Convert interval-like string params to timedelta objects.

    The SQL rewriter transforms ``datetime('now', ?)`` to
    ``NOW() + (?::interval)``. When the param is a string like
    ``'-10 minutes'`` asyncpg throws because str has no .days attribute.
    Converting to timedelta lets asyncpg bind it properly.
    """
    coerced = list(params)
    for i, v in enumerate(coerced):
        if isinstance(v, str):
            td = _parse_interval_to_timedelta(v)
            if td is not None:
                coerced[i] = td
    return tuple(coerced)


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
    "mesh_beacons": {"active"},
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
    "mesh_beacons": {"registered_at", "updated_at"},
    "mesh_sightings": {"reported_at"},
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


def _rewrite_datetime_calls(sql: str) -> str:
    """Rewrite SQLite datetime(...) calls into Postgres-friendly expressions.

    Rules implemented:
    - datetime('now') -> NOW()
    - datetime('now', '<modifier>') -> NOW() + INTERVAL '<modifier>'
      (literal modifiers preserved)
    - datetime('now', ?) -> NOW() + (?::interval)  (parameterized modifier)
    - datetime(<expr>) -> <expr> (unwrap the call) for other expressions

    This function scans for "datetime(" occurrences and finds the matching
    closing parenthesis so nested parentheses are handled correctly.
    """
    out_parts: List[str] = []
    idx = 0
    while True:
        pos = sql.find("datetime(", idx)
        if pos == -1:
            out_parts.append(sql[idx:])
            break
        out_parts.append(sql[idx:pos])
        # find matching closing paren for the datetime( ... ) call
        i = pos + len("datetime(")
        depth = 1
        while i < len(sql) and depth > 0:
            if sql[i] == "(":
                depth += 1
            elif sql[i] == ")":
                depth -= 1
            i += 1
        # if we didn't find a match, append rest and stop
        if depth != 0:
            out_parts.append(sql[pos:])
            break
        inner = sql[pos + len("datetime(") : i - 1]
        inner_strip = inner.strip()
        repl = None
        # handle datetime('now', ...) and datetime('now')
        if inner_strip.startswith("'now'"):
            # split on first comma if present
            if "," in inner_strip:
                _, modifier = inner_strip.split(",", 1)
                modifier = modifier.strip()
                # parameterized modifier (e.g. datetime('now', ?)) -> use interval cast
                if modifier == "?":
                    repl = "NOW() + (?::interval)"
                else:
                    modifier = modifier.strip("'")
                    # Use signed interval text; Postgres accepts NOW() + INTERVAL '-5 minutes'
                    repl = f"NOW() + INTERVAL '{modifier}'"
            else:
                repl = "NOW()"
        else:
            # unwrap other datetime(x) to x (handles nested parentheses)
            repl = inner
        out_parts.append(repl)
        idx = i
    return "".join(out_parts)


def _rewrite_julianday_calls(sql: str) -> str:
    """Map SQLite julianday(x) -> EXTRACT(EPOCH FROM (x)) / 86400.0.

    This preserves differences between two julianday() calls because the
    Julian offset cancels; it's a pragmatic transform to avoid UndefinedFunction
    errors while keeping day-difference semantics.
    """
    # simple textual replacement: julianday(...) -> (EXTRACT(EPOCH FROM (...)) / 86400.0)
    out = []
    idx = 0
    while True:
        pos = sql.find("julianday(", idx)
        if pos == -1:
            out.append(sql[idx:])
            break
        out.append(sql[idx:pos])
        # find matching closing paren
        i = pos + len("julianday(")
        depth = 1
        while i < len(sql) and depth > 0:
            if sql[i] == "(":
                depth += 1
            elif sql[i] == ")":
                depth -= 1
            i += 1
        if depth != 0:
            out.append(sql[pos:])
            break
        inner = sql[pos + len("julianday(") : i - 1]
        repl = f"(EXTRACT(EPOCH FROM ({inner})) / 86400.0)"
        out.append(repl)
        idx = i
    return "".join(out)


_PK_COLUMNS = {
    # Known primary keys used by INSERT OR REPLACE sites in the codebase/tests.
    "cell_location_cache": "fingerprint",
    "devices": "id",
    "data_retention": "user_id",
    "users": "id",
    "api_keys": "id",
    "p2p_pairings": "id",
}


def _rewrite_insert_or_replace(sql: str) -> str:
    """Rewrite a simple ``INSERT OR REPLACE INTO table(cols) VALUES(vals)``
    to a Postgres ``INSERT ... ON CONFLICT(pk) DO UPDATE SET ...`` using the
    known primary key for that table.

    This is a targeted, best-effort translation for the small set of tables
    that still use the SQLite upsert pattern in tests and route code.
    If the pattern cannot be parsed or the table isn't known, the original
    SQL is returned unchanged (we don't try to be clever for arbitrary DML).
    """
    m = re.match(r"\s*INSERT\s+OR\s+REPLACE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)", sql, re.IGNORECASE)
    if not m:
        return sql
    table = m.group(1)
    cols = [c.strip().strip('"') for c in m.group(2).split(",")]
    vals = m.group(3).strip()
    pk = _PK_COLUMNS.get(table.lower())
    if not pk or pk not in cols:
        # cannot safely construct ON CONFLICT clause
        return sql
    # build SET clause mapping each column to EXCLUDED.col (skip pk)
    set_parts = [f"{c}=EXCLUDED.{c}" for c in cols if c != pk]
    set_clause = ", ".join(set_parts) if set_parts else "NOTHING"
    rewritten = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({vals}) ON CONFLICT ({pk}) DO UPDATE SET {set_clause}"
    return rewritten


def _rewrite_boolean_integer_comparisons(sql: str) -> str:
    """Replace comparisons like "col = 1/0" for known BOOLEAN columns with
    explicit TRUE/FALSE to satisfy Postgres type expectations.

    This is a conservative, textual transform applied across the statement.
    """
    out = sql
    # For each known boolean column name, replace 'col = 1' -> 'col = TRUE'
    for _table, cols in BOOLEAN_COLUMNS.items():
        for col in cols:
            # word-boundary safe replacements for = 1 / = 0
            out = re.sub(rf"\b{re.escape(col)}\b\s*=\s*1\b", f"{col} = TRUE", out)
            out = re.sub(rf"\b{re.escape(col)}\b\s*=\s*0\b", f"{col} = FALSE", out)
    return out


def _rewrite_last_insert_rowid(sql: str) -> str:
    """Rewrite ``SELECT last_insert_rowid()`` to a Postgres-compatible form.

    SQLite's ``last_insert_rowid()`` returns the rowid of the most recent
    INSERT on the connection. On Postgres with asyncpg, we can't call this
    function — but the ``PgStore`` already appends ``RETURNING id`` to plain
    INSERTs and exposes the result via ``lastrowid``. When route code calls
    ``SELECT last_insert_rowid()`` explicitly (e.g. after a plain INSERT),
    we rewrite it to ``SELECT lastval()`` which Postgres supports natively.
    """
    return sql.replace("last_insert_rowid()", "lastval()")


def _apply_all_rewrites(sql: str) -> str:
    """Apply the suite of small, surgical SQL rewrites used to bridge
    SQLite->Postgres dialect differences before placeholder translation.
    """
    s = sql
    s = _rewrite_datetime_calls(s)
    s = _rewrite_julianday_calls(s)
    s = _rewrite_insert_or_replace(s)
    s = _rewrite_boolean_integer_comparisons(s)
    s = _rewrite_last_insert_rowid(s)
    return s


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
    works. Skips ``INSERT OR REPLACE`` (handled by _rewrite_insert_or_replace)
    and any statement that already returns rows. Returns (rewritten_sql, is_plain)."""
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
    m = re.match(
        r"INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]*)\)",
        stripped,
        re.IGNORECASE,
    )
    if m:
        table = m.group(1).lower()
        cols = [c.strip().strip('"') for c in m.group(2).split(",")]
    else:
        m = re.match(
            r"UPDATE\s+(\w+)\s+SET\s+(.*?)(?:\s+WHERE|\s*$)",
            stripped,
            re.IGNORECASE | re.DOTALL,
        )
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
    m = re.match(
        r"INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+(\w+)\s*\(([^)]*)\)",
        stripped,
        re.IGNORECASE,
    )
    if m:
        table = m.group(1).lower()
        cols = [c.strip().strip('"') for c in m.group(2).split(",")]
    else:
        m = re.match(
            r"UPDATE\s+(\w+)\s+SET\s+(.*?)(?:\s+WHERE|\s*$)",
            stripped,
            re.IGNORECASE | re.DOTALL,
        )
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

        # When running against Postgres, apply small SQL rewrites to bridge
        # common SQLite dialect usage (datetime()/julianday/INSERT OR REPLACE,
        # boolean integer checks) *before* placeholder translation.
        if settings.DATABASE_URL:
            sql = _apply_all_rewrites(sql)

        # asyncpg is strict about Python types vs declared column types;
        # normalize 0/1 ints on BOOLEAN columns and ISO strings on TIMESTAMP
        # columns the way SQLite tolerated them. Also coerce obvious ISO-8601
        # datetime strings across all params as a safety net for WHERE/DELETE
        # and other statements where column->param position mapping is not
        # easily discoverable.
        params = _coerce_bool_params(sql, params)
        params = _coerce_timestamp_params(sql, params)
        # Coerce interval-like strings (e.g. '-10 minutes') to timedelta
        # objects so asyncpg can bind them for ::interval casts.
        params = _coerce_interval_params(params)
        # global heuristic: convert any ISO-like timestamp strings to datetime
        coerced = list(params)
        for i, v in enumerate(coerced):
            if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}T", v):
                try:
                    coerced[i] = datetime.fromisoformat(v.replace("Z", "+00:00"))
                except ValueError:
                    pass
        params = tuple(coerced)

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
    success. Concurrent workers may race on composite types — catch and
    treat as success (the first worker already created the schema)."""
    url = database_url or settings.DATABASE_URL
    if not url:
        return False
    db = _get_pg_db(url)
    try:
        _pg_loop.run(db.init_schema)
    except Exception as e:
        if "duplicate key" in str(e) and "pg_type" in str(e):
            # Concurrent workers racing on composite types — schema exists
            pass
        else:
            raise
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
