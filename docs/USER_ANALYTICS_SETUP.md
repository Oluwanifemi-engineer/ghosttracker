# Magneetar — User Analytics Setup

**Date:** August 2026  
**Approach:** Use existing infrastructure (SQLite + Prometheus) — no third-party analytics services

---

## Why No Google Analytics / Mixpanel / Amplitude?

1. **Privacy-first brand** — Magneetar's whole pitch is "we don't sell your data"
2. **Cost** — Most analytics services charge per event; you have ₦0 budget
3. **Complexity** — Adding a new dependency for 10 users is overkill
4. **Existing infrastructure** — You already have Prometheus metrics and an error_log table

---

## What to Track (MVP Metrics)

### Tier 1: Survival Metrics (Track These First)

| Metric | How to Track | Why It Matters |
|--------|-------------|----------------|
| **Active devices** | `SELECT COUNT(DISTINCT device_id) FROM locations WHERE server_timestamp > datetime('now', '-1 day')` | Proof the app works |
| **Daily pings** | `SELECT COUNT(*) FROM locations WHERE date(server_timestamp) = date('now')` | Background service survival |
| **Registration rate** | Count rows in `devices` table per day | Are new users installing? |
| **Command success rate** | `SELECT status, COUNT(*) FROM commands GROUP BY status` | Does the product work when needed? |

### Tier 2: Engagement Metrics (Track After 10 Users)

| Metric | How to Track | Why It Matters |
|--------|-------------|----------------|
| **Dashboard sessions** | Count unique JWTs issued per day | Are owners checking the dashboard? |
| **Feature usage** | Count commands by type per day | Which features are actually used? |
| **Geofence triggers** | Count geofence exit alerts per day | Is the safety feature valuable? |
| **Evidence exports** | Count PDF generation requests | Is the dossier feature valuable? |

### Tier 3: Business Metrics (Track After 100 Users)

| Metric | How to Track | Why It Matters |
|--------|-------------|----------------|
| **Retention (7-day)** | % of devices still active 7 days after registration | Core product stickiness |
| **Retention (30-day)** | % of devices still active 30 days after registration | Long-term value |
| **Feature adoption** | % of users who enable geofencing, sharing, etc. | What to build next |
| **Churn signals** | Devices silent > 48 hours | Who's about to leave |

---

## Implementation: 3 Steps

### Step 1: Add Analytics Table (5 minutes)

Add to `database.py` `init_db()`:

```sql
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    device_id TEXT,
    user_id TEXT,
    metadata TEXT,  -- JSON blob
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_type_time
    ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_device
    ON analytics_events(device_id, created_at);
```

### Step 2: Create Analytics Helper (10 minutes)

Create `server/analytics.py`:

```python
"""Lightweight analytics — writes to SQLite, no external services."""

import json
from datetime import datetime, timezone
from database import get_db_context


def track(event_type: str, device_id: str = None, user_id: str = None, **metadata):
    """Log an analytics event. Fire-and-forget; never blocks the request."""
    try:
        with get_db_context() as conn:
            conn.execute(
                "INSERT INTO analytics_events (event_type, device_id, user_id, metadata) VALUES (?, ?, ?, ?)",
                (event_type, device_id, user_id, json.dumps(metadata) if metadata else None),
            )
            conn.commit()
    except Exception:
        pass  # Analytics should never break the app


def query_events(event_type: str, days: int = 7) -> list[dict]:
    """Query recent events of a given type."""
    with get_db_context() as conn:
        rows = conn.execute(
            "SELECT * FROM analytics_events WHERE event_type=? AND created_at > datetime('now', ?) ORDER BY created_at DESC",
            (event_type, f"-{days} days"),
        ).fetchall()
        return [dict(row) for row in rows]


def daily_active_devices(days: int = 7) -> list[dict]:
    """Get daily active device counts."""
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT date(server_timestamp) as day, COUNT(DISTINCT device_id) as count
               FROM locations WHERE server_timestamp > datetime('now', ?)
               GROUP BY date(server_timestamp) ORDER BY day""",
            (f"-{days} days",),
        ).fetchall()
        return [dict(row) for row in rows]


def command_success_rate() -> dict:
    """Get command success/failure/pending counts."""
    with get_db_context() as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) as count FROM commands GROUP BY status"
        ).fetchall()
        return {row["status"]: row["count"] for row in rows}
```

### Step 3: Instrument Key Events (15 minutes)

Add `track()` calls to existing code:

```python
# In routes/devices.py — device registration
from analytics import track
track("device_registered", device_id=device_id, model=model)

# In routes/devices.py — location ping
track("location_ping", device_id=device_id, sentinel_score=score)

# In routes/devices.py — command issued
track("command_issued", device_id=device_id, command=command_type)

# In sentinel.py — theft detected
track("theft_detected", device_id=device_id, score=score, threat_level=level)

# In evidence_pdf.py — dossier exported
track("evidence_exported", device_id=device_id, case_id=case_id)
```

---

## Dashboard Metrics Endpoint

Add to `routes/metrics.py`:

```python
@app.get("/api/dashboard/analytics")
async def get_analytics(auth=Depends(get_current_user)):
    """MVP analytics for the dashboard."""
    from analytics import daily_active_devices, command_success_rate

    return {
        "active_devices_7d": daily_active_devices(7),
        "command_stats": command_success_rate(),
        "total_devices": get_device_count(),
        "total_locations": get_location_count(),
    }
```

---

## What NOT to Build

1. **Don't add Google Analytics** — privacy brand killer
2. **Don't add Mixpanel/Amplitude** — costs money, adds dependency
3. **Don't build a custom analytics dashboard** — query SQLite directly until you have 100+ users
4. **Don't track every single event** — track 5-10 key events, not 50
5. **Don't store analytics in a separate database** — use the same SQLite file, just a different table

---

## Monitoring Commands

Run these to check your metrics:

```bash
# Active devices today
sqlite3 server/magneetar.db "SELECT COUNT(DISTINCT device_id) FROM locations WHERE date(server_timestamp) = date('now')"

# Command success rate
sqlite3 server/magneetar.db "SELECT status, COUNT(*) FROM commands GROUP BY status"

# Daily registration trend
sqlite3 server/magneetar.db "SELECT date(registered) as day, COUNT(*) FROM devices GROUP BY date(registered) ORDER BY day DESC LIMIT 7"

# Database size
ls -lh server/magneetar.db
```

---

## Success Criteria

After 2 weeks with 10 users, you should be able to answer:

1. **Are devices still alive?** (daily_active_devices > 8)
2. **Are commands working?** (command_success_rate > 90%)
3. **Is anyone using the dashboard?** (dashboard_sessions > 0)
4. **Which features are used?** (command distribution)
5. **Who's about to churn?** (devices silent > 48h)

If you can't answer these questions, the analytics setup needs improvement.
