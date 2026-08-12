# Magneetar — PostgreSQL Migration Runbook

Honest assessment of moving the live data plane from SQLite to PostgreSQL,
with measured evidence, the current gap, and a phased execution plan. This
document does NOT claim the switch is ready — it is the plan + evidence so
the switch can be scheduled deliberately.

Status date: **2026-08-07** · Production data plane: **SQLite** (unchanged).

> ## DECISION (2026-08-12) — migration FROZEN; SQLite is the production architecture
>
> The product's production data plane is **SQLite** (WAL, single instance,
> `scripts/backup-db.sh` online backups). The PostgreSQL adapter
> (`database_postgres.py` + `storage.py`, ADR-0005 Phase 2a) is an
> **experimental, unsupported** path: it is kept for future scale-out and its
> schema parity is CI-enforced, but **Phase 2b (the SQL portability pass) is
> NOT scheduled** and `MT_DATABASE_URL` must not be enabled in production.
> Route SQL still contains SQLite dialect (e.g. `datetime('now', ?)`, `INSERT
> OR REPLACE`) that Phase 2b would port.
>
> **This decision will be revisited only when a real requirement appears** —
> multi-tenant scale, HA/failover, or multi-instance deployment. Until then,
> the Docker stack (`docker-compose.yml`) runs SQLite on a persisted volume
> and the `kubernetes/` manifests are an aspirational reference, not the live
> deployment. No code changes here are required to ship features.

---

## 1. Why migrate (measured, this session)

| Measurement | SQLite (current) | Postgres (scratch, PG16) |
|---|---|---|
| Raw insert throughput, commit-per-row | ~1,900/s | — |
| Raw insert throughput, batched commits | ~705,000/s (WAL, commit/1000) | **bench below** |
| Full `/api/device/location` handler (4 workers, sync) | ~370–400 req/s, p50 3s at 2,000 devices | — |
| Full handler + `MT_WRITE_BATCH_MS=250` (deployed) | ~400 req/s ceiling; p99 91→50ms at 100 req/s | — |
| Single-writer serialization | **YES — the hard ceiling** | **NO** (multi-writer, MVCC) |

The measured bottleneck is NOT the disk: it is SQLite's **single-writer lock**
(per-commit path) and, above ~400 req/s, the **per-ping CPU work** (sentinel
scoring + ~6 SQLite ops + JSON + Redis publish). Postgres removes the
single-writer ceiling entirely; the CPU ceiling then scales with more
workers/cores. **Decision rule:** stay on SQLite while fleet ≤ ~2,000–3,000
devices (batched writes keep latency flat); migrate before crossing that line
or when you need HA/failover/multi-instance.

## 2. Status: schema parity ✅ — now WIRED via the storage facade (2026-08-11)

`server/database_postgres.py` (asyncpg pool) — schema parity audit:

| Table | In SQLite | In pg adapter | Notes |
|---|---|---|---|
| `users` | ✅ | ✅ (2026-08-10) | added — was missing; app could not boot against pg |
| `fcm_tokens` | ✅ | ✅ (2026-08-10) | added — push delivery |
| `error_log` | ✅ | ✅ (2026-08-10) | added — error tracking |
| `email_verify_tokens` | ✅ | ✅ (2026-08-10) | added — account verification |
| `password_reset_tokens` | ✅ | ✅ (2026-08-10) | added — password reset |
| `cell_location_cache` | ✅ | ✅ (2026-08-10) | added — offline-SMS coarse-locate cache |
| devices/commands/media columns | ✅ | ✅ (2026-08-10) | drifted columns re-synced (`device_key_hash`, alert prefs, SMS relay, `failure_reason`, `delivery_channel`, `file_path`, `file_size`) |
| 14 other tables | ✅ | ✅ | alerts, audit_log, commands, devices, evidence_cases, geofences, guardian_profiles, heartbeats, locations, media, rate_limits, recovery_requests, recovery_sightings, revoked_tokens |

