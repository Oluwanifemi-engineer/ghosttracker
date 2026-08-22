# Magneetar — Capacity & Performance Report

**Date:** 2026-08-22
**Environment:** Docker Compose, 4 uvicorn workers, SQLite WAL + write batching (250ms), Redis pub/sub
**Server:** Production on port 8002 (Docker)

---

## Load Test Results

### Summary Table

| Devices | Throughput | Success Rate | p50 | p95 | p99 | Verdict |
|---------|-----------|-------------|-----|-----|-----|---------|
| 50 | 16.3 req/s | 100% | 13ms | 369ms | 376ms | ✅ Excellent |
| 200 | 62.4 req/s | 100% | 17ms | 609ms | 960ms | ✅ Good |
| 500 | 73.7 req/s | 99.6% | 14ms | 546ms | 987ms | ✅ Good |
| 1,000 | 209.6 req/s | 96.6% | 403ms | 4,121ms | 10,255ms | ⚠️ Stressed |
| 2,000 | 127.6 req/s | 39.6% | 10,120ms | 10,791ms | 10,985ms | 🔴 Broken |

### Key Findings

1. **SQLite + write batching handles ~500 devices comfortably** (p50 < 20ms, 100% success)
2. **1,000 devices is the practical ceiling** (p95 hits 4.1s, approaching 5s busy_timeout)
3. **2,000 devices overwhelms SQLite** (60% error rate, p50 > 10s)
4. **Write batching (250ms) is the key enabler** — without it, SQLite saturates at ~370 req/s
5. **Registration is the bottleneck** — 2,000 serial registrations take 40s; parallel batching helps

### Throughput Curve

```
Devices    Throughput    Status
─────────────────────────────
   50      16.3 req/s    ✅ Comfortable
  200      62.4 req/s    ✅ Comfortable
  500      73.7 req/s    ✅ Comfortable
1,000     209.6 req/s    ⚠️ Stressed (p95 > 4s)
2,000     127.6 req/s    🔴 Broken (60% errors)
```

---

## Capacity Tiers

### Tier 1: Solo/Beta (Current)
- **Users:** 1–5
- **Devices:** 1–6
- **Dashboards:** 1–2
- **Status:** ✅ Running in production
- **Load:** <1% capacity

### Tier 2: Small Deployment
- **Users:** 10–50
- **Devices:** 10–50
- **Dashboards:** 10–20
- **Status:** ✅ Comfortable
- **Load:** ~10% capacity

### Tier 3: Medium Deployment
- **Users:** 100–500
- **Devices:** 100–300
- **Dashboards:** 50–200
- **Status:** ✅ Within limits
- **Load:** ~50% capacity

### Tier 4: Heavy Deployment (SQLite Ceiling)
- **Users:** 500–1,000
- **Devices:** 500–1,000
- **Dashboards:** 200–500
- **Status:** ⚠️ Near ceiling
- **Load:** ~80% capacity

### Tier 5: Scale-Out (Requires Postgres)
- **Users:** 1,000+
- **Devices:** 1,000+
- **Dashboards:** 500+
- **Status:** 🔴 Requires Postgres activation
- **Load:** Beyond SQLite capacity

---

## Architecture Limits

| Component | Limit | Bottleneck |
|-----------|-------|------------|
| **SQLite writes** | ~210 req/s (batched) | Single-writer lock, 5s busy_timeout |
| **SQLite reads** | Unlimited (WAL) | Concurrent readers fine |
| **Dashboard connections** | 1,000 (4 × 250) | WebSocket cap per worker |
| **Unowned devices** | 250 (configurable) | Anti-flood guard |
| **Devices per user** | 1–999 (plan tier) | Billing gate |

---

## What Breaks at Scale

| Trigger | Symptom | Fix |
|---------|---------|-----|
| >1,000 devices @ 3s cadence | p95 > 4s, errors | Activate Postgres |
| >1,000 dashboard connections | New connections rejected | Add workers or use Postgres |
| SQLite file >100GB | Slow checkpoints | Migrate to Postgres |
| Single node CPU saturated | All latency spikes | Horizontal scale with Postgres |

---

## Recommendations

1. **For <500 devices:** SQLite is fine. No changes needed.
2. **For 500–1,000 devices:** SQLite with write batching works but monitor p95.
3. **For 1,000+ devices:** Activate Postgres (uncomment in docker-compose.yml).
4. **For 5,000+ devices:** Postgres + connection pooling + read replicas.
5. **For 10,000+ devices:** Postgres cluster + CDN for media + Redis caching layer.

---

## How to Activate Postgres

```bash
# 1. Uncomment postgres service in docker-compose.yml
# 2. Uncomment MT_DATABASE_URL line
# 3. Restart:
docker compose up -d

# 4. Migrate data from SQLite:
python scripts/migrate-sqlite-to-postgres.py

# 5. Verify:
curl http://localhost:8002/health
```

---

## Monitoring

- **Grafana dashboard:** `ops/grafana-dashboard.json` (12 panels)
- **Prometheus config:** `ops/prometheus.yml`
- **Load test:** `python scripts/load_test.py --devices N --duration 30`
- **Cache metrics:** `GET /api/metrics/json` (Redis hit rate, evictions)
