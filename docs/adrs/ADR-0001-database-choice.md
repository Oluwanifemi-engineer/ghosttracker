# ADR-0001: Database Choice — SQLite to PostgreSQL Migration

**Status:** Accepted
**Date:** 2026-09-02
**Deciders:** Oluwanifemi Tinubu

## Context

Magneetar needs a database that can handle:
- Concurrent location writes from 1,000+ devices (300+ writes/second)
- WebSocket fan-out to 100+ dashboard sessions
- Geospatial queries for geofencing
- Point-in-time recovery for data compliance

SQLite served well during development but has fundamental limitations:
- Single-writer lock prevents concurrent writes
- No built-in replication or point-in-time recovery
- Limited geospatial query support

## Decision

**Use PostgreSQL (via Neon) as the default production database.**

- SQLite remains available for local development (no PostgreSQL required)
- PostgreSQL is the default in docker-compose.yml
- The storage facade (storage.py) auto-detects `MT_DATABASE_URL` and routes accordingly
- Schema parity is enforced by CI tests (test_postgres_adapter_parity.py)

## Consequences

### Positive
- Concurrent writes without locking
- Built-in geospatial support (PostGIS available)
- Point-in-time recovery via Neon
- Connection pooling via asyncpg
- Horizontal scaling ready

### Negative
- Requires external service (Neon) for production
- Slightly more complex local development setup
- Migration effort for existing SQLite users

### Risks
- Neon free tier has storage limits (0.5 GB)
- Cold start latency on Neon free tier (5-10 seconds)

## Alternatives Considered

1. **SQLite with WAL mode** — Rejected: single-writer limitation
2. **MySQL** — Rejected: weaker geospatial support
3. **MongoDB** — Rejected: no ACID transactions for financial data
4. **CockroachDB** — Rejected: overkill for current scale

## References

- Neon documentation: https://neon.tech/docs
- PostgreSQL vs SQLite benchmarks: https://www.postgresql.org/docs/current/performance-tips.html
