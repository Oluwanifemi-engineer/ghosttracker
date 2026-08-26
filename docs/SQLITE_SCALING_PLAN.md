# Magneetar — SQLite Scaling Plan

**Date:** August 2026  
**Status:** Plan — execute when SQLite hits real limits

---

## Current State

- **Data plane:** SQLite with WAL mode on persisted Docker volume
- **Write batching:** `MT_WRITE_BATCH_MS=250` removes single-writer lock from request path
- **Connection pooling:** `db_pool.py` with `busy_timeout=5000`
- **Postgres adapter:** Exists but frozen (ADR-0005)
- **Actual load:** 1 user, 1 device, ~0 concurrent users

**Honest assessment:** SQLite will handle 1,000+ concurrent users with proper WAL configuration. The scaling problem is theoretical, not real.

---

## When SQLite Will Actually Break

| Threshold | What Happens | Evidence |
|-----------|--------------|----------|
| **~1,000 concurrent users** | Write contention increases, p50 latency rises | SQLite WAL handles ~300 writes/sec sync, ~2,000+ with batching |
| **~10,000 devices** | Database file exceeds 1GB, backup/restore slows | WAL checkpointing becomes expensive |
| **~100,000 location rows/day** | Query performance degrades on unindexed columns | Need composite indexes on `(device_id, server_timestamp)` |
| **Multiple workers** | Each worker opens its own connection | WAL allows concurrent reads, but writes still serialize |

**The real ceiling is ~5,000-10,000 active devices on a single server with write batching enabled.**

---

## Scaling Path: 3 Phases

### Phase 1: Optimize SQLite (Do This Now)

Cost: ₦0 | Effort: 1 day | Handles: up to 5,000 devices

**Already implemented:**
- ✅ WAL mode (`PRAGMA journal_mode=WAL`)
- ✅ Write batching (`MT_WRITE_BATCH_MS=250`)
- ✅ Connection pooling (`db_pool.py`)
- ✅ Busy timeout (`PRAGMA busy_timeout=5000`)
- ✅ Memory cache (`PRAGMA cache_size=-64000`)

**Add these optimizations:**
```sql
-- Composite indexes for hot queries
CREATE INDEX IF NOT EXISTS idx_locations_device_time
  ON locations(device_id, server_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_commands_device_status
  ON commands(device_id, status);
CREATE INDEX IF NOT EXISTS idx_heartbeats_device_time
  ON heartbeats(device_id, timestamp DESC);

-- Periodic VACUUM (run weekly via cron)
VACUUM;
ANALYZE;
```

**Monitor these metrics:**
```sql
-- Check database size
SELECT page_count * page_size as size_bytes FROM pragma_page_count(), pragma_page_size();

-- Check WAL size
SELECT * FROM pragma_wal_checkpoint(TRUNCATE);

-- Check slow queries
-- (enable via config: PRAGMA sql_trace = ON)
```

### Phase 2: PostgreSQL Migration (When You Have 1,000+ Users)

Cost: ~$20/month | Effort: 2-3 days | Handles: up to 100,000 devices

**The Postgres adapter already exists** (`server/database_postgres.py`, `server/storage.py`). It's frozen but functional.

**Activation steps:**
1. Uncomment the `postgres` service in `docker-compose.yml`
2. Set `MT_DATABASE_URL=postgresql://magneetar:magneetar@postgres:5432/magneetar`
3. Run `make test` — the storage facade routes all reads/writes to Postgres
4. Migrate existing SQLite data:
   ```bash
   # Export from SQLite
   sqlite3 magneetar.db .dump > dump.sql

   # Import to Postgres
   psql -h localhost -U magneetar -d magneetar < dump.sql
   ```

**What changes:**
- All route code stays the same (storage facade abstracts the backend)
- Write batching is skipped (Postgres handles concurrent writes natively)
- Connection pool uses `asyncpg` instead of `sqlite3`

**What to watch:**
- SQL dialect differences (already patched in Phase 2b)
- `INSERT OR REPLACE` → `INSERT ... ON CONFLICT`
- `datetime('now')` → `NOW()`
- `PRAGMA` statements → Postgres equivalents

### Phase 3: Horizontal Scaling (When You Have 10,000+ Users)

Cost: ~$100/month | Effort: 1-2 weeks | Handles: 100,000+ devices

**Only if Phase 2 isn't enough:**

1. **Multiple API servers** behind a load balancer
2. **PostgreSQL with read replicas** for dashboard queries
3. **Redis for session caching** (already in docker-compose)
4. **CDN for media** (move evidence files to S3/R2)
5. **Background job queue** for alert delivery (Celery/RQ)

**Architecture:**
```
                    ┌─────────────┐
                    │ Load Balancer│
                    └──────┬──────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ API (1)  │ │ API (2)  │ │ API (3)  │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          ▼
                   ┌──────────────┐
                   │  PostgreSQL  │
                   │  (Primary)   │
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │  PostgreSQL  │
                   │  (Replica)   │
                   └──────────────┘
```

---

## Decision Framework

| Users | Database | Server | Monthly Cost |
|-------|----------|--------|--------------|
| 0-1,000 | SQLite (WAL + batching) | Single VPS | ~$10 |
| 1,000-10,000 | PostgreSQL (single) | Single VPS | ~$30 |
| 10,000-50,000 | PostgreSQL (replica) | 2-3 servers | ~$100 |
| 50,000+ | PostgreSQL (cluster) | Kubernetes | ~$500+ |

---

## What NOT to Do

1. **Don't migrate to Postgres before you have 1,000 users** — SQLite is simpler, cheaper, and handles more load than you think
2. **Don't set up Kubernetes before you have 10,000 users** — Docker Compose on a single server handles most workloads
3. **Don't add Redis caching before you have real traffic** — the in-memory cache (`cache.py`) is sufficient for now
4. **Don't shard the database** — vertical scaling (bigger server) is cheaper than horizontal scaling (more servers) until you're at 100K+ users

---

## Monitoring Queries

Run these weekly to know when to scale:

```sql
-- Database size trend
SELECT
  date(timestamp) as day,
  COUNT(*) as locations_today
FROM locations
WHERE timestamp > datetime('now', '-7 days')
GROUP BY date(timestamp)
ORDER BY day DESC;

-- Active devices (last 24h)
SELECT COUNT(DISTINCT device_id) as active_devices
FROM locations
WHERE server_timestamp > datetime('now', '-1 day');

-- Write throughput (last hour)
SELECT COUNT(*) as writes_last_hour
FROM locations
WHERE server_timestamp > datetime('now', '-1 hour');

-- Database file size
-- Run from shell: ls -lh /app/data/magneetar.db
```

**Alert thresholds:**
- `active_devices > 1,000` → Consider Phase 2 (Postgres)
- `writes_last_hour > 100,000` → Check write batching is working
- `database_size > 1GB` → Plan migration within 30 days
