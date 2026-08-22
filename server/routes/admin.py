"""
Magneetar Admin Dashboard API
Internal company dashboard for Magneetar workers.

Features:
- User analytics (signups, active, churned)
- Revenue metrics (subscriptions, bounties)
- System health (uptime, errors, performance)
- Support ticket management
- Device fleet overview
- Community watch analytics
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(auth: str = Depends(require_dashboard_auth)) -> str:
    """Only admin users can access the admin dashboard."""
    user_id = user_id_from_subject(auth)
    with get_db_context() as db:
        user = db.execute(
            "SELECT role FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not user or user[0] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


# ─── Overview Stats ─────────────────────────────────────────────────────────


@router.get("/stats")
async def get_admin_stats(auth: str = Depends(_require_admin)):
    """Get high-level admin dashboard stats."""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    with get_db_context() as db:
        # User stats
        total_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        new_users_today = db.execute("SELECT COUNT(*) FROM users WHERE created_at >= ?", (today,)).fetchone()[0]
        new_users_week = db.execute("SELECT COUNT(*) FROM users WHERE created_at >= ?", (week_ago,)).fetchone()[0]
        active_users = db.execute(
            "SELECT COUNT(DISTINCT owner_id) FROM devices WHERE last_seen >= ?",
            ((now - timedelta(hours=24)).isoformat(),),
        ).fetchone()[0]

        # Device stats
        total_devices = db.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
        active_devices = db.execute(
            "SELECT COUNT(*) FROM devices WHERE last_seen >= ?",
            ((now - timedelta(hours=1)).isoformat(),),
        ).fetchone()[0]
        stolen_devices = db.execute("SELECT COUNT(*) FROM devices WHERE is_stolen = 1").fetchone()[0]

        # Subscription stats
        paying_users = db.execute("SELECT COUNT(*) FROM users WHERE subscription_status = 'active'").fetchone()[0]
        personal_subs = db.execute(
            "SELECT COUNT(*) FROM users WHERE subscription_plan LIKE 'personal%' AND subscription_status = 'active'"
        ).fetchone()[0]
        family_subs = db.execute(
            "SELECT COUNT(*) FROM users WHERE subscription_plan LIKE 'family%' AND subscription_status = 'active'"
        ).fetchone()[0]

        # Revenue estimate (monthly)
        monthly_revenue = personal_subs * 1500 + family_subs * 3000  # in Naira

        # Alert stats
        alerts_today = db.execute("SELECT COUNT(*) FROM alerts WHERE created_at >= ?", (today,)).fetchone()[0]
        alerts_week = db.execute("SELECT COUNT(*) FROM alerts WHERE created_at >= ?", (week_ago,)).fetchone()[0]

        # Community watch stats
        theft_reports = db.execute("SELECT COUNT(*) FROM theft_reports WHERE created_at >= ?", (month_ago,)).fetchone()[
            0
        ]
        active_bounties = db.execute("SELECT COUNT(*) FROM bounties WHERE status = 'active'").fetchone()[0]

    return {
        "users": {
            "total": total_users,
            "new_today": new_users_today,
            "new_this_week": new_users_week,
            "active_24h": active_users,
        },
        "devices": {
            "total": total_devices,
            "active_1h": active_devices,
            "stolen": stolen_devices,
        },
        "revenue": {
            "paying_users": paying_users,
            "personal_subs": personal_subs,
            "family_subs": family_subs,
            "monthly_estimate_naira": monthly_revenue,
            "monthly_estimate_usd": monthly_revenue // 800,  # Rough USD conversion
        },
        "alerts": {
            "today": alerts_today,
            "this_week": alerts_week,
        },
        "community": {
            "theft_reports_30d": theft_reports,
            "active_bounties": active_bounties,
        },
    }


# ─── User Growth Chart ─────────────────────────────────────────────────────


@router.get("/user-growth")
async def get_user_growth(
    days: int = 30,
    auth: str = Depends(_require_admin),
):
    """Get daily user signup data for charting."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    with get_db_context() as db:
        rows = db.execute(
            """SELECT DATE(created_at) as day, COUNT(*) as count
               FROM users
               WHERE created_at >= ?
               GROUP BY day
               ORDER BY day""",
            (cutoff,),
        ).fetchall()

    return {
        "data": [{"date": r[0], "signups": r[1]} for r in rows],
        "period_days": days,
    }


# ─── Revenue Chart ──────────────────────────────────────────────────────────


