"""
Magneetar Analytics — Lightweight user metrics
No external analytics services. Privacy-first. Writes to SQLite.

See docs/USER_ANALYTICS_SETUP.md for full setup guide.
"""

import json
import logging

from database import get_db_context

logger = logging.getLogger("magneetar.analytics")


def track(event_type: str, device_id: str = None, user_id: str = None, **metadata):
    """Log an analytics event. Fire-and-forget; never blocks the request.

    Usage:
        track("device_registered", device_id=device_id, model="Samsung A54")
        track("command_issued", device_id=device_id, command="lock")
        track("theft_detected", device_id=device_id, score=85, threat_level="CRITICAL")
    """
    try:
        with get_db_context() as conn:
            conn.execute(
                "INSERT INTO analytics_events (event_type, device_id, user_id, metadata) VALUES (?, ?, ?, ?)",
                (event_type, device_id, user_id, json.dumps(metadata) if metadata else None),
            )
            conn.commit()
    except Exception:
        pass  # Analytics should never break the app


def daily_active_devices(days: int = 7) -> list[dict]:
    """Get daily active device counts for the last N days."""
    try:
        with get_db_context() as conn:
            rows = conn.execute(
                """SELECT date(server_timestamp) as day, COUNT(DISTINCT device_id) as count
                   FROM locations WHERE server_timestamp > datetime('now', ?)
                   GROUP BY date(server_timestamp) ORDER BY day""",
                (f"-{days} days",),
            ).fetchall()
            return [dict(row) for row in rows]
    except Exception:
        return []


def command_success_rate() -> dict:
    """Get command success/failure/pending/expired counts."""
    try:
        with get_db_context() as conn:
            rows = conn.execute("SELECT status, COUNT(*) as count FROM commands GROUP BY status").fetchall()
            return {row["status"]: row["count"] for row in rows}
    except Exception:
        return {}


def event_counts(event_type: str, days: int = 7) -> int:
    """Count events of a given type in the last N days."""
    try:
        with get_db_context() as conn:
            row = conn.execute(
                "SELECT COUNT(*) as cnt FROM analytics_events WHERE event_type=? AND created_at > datetime('now', ?)",
                (event_type, f"-{days} days"),
            ).fetchone()
            return row["cnt"] if row else 0
    except Exception:
        return 0


def top_events(days: int = 7, limit: int = 10) -> list[dict]:
    """Get the most frequent event types in the last N days."""
    try:
        with get_db_context() as conn:
            rows = conn.execute(
                """SELECT event_type, COUNT(*) as count
                   FROM analytics_events
                   WHERE created_at > datetime('now', ?)
                   GROUP BY event_type
                   ORDER BY count DESC
                   LIMIT ?""",
                (f"-{days} days", limit),
            ).fetchall()
            return [dict(row) for row in rows]
    except Exception:
        return []