As of **Phase 2a (2026-08-11)** the adapter is no longer an orphan: setting
`MT_DATABASE_URL` makes `get_db()`/`get_db_context()` return the **PgStore
sync facade** (`server/storage.py`, ADR-0005) and every route reads/writes
Postgres. Phase 2a covers the interface conversion (`?`→`$n` translator,
plain-INSERT `RETURNING id` for `lastrowid`, bool 0/1 + ISO-timestamp param
coercion for asyncpg strictness, row-value normalization back to SQLite
semantics) and is validated live against a scratch Postgres 16
(`tests/test_storage_facade.py`, 22 tests incl. sqlite/pg row parity). The
remaining work before production cutover is the **Phase 2b SQL portability
pass** (§6.4) — `datetime()` dialect calls and `INSERT OR REPLACE` still
live in route SQL and fail on pg (smoke-proven sites in §6.4).

Table + column parity is now **enforced by CI** —
`tests/test_postgres_adapter_parity.py` parses the DDL from both sides (no
Postgres needed) and fails if the pg adapter ever misses a SQLite table or
column again.

**`database.py` (the live data plane) is still SQLite-only** — every route
uses `get_db()`/`get_db_context()` returning `sqlite3.Connection`.
`main.py` explicitly warns that the pg adapter is NOT wired into application
routes. Enabling `MT_DATABASE_URL` today would connect Postgres but every
route would still read/write SQLite. **Flipping the env var is NOT a
migration — the storage interface itself must be converted.**

## 3. Migration drill — proven this session (lossless)

On a scratch Postgres 16 container, a drill copied the **production** DB
(read-only copy of `/app/data/magneetar.db`):

```
20 tables migrated; parity failures: 0
users=14 devices=1 locations=1794 heartbeats=154 audit_log=897 error_log=88
```

Type mapping used (drill): `INTEGER→BIGINT`, `REAL→DOUBLE PRECISION`,
`TEXT→TEXT`; primary keys preserved (ids keep values → references intact).
Foreign keys are NOT recreated by the drill — they must be rebuilt in the
real migration (see §5). The drill script pattern is reusable:
`scripts/`-candidate `pg_migrate.py` (SQLite→pg copy + parity check).

## 4. Phased plan (each phase lands green independently)

**Phase 1 — Schema parity (1–2 days).** Add the 6 missing tables +
constraints to `database_postgres.py` matching `database.py`'s DDL exactly
(column names/types/defaults, indexes, FKs, the `location_encrypted` /
`sms_phone` / `alert_settings` columns added in v1.4). Add a schema-drift
test: `database.py` schema vs `database_postgres.py` schema must match
table-for-table, column-for-column.

**Phase 2 — Storage interface (the real work, 3–5 days).** Introduce a thin
storage layer the routes already depend on (`get_db`/`get_db_context`) that
returns a SQLite connection by default and a pg-backed adapter when
`MT_DATABASE_URL` is set. This means converting `database.py`'s helpers and
the route modules' `?`/`%s` params to asyncpg parameter style — the single
biggest chunk. Recommend: keep SQLite as the default forever (`MT_DATABASE_URL`
empty), so risk is opt-in. **See the full conversion plan in §7 below and
ADR-0005** (`docs/adr/0005-postgres-storage-interface.md`).

**Phase 3 — Cutover drill (1 day).** From the proven §3 script:
1. `scripts/backup-db.sh` (pre-migration checkpoint).
2. Run the real migration (schema + data + indexes + FKs) into a scratch pg.
3. Boot a staging server with `MT_DATABASE_URL` → run the full test suite +
   the fleet load test against it.
4. Verify counts/`integrity_check` equivalents; keep SQLite untouched.

**Phase 4 — Production switch (maintenance window, 30–60 min).** Deploy
server with `MT_DATABASE_URL` set + `MT_DB_PATH` left (fallback), health-gate
with `deploy.sh`, watch: registration, heartbeats, WS, alerts. Rollback =
unset `MT_DATABASE_URL` (SQLite still has the full history up to the switch;
dual-write during a transition week is the safer variant).

## 5. Open items to settle before Phase 1

- **Timestamp comparison**: SQLite's `datetime()` string normalization is
  used in several queries; pg uses proper `timestamptz`. The migration must
  store timestamps as `timestamptz` and the query layer must stop relying on
  string comparison (the `datetime(expires_at)` patterns).
- **FK rebuild**: `devices` FK references from locations/media/commands/etc.
  must be created in dependency order and validated (`pg_restore`-style
  `--disable-triggers` or explicit ordering).