@router.get("/revenue")
async def get_revenue_data(
    days: int = 30,
    auth: str = Depends(_require_admin),
):
    """Get daily revenue data for charting."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    with get_db_context() as db:
        # Estimate daily revenue from active subscriptions
        rows = db.execute(
            """SELECT DATE(subscription_started) as day,
                      COUNT(CASE WHEN subscription_plan LIKE 'personal%' THEN 1 END) * 1500 +
                      COUNT(CASE WHEN subscription_plan LIKE 'family%' THEN 1 END) * 3000 as revenue
               FROM users
               WHERE subscription_status = 'active'
                 AND subscription_started >= ?
               GROUP BY day
               ORDER BY day""",
            (cutoff,),
        ).fetchall()

    return {
        "data": [{"date": r[0], "revenue_naira": r[1]} for r in rows],
        "period_days": days,
    }


# ─── System Health ──────────────────────────────────────────────────────────


@router.get("/health")
async def get_system_health(auth: str = Depends(_require_admin)):
    """Get system health metrics."""
    with get_db_context() as db:
        # Error count (last 24h)
        errors_24h = db.execute(
            "SELECT COUNT(*) FROM error_logs WHERE created_at >= ?",
            ((datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(),),
        ).fetchone()[0]

        # Active WebSocket connections (approximate)
        # This would need to be tracked in memory in production

        # Database size
        db_size = db.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()").fetchone()[0]

        # Recent alerts
        alerts_1h = db.execute(
            "SELECT COUNT(*) FROM alerts WHERE created_at >= ?",
            ((datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),),
        ).fetchone()[0]

    return {
        "errors_24h": errors_24h,
        "alerts_1h": alerts_1h,
        "database_size_mb": round(db_size / 1024 / 1024, 2),
        "status": "healthy" if errors_24h < 100 else "degraded",
    }


# ─── User List ──────────────────────────────────────────────────────────────


@router.get("/users")
async def list_users(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    auth: str = Depends(_require_admin),
):
    """List users with pagination and search."""
    offset = (page - 1) * limit

    with get_db_context() as db:
        if search:
            users = db.execute(
                """SELECT id, email, display_name, subscription_plan, subscription_status,
                          created_at, last_login
                   FROM users
                   WHERE email LIKE ? OR display_name LIKE ?
                   ORDER BY created_at DESC
                   LIMIT ? OFFSET ?""",
                (f"%{search}%", f"%{search}%", limit, offset),
            ).fetchall()
            total = db.execute(
                "SELECT COUNT(*) FROM users WHERE email LIKE ? OR display_name LIKE ?",
                (f"%{search}%", f"%{search}%"),
            ).fetchone()[0]
        else:
            users = db.execute(
                """SELECT id, email, display_name, subscription_plan, subscription_status,
                          created_at, last_login
                   FROM users
                   ORDER BY created_at DESC
                   LIMIT ? OFFSET ?""",
                (limit, offset),
            ).fetchall()
            total = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    return {
        "users": [
            {
                "id": r[0],
                "email": r[1],
                "display_name": r[2],
                "subscription_plan": r[3] or "free",
                "subscription_status": r[4] or "inactive",
                "created_at": r[5],
                "last_login": r[6],
            }
            for r in users
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ─── Device List ────────────────────────────────────────────────────────────


@router.get("/devices")
async def list_devices(
    page: int = 1,
    limit: int = 50,
    status: Optional[str] = None,
    auth: str = Depends(_require_admin),
):
    """List devices with pagination and status filter."""
    offset = (page - 1) * limit

    with get_db_context() as db:
        if status == "stolen":
            devices = db.execute(
                """SELECT d.id, d.name, d.owner_id, d.is_stolen, d.sentinel_score,
                          d.last_seen, d.registered, u.email as owner_email
                   FROM devices d
                   LEFT JOIN users u ON d.owner_id = u.id
                   WHERE d.is_stolen = 1
                   ORDER BY d.last_seen DESC
                   LIMIT ? OFFSET ?""",
                (limit, offset),
            ).fetchall()
            total = db.execute("SELECT COUNT(*) FROM devices WHERE is_stolen = 1").fetchone()[0]
        else:
            devices = db.execute(
                """SELECT d.id, d.name, d.owner_id, d.is_stolen, d.sentinel_score,
                          d.last_seen, d.registered, u.email as owner_email
                   FROM devices d
                   LEFT JOIN users u ON d.owner_id = u.id
                   ORDER BY d.last_seen DESC
                   LIMIT ? OFFSET ?""",
                (limit, offset),
            ).fetchall()
            total = db.execute("SELECT COUNT(*) FROM devices").fetchone()[0]

    return {
        "devices": [
            {
                "id": r[0],
                "name": r[1],
                "owner_id": r[2],
                "is_stolen": bool(r[3]),
                "sentinel_score": r[4],
                "last_seen": r[5],
                "registered": r[6],
                "owner_email": r[7],
            }
            for r in devices
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }
