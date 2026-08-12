"""
Storage-interface facade tests (ADR-0005 Phase 2a, 2026-08-11).

The sync facade must make PgStore look EXACTLY like a sqlite3.Connection to
route code: ? -> $n translation (literals untouched), plain INSERTs rewritten
with RETURNING id so lastrowid works, rowcount parsed from asyncpg status
strings, and row values normalized to SQLite semantics (bool -> 0/1,
timestamps -> ISO strings).

The live Postgres tests are skipped unless MT_TEST_PG_URL is set (e.g. the
scratch container used by the migration drill):

    docker run -d --name magneetar-pg-test -e POSTGRES_PASSWORD=test \
        -e POSTGRES_DB=magneetar_test -p 5433:5432 postgres:16-alpine
    MT_TEST_PG_URL=postgresql://postgres:test@localhost:5433/magneetar_test \\
        python -m pytest tests/test_storage_facade.py
"""

import os
import sqlite3
import tempfile

import pytest

TEST_PG_URL = os.environ.get("MT_TEST_PG_URL", "")

from storage import (  # noqa: E402
    PgStore,
    SqliteStore,
    _coerce_bool_params,
    _coerce_timestamp_params,
    _parse_rowcount,
    _rewrite_insert_returning,
    init_pg_store,
    translate_placeholders,
)

# ─── Unit: ? -> $n translator ───────────────────────────────────────────────


class TestTranslatePlaceholders:
    def test_basic_sequential(self):
        sql = "SELECT * FROM devices WHERE id=? AND is_stolen=?"
        assert translate_placeholders(sql) == "SELECT * FROM devices WHERE id=$1 AND is_stolen=$2"

    def test_multiple_and_none(self):
        assert translate_placeholders("SELECT 1") == "SELECT 1"
        assert translate_placeholders("VALUES (?,?,?)") == "VALUES ($1,$2,$3)"

    def test_question_mark_inside_literal_preserved(self):
        # A literal '?' inside a quoted string must NOT become a parameter.
        sql = "SELECT * FROM alerts WHERE message LIKE '%?' OR device_id=?"
        assert translate_placeholders(sql) == "SELECT * FROM alerts WHERE message LIKE '%?' OR device_id=$1"

    def test_escaped_quote_inside_literal(self):
        sql = "SELECT * FROM audit_log WHERE details LIKE '%it''s ?%' AND actor=?"
        assert translate_placeholders(sql) == "SELECT * FROM audit_log WHERE details LIKE '%it''s ?%' AND actor=$1"

    def test_datetime_placeholder(self):
        sql = "DELETE FROM locations WHERE datetime(server_timestamp) < datetime('now', ?)"
        assert translate_placeholders(sql) == (
            "DELETE FROM locations WHERE datetime(server_timestamp) < datetime('now', $1)"
        )


# ─── Unit: INSERT -> RETURNING id rewrite ───────────────────────────────────


class TestInsertRewrite:
    def test_plain_insert_gets_returning(self):
        sql = "INSERT INTO commands (device_id, command) VALUES (?, ?)"
        rewritten, plain = _rewrite_insert_returning(sql)
        assert plain is True
        assert rewritten == "INSERT INTO commands (device_id, command) VALUES (?, ?) RETURNING id"

    def test_insert_or_replace_untouched(self):
        sql = "INSERT OR REPLACE INTO cell_location_cache (fingerprint, lat, lng) VALUES (?, ?, ?)"
        rewritten, plain = _rewrite_insert_returning(sql)
        assert plain is False
        assert rewritten == sql

    def test_existing_returning_untouched(self):
        sql = "INSERT INTO devices (id) VALUES (?) RETURNING id"
        rewritten, plain = _rewrite_insert_returning(sql)
        assert plain is False
        assert rewritten == sql

    def test_insert_select_untouched(self):
        sql = "INSERT INTO audit_log (action) SELECT action FROM backup_log"
        rewritten, plain = _rewrite_insert_returning(sql)
        assert plain is False
        assert rewritten == sql


# ─── Unit: boolean param coercion (asyncpg strictness) ──────────────────────