- **Per-user device-limit + unowned-cap queries**: straight-forward port, but
  include them in the schema-drift test.
- **Encryption at rest**: SQLite stores location telemetry AES-256-GCM
  encrypted (per-device HKDF keys) when `MT_ENCRYPTION_KEY` is set — account
  secrets are always field-encrypted. pg keeps the same ciphertext columns
  (parity-enforced); `pgcrypto`/TDE remain optional OS-level considerations
  (not required to start).
- **Hosting**: a production pg instance (managed: Neon/Supabase/RDS, or a
  second container on this VPS) — decide the ops owner before Phase 3.

## 6. Storage interface conversion plan (the Phase 2 detail)

### 6.1 Goal and non-goals

**Goal:** make every route run against Postgres by swapping `get_db()`
internals — no route rewrites required for the switch itself. **Non-goals:**
async-everything, an ORM, or a repository-layer rewrite. The fleet is ≤3k
devices; the win is removing SQLite's single-writer ceiling and enabling
HA/multi-instance, not chasing async purity.

### 6.2 The facade contract

Routes today treat the `get_db()` result as a `sqlite3.Connection`:
`execute(sql, params)` / `fetchone()` / `fetchall()` / `commit()` /
`close()`, rows indexable like dicts (`row["lat"]`), plus `lastrowid` and
`rowcount`. The conversion introduces **two implementations of one
interface** (built on the existing `database_adapter.py` scaffolding):

- `SqliteStore` — wraps today's `sqlite3.Connection`; the zero-risk default.
- `PgStore` — asyncpg pool with a **sync facade**: each call marshals to the
  event loop (`run_coroutine_threadsafe`), returns dict rows, and emulates
  `lastrowid`/`rowcount`.

`get_db()`/`get_db_context()` return whichever the config selects
(`MT_DATABASE_URL` set → PgStore). The `?` params stay `?` in route code; a
param translator rewrites `?` → `$1, $2…` and string-literal dates →
`timestamptz` literals before dispatch. A `PG_SQL` portability pass then
fixes the ~12 known dialect gaps (§7.4).

### 6.3 Why this shape (alternatives rejected)

| Option | Verdict | Reason |
|---|---|---|
| **A. Sync facade over asyncpg** (chosen) | ✅ | Routes/helpers/write-queue/background loops stay untouched; the switch is a config flip + SQL portability pass; reversible by unsetting the env var. |
| B. Async route refactor | ❌ | Rewrites ~200 call sites across routes + write_queue + archive/offline monitors + evidence; no functional gain at this fleet size; one-shot, hard to review. |
| C. Repository pattern | ❌ | Cleanest long-term, largest short-term blast radius; better after A lands and proves parity. |

### 6.4 Known SQL portability gaps (inventory — fix in Phase 2b)

Audited against the live codebase (2026-08-11):

1. **`?` placeholders** → `$1, $2…` (param translator; order-preserving).
2. **`datetime('now', ?)` / `datetime(col) < datetime('now')`** string
   comparison patterns → `NOW() - interval '…'` / `col < NOW()`. This is the
   single biggest correctness risk (ISO-8601 `T` strings vs `timestamptz`).
   **Smoke-proven blockers (2026-08-11, live pg):** `POST /api/device/register`
   (`routes/devices.py:188` adoption `datetime(last_seen) < datetime('now', ?)`,
   plus `devices.py:172` `datetime(COALESCE(last_seen, registered))`),
   `POST /api/auth/login` (`database.py:681` rate-limit purge
   `datetime('now', ?)`), `routes/metrics.py` (~17 count queries with
   `datetime('now', '-N unit')` literals), `routes/dashboard.py:1138/1402/1424`,
   `offline_monitor.py:66/71`, `archive_monitor.py:61/64`, and the retention
   purges in `database.py:716-768`. **Recommended implementation point:** a
   facade-level SQL rewrite in `storage.py` (no route edits) —
   `datetime('now')` → `NOW()`; `datetime('now', '<offset>')` →
   `NOW() ± interval '<n> <unit>'` (sign from the offset);
   `datetime('now', $n)` → `NOW() ± interval $n` with the bound param value
   stripped of its leading sign; bare `datetime(<expr>)` → `<expr>`. The
   offset literals are all `'-N unit'` / `'-N unit'` shaped, so a small
   regex pass covers every site above.
