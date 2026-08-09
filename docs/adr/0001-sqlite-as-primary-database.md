# ADR-0001: SQLite as Primary Database

**Date:** 2026-08-09  
**Status:** Accepted  
**Deciders:** Oluwanifemi Tinubu  
**Technical Story:** Need to justify and document the database architecture decision

## Context

Magneetar needs a reliable, performant, and easy-to-deploy database for storing:
- Device telemetry (location pings, heartbeats)
- User accounts and authentication data
- Evidence media metadata
- Alert history and audit logs
- Command history

The system must work reliably in:
- Single-server deployments (current)
- Docker environments
- Limited-resource environments

## Decision

We will use **SQLite** as the primary database with the following characteristics:
- WAL (Write-Ahead Logging) mode for concurrent reads
- Write batching via `MT_WRITE_BATCH_MS` for high-throughput telemetry
- Online backup via `scripts/backup-db.sh`
- Optional PostgreSQL adapter (`database_postgres.py`) for future scale-out

### Why SQLite?

1. **Zero-config deployment**: No separate database server to manage
2. **Single-file simplicity**: Easy backup, migration, and debugging
3. **Performance**: WAL mode handles concurrent reads efficiently
4. **Reliability**: ACID compliance with journaling
5. **Portability**: Works on any platform without dependencies

### Write Batching Strategy

For high-throughput telemetry (location pings every 3 seconds):
- Batch writes every 250ms (`MT_WRITE_BATCH_MS`)
- Dedicated writer connection per worker
- Removes SQLite's single-writer lock from the request path
- Measured: lifts throughput from ~370 req/s (sync) to 5-10x more

## Consequences

### Positive
- Simple deployment (single container, no database service)
- Easy backup and recovery
- No network latency for database operations
- Works offline or with limited connectivity

### Negative
- Single-writer limitation (mitigated by write batching)
- Not ideal for horizontal scaling (mitigated by PostgreSQL adapter)
- Manual vacuuming needed for long-term performance

## Related ADRs
- ADR-0000: Use Architecture Decision Records