class TestBoolParamCoercion:
    def test_insert_boolean_column_coerced(self):
        params = _coerce_bool_params(
            "INSERT INTO locations (device_id, lat, lng, is_charging) VALUES (?, ?, ?, ?)",
            ("dev-1", 6.5, 3.4, 1),
        )
        assert params == ("dev-1", 6.5, 3.4, True)

    def test_numeric_columns_untouched(self):
        params = _coerce_bool_params(
            "INSERT INTO commands (device_id, command, priority) VALUES (?, ?, ?)",
            ("dev-1", "capture", 1),
        )
        assert params == ("dev-1", "capture", 1)  # priority stays an int

    def test_update_set_clause(self):
        params = _coerce_bool_params(
            "UPDATE devices SET is_stolen=?, last_seen=? WHERE id=?",
            (1, "2026-08-11T00:00:00Z", "dev-1"),
        )
        assert params == (True, "2026-08-11T00:00:00Z", "dev-1")

    def test_values_outside_where_untouched(self):
        params = _coerce_bool_params(
            "UPDATE alerts SET delivered=? WHERE device_id=? AND alert_type=?",
            (1, "dev-1", "theft"),
        )
        assert params == (True, "dev-1", "theft")

    def test_integer_columns_never_coerced(self):
        # totp_enabled / totp_last_period are INTEGER in BOTH schemas — a bool
        # would DataError on asyncpg. Regression pin from the 2026-08-11 review.
        params = _coerce_bool_params(
            "UPDATE users SET totp_enabled=?, totp_last_period=? WHERE id=?",
            (1, 0, "user-1"),
        )
        assert params == (1, 0, "user-1")


# ─── Unit: timestamp param coercion (asyncpg strictness) ────────────────────


class TestTimestampParamCoercion:
    def test_iso_string_to_datetime(self):
        from datetime import datetime

        params = _coerce_timestamp_params(
            "INSERT INTO locations (device_id, lat, lng, device_timestamp) VALUES (?, ?, ?, ?)",
            ("dev-1", 6.5, 3.4, "2026-08-11T06:20:04+00:00"),
        )
        assert isinstance(params[3], datetime)
        assert params[:3] == ("dev-1", 6.5, 3.4)

    def test_plain_columns_untouched(self):
        params = _coerce_timestamp_params(
            "INSERT INTO commands (device_id, command, priority) VALUES (?, ?, ?)",
            ("dev-1", "capture", 5),
        )
        assert params == ("dev-1", "capture", 5)

    def test_row_attribute_access(self):
        """PgResult rows must support sqlite3.Row-style row.col access."""
        from storage import _normalize_row

        row = _normalize_row({"lat": 6.5, "is_charging": True})
        assert row["lat"] == 6.5
        assert row.lat == 6.5  # attribute access parity with sqlite3.Row
        assert row.is_charging == 1  # bool -> 0/1 normalization
        with pytest.raises(AttributeError):
            _ = row.nope

    def test_z_suffix_handled(self):
        from datetime import datetime

        params = _coerce_timestamp_params(
            "UPDATE devices SET last_seen=? WHERE id=?",
            ("2026-08-11T06:20:04Z", "dev-1"),
        )
        assert isinstance(params[0], datetime)


# ─── Unit: rowcount parsing ─────────────────────────────────────────────────


class TestRowcountParsing:
    def test_status_strings(self):
        assert _parse_rowcount("INSERT 0 1") == 1
        assert _parse_rowcount("UPDATE 3") == 3
        assert _parse_rowcount("DELETE 2") == 2
        assert _parse_rowcount("") == 0
        assert _parse_rowcount(None) == 0


# ─── SqliteStore scenario (no Postgres needed) ──────────────────────────────


class TestSqliteStore:
    def _store(self):
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        from database import init_db

        init_db(path)
        return SqliteStore(conn), path

    def test_full_scenario_interface(self):
        store, path = self._store()
        try:
            cur = store.execute(
                "INSERT INTO devices (id, model, platform) VALUES (?, ?, ?)",
                ("facade-dev-1", "Facade Phone", "android"),
            )
            assert cur.lastrowid is not None  # TEXT pk -> sqlite rowid

            cur = store.execute(
                "INSERT INTO locations (device_id, lat, lng, provider) VALUES (?, ?, ?, ?)",
                ("facade-dev-1", 6.5, 3.4, "gps"),
            )
            assert isinstance(cur.lastrowid, int)
            assert cur.rowcount == 1

            row = store.execute(
                "SELECT lat, lng, provider FROM locations WHERE device_id=?", ("facade-dev-1",)
            ).fetchone()
            assert row["lat"] == 6.5 and row["lng"] == 3.4 and row["provider"] == "gps"

            store.commit()
            store.close()
        finally:
            if os.path.exists(path):
                os.unlink(path)


# ─── Live PgStore scenario (skipped without MT_TEST_PG_URL) ─────────────────


