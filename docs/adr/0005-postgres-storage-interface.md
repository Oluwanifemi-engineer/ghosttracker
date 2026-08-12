# ADR-0005: PostgreSQL storage interface — sync facade over asyncpg

- **Status:** Accepted — Phase 2a delivered (2026-08-11); Phase 2b (SQL
  portability pass) is the remaining work before production cutover.
- **Related:** ADR-0001 (SQLite as primary database), ADR-0002
  (backend single source of truth), ADR-0003 (API-first),
  `docs/postgres-migration.md`

## Context

The live data plane is SQLite (`server/database.py`); every route and
background loop calls `get_db()` / `get_db_context()` and uses the result as
a synchronous `sqlite3.Connection` (`?` params, `fetchone`/`fetchall`, rows
indexed like dicts, `commit()`, `lastrowid`). The PostgreSQL adapter
(`server/database_postgres.py`) has schema parity (CI-enforced) but is **not
wired into application routes** — enabling `MT_DATABASE_URL` today connects
Postgres yet every route still reads/writes SQLite.

Postgres removes SQLite's single-writer ceiling (the measured bottleneck) and
enables HA/failover/multi-instance, but only if the storage layer actually
switches. The fleet is ≤ ~3,000 devices; the decision rule from
`docs/postgres-migration.md` says migrate before crossing that line or when
HA is needed.

## Decision

Convert the storage layer with a **synchronous facade over asyncpg**, not an
async route rewrite:

1. Introduce one interface with two implementations:
   - `SqliteStore` — wraps today's `sqlite3.Connection` (the zero-risk
     default; `MT_DATABASE_URL` empty).
   - `PgStore` — asyncpg pool exposed through a sync facade that marshals
     each call onto the event loop (`run_coroutine_threadsafe`) and emulates
     `lastrowid` / `rowcount` / dict rows.
2. `get_db()` / `get_db_context()` keep their names and call signatures —
   routes, the write queue, archive/offline monitors, evidence, and
   background loops are untouched for the switch itself.
3. A parameter translator rewrites `?` → `$1, $2…` and a one-time SQL
   portability pass fixes the known dialect gaps (inventory in
   `docs/postgres-migration.md` §6.4: `datetime()` string comparisons,
   `last_insert_rowid()` → `RETURNING`, `INSERT OR REPLACE` → `ON CONFLICT`,
   boolean 0/1 → `true/false`, `LIKE` → `ILIKE`). The at-rest encryption
   columns (`locations.location_data`, `locations.location_encrypted`) are
   part of the parity gate — the DDL parity test plus
   `test_encryption_at_rest.py` against the pg backend keep them intact.
4. Rollout is **opt-in and reversible**: SQLite remains the default forever;
   enabling Postgres is a config flip, exercised first by the full test
   suite against a scratch pg, then a dual-write transition week
   (write-both/read-SQLite) before the read-side cutover.

### Alternatives considered

- **Async route refactor** (rejected): rewrites ~200 call sites across all
  routes and helpers with no functional gain at this fleet size, and it is a
  one-shot, hard-to-review change.
- **Repository pattern** (rejected for now): the cleanest long-term shape,
  but the largest blast radius; it becomes attractive after the facade lands
  and proves backend parity.

## Consequences

- **Positive:** the migration is a config flip plus a mechanical SQL pass;
  every phase lands green independently; rollback is unsetting the env var;
  the existing suite doubles as a pg test suite (new CI job with a pg
  service container).
- **Negative:** sync-over-async per-call marshalling adds small overhead on
  the pg path (acceptable: the current sync SQLite path is the ceiling
  today, and batched writes keep the per-ping cost dominated by Sentinel
  scoring, not DB round-trips); some pg-specific SQL remains in route code
  until later refactors.
- **Risk to manage:** timestamp semantics are the biggest correctness hazard
  (SQLite stores space-separated `CURRENT_TIMESTAMP` strings and ISO `T`
  strings; pg `timestamptz` normalizes) — the portability pass plus the
  dialect lint (extending `test_postgres_adapter_parity.py`) must gate every
  change.

## Validation

- Full suite green on SQLite (default) and against Postgres
  (`MT_DATABASE_URL` set) before Phase 2 closes.
- `tests/test_storage_facade.py` (landed with Phase 2a, 2026-08-11): 22
  tests — placeholder translator, INSERT→`RETURNING id` rewrite, bool /
  timestamp param coercion, SqliteStore scenario, and live PgStore
  scenarios (schema apply, `lastrowid`/`rowcount`, sqlite/pg identical-row
  parity) run against a scratch Postgres 16 container.
- App-level smoke on the pg-backed facade: dashboard reads return decrypted
  coordinates; remaining write failures are exclusively the §6.4
  `datetime()` dialect sites, recorded as the Phase 2b inventory.
- Encryption-at-rest contract tests run against both backends.