3. **`last_insert_rowid()`** → `RETURNING id`.
4. **`INSERT OR REPLACE`** (cell_location_cache) → `INSERT … ON CONFLICT …
   DO UPDATE`.
5. **Boolean 0/1 ints** → `true/false` (asyncpg booleans); `WHERE is_stolen=1`
   must become `= true` or `= TRUE`.
6. **`COALESCE`** — portable, no change.
7. **`PRAGMA`/`sqlite_master`** — SQLite-only; keep behind `is_sqlite` guards
   (only used by `database.py` itself, not routes).
8. **`strftime`/`datetime` functions** in the retention purge and archive
   sweep → interval arithmetic.
9. **Index/constraint rebuild**: pg FKs must be created in dependency order
   (devices first), matching `init_db()`'s table order.
10. **`UNIQUE(device_id, fcm_token)` upserts** — both dialects support
    `ON CONFLICT`, syntax differs slightly (case of `excluded`).
11. **`LIKE` vs `ILIKE`** — pg is case-sensitive; use `ILIKE` (builder exists).
12. **`server_timestamp` storage format** — SQLite stores `CURRENT_TIMESTAMP`
    space-strings AND ISO `T` strings; pg `timestamptz` normalizes — the
    dual-mode readers (e.g. `datetime(server_timestamp)`) must be converted
    in the same pass.
13. **At-rest encryption columns** — `locations.location_data` (TEXT
    ciphertext) and `locations.location_encrypted` (int flag) must survive
    the port unchanged; the DDL parity test already enforces them today, and
    `test_encryption_at_rest.py` must pass against the pg backend (6.6) so
    the conversion can never silently drop or rename the at-rest columns.

### 6.5 Phased delivery (each lands green)

- **2a — Facade + config flip — ✅ DELIVERED (2026-08-11).** `SqliteStore`/
  `PgStore` + `?`→`$n` translator in `server/storage.py`; `get_db()` selects
  by env (`MT_DATABASE_URL` set → PgStore); asyncpg strictness handled in the
  facade (bool 0/1 → bool, ISO strings → datetime for timestamp columns,
  plain INSERT → `RETURNING id` for `lastrowid`, row normalization bool→0/1
  + datetime→str). Validated live against scratch Postgres 16:
  `tests/test_storage_facade.py` (22 tests) including identical-rows parity
  with SQLite; app-level smoke on pg confirmed dashboard reads return
  decrypted coords and the remaining write failures are exclusively the
  §6.4 `datetime()` dialect sites (Phase 2b). Full suite green on SQLite
  (default — facade inert without `MT_DATABASE_URL`).
- **2b — Portability pass (2–3 days).** Fix §7.4 items; extend
  `test_postgres_adapter_parity.py` with a query-dialect lint (no
  `last_insert_rowid`, `datetime(`, `OR REPLACE`, `=1` on boolean columns in
  route SQL). Full suite green on both backends.
- **2c — Dual-write week (production).** Deploy with `MT_DATABASE_URL` set in
  *dual-write* mode (write both backends, read SQLite) behind a feature flag;
  a nightly reconciliation job diffs row counts + checksums. Read-side
  cutover flips a flag; rollback = flip back + unset env.

### 6.6 Testing strategy

- Keep the DDL parity test (already CI-enforced).
- New CI job: `pytest tests/ -q` against Postgres (service container) with
  `MT_DATABASE_URL` — the same suite, second backend.
- New `test_storage_facade.py`: same scenario run through both stores
  (register → location → command → ack → export), asserting byte-identical
  JSON responses.
- The mode-matrix test for encryption (`test_encryption_at_rest.py`) must run
  against both backends too (it asserts the `location_encrypted` contract,
  not any one engine).

## 7. Decision gate (do not skip)

- [ ] Phase 1 landed: schema-drift test green (tables/columns identical)
- [ ] Phase 2 landed: full suite green with `MT_DATABASE_URL` set
- [ ] Phase 3 drill: 20/20 tables parity + load test p95 < 100ms at 2,000 devices
- [ ] Off-site backups configured first (Postgres needs its own backup story —
      `pg_dump` + the same rclone remote, so a migration can never be the
      only copy of the data)
- [ ] Maintenance window scheduled + rollback rehearsed (unset env, restart)