@pytest.fixture(scope="module")
def pg():
    """Init the schema once on the scratch database, then clean up rows."""
    assert init_pg_store(TEST_PG_URL), "facade pool must connect + apply schema"
    yield PgStore(TEST_PG_URL)
    store = PgStore(TEST_PG_URL)
    for table in (
        "recovery_sightings",
        "recovery_requests",
        "locations",
        "media",
        "commands",
        "evidence_cases",
        "alerts",
        "heartbeats",
        "geofences",
        "fcm_tokens",
        "error_log",
        "audit_log",
        "rate_limits",
        "devices",
    ):
        store.execute(f"DELETE FROM {table}")
    store.execute("DELETE FROM users WHERE email LIKE 'facade-%@test.dev'")


def _iso(v):
    """Normalize a timestamp value for cross-backend comparison."""
    from datetime import datetime

    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    try:
        return datetime.fromisoformat(str(v))
    except ValueError:
        return v


class TestPgStore:
    pytestmark = pytest.mark.skipif(not TEST_PG_URL, reason="MT_TEST_PG_URL not set (live Postgres required)")

    def test_schema_applied(self, pg):
        rows = pg.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'").fetchall()
        names = {r["table_name"] for r in rows}
        assert {"devices", "locations", "commands", "users", "fcm_tokens"}.issubset(names)

    def test_insert_lastrowid_and_select(self, pg):
        cur = pg.execute(
            "INSERT INTO devices (id, model, platform) VALUES (?, ?, ?)",
            ("facade-pg-1", "Facade PG", "android"),
        )
        assert cur.lastrowid == "facade-pg-1"  # RETURNING id on a TEXT pk

        cur = pg.execute(
            "INSERT INTO locations (device_id, lat, lng, provider, is_charging) VALUES (?, ?, ?, ?, ?)",
            ("facade-pg-1", 6.5244, 3.3792, "gps", True),
        )
        assert isinstance(cur.lastrowid, int), "AUTOINCREMENT pk must be an int"
        assert cur.rowcount == 1

        rows = pg.execute(
            "SELECT lat, lng, provider, is_charging, server_timestamp FROM locations WHERE device_id=?",
            ("facade-pg-1",),
        ).fetchall()
        assert len(rows) == 1
        row = rows[0]
        assert row["lat"] == 6.5244 and row["lng"] == 3.3792
        # SQLite-equivalent value semantics: bool -> 0/1, timestamps -> str.
        assert row["is_charging"] == 1
        assert isinstance(row["server_timestamp"], str)

    def test_update_delete_rowcount(self, pg):
        pg.execute(
            "INSERT INTO commands (device_id, command) VALUES (?, ?)",
            ("facade-pg-1", "capture"),
        )
        cur = pg.execute(
            "UPDATE commands SET status=? WHERE device_id=? AND command=?",
            ("executed", "facade-pg-1", "capture"),
        )
        assert cur.rowcount == 1
        cur = pg.execute("DELETE FROM commands WHERE device_id=? AND command=?", ("facade-pg-1", "capture"))
        assert cur.rowcount == 1

    def test_sqlite_pg_row_parity(self, pg):
        """The same statement through both stores must yield equivalent rows
        (the 'byte-identical JSON' intent from ADR-0005)."""
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        from database import init_db

        init_db(path)
        sq = SqliteStore(conn)
        try:
            for store in (sq, pg):
                store.execute(
                    "INSERT INTO devices (id, model, platform, is_stolen) VALUES (?, ?, ?, ?)",
                    ("facade-parity-1", "Parity", "android", 1),
                )
                store.execute(
                    "INSERT INTO locations (device_id, lat, lng, provider) VALUES (?, ?, ?, ?)",
                    ("facade-parity-1", 9.0820, 8.6753, "gps"),
                )
                store.commit()

            sq_row = sq.execute(
                "SELECT d.id, d.model, d.is_stolen, l.lat, l.lng FROM devices d "
                "JOIN locations l ON l.device_id = d.id WHERE d.id=?",
                ("facade-parity-1",),
            ).fetchone()
            pg_row = pg.execute(
                "SELECT d.id, d.model, d.is_stolen, l.lat, l.lng FROM devices d "
                "JOIN locations l ON l.device_id = d.id WHERE d.id=?",
                ("facade-parity-1",),
            ).fetchone()

            assert dict(sq_row) == dict(pg_row), f"row parity broken: {dict(sq_row)} vs {dict(pg_row)}"
        finally:
            if os.path.exists(path):
                os.unlink(path)
