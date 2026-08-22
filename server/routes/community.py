"""
Magneetar Community Watch Map
Crowdsourced theft hotspot map — like Waze for phone safety.

Users can:
- Report theft incidents (time, location, method)
- View theft heatmap
- Get safe route suggestions
- See real-time theft alerts nearby
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/community", tags=["community"])


# ─── Models ──────────────────────────────────────────────────────────────────


class TheftReportRequest(BaseModel):
    lat: float
    lng: float
    method: str  # "snatch", "armed", "pickpocket", "home", "vehicle", "other"
    time_of_day: str = "auto"  # "morning", "afternoon", "evening", "night", "auto"
    device_type: str = "phone"
    notes: Optional[str] = None


class TheftReportResponse(BaseModel):
    report_id: str
    status: str


class Hotspot(BaseModel):
    lat: float
    lng: float
    intensity: float  # 0.0 - 1.0
    count: int
    methods: list[str]
    risk_level: str  # "low", "medium", "high", "critical"


class SafeRouteRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float


# ─── Report Theft ───────────────────────────────────────────────────────────


@router.post("/report", response_model=TheftReportResponse)
async def report_theft(
    req: TheftReportRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Report a theft incident to the community watch map."""
    user_id = user_id_from_subject(auth)

    # Determine time of day
    if req.time_of_day == "auto":
        hour = datetime.now(timezone.utc).hour
        if 6 <= hour < 12:
            time_of_day = "morning"
        elif 12 <= hour < 17:
            time_of_day = "afternoon"
        elif 17 <= hour < 21:
            time_of_day = "evening"
        else:
            time_of_day = "night"
    else:
        time_of_day = req.time_of_day

    report_id = f"rpt_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
        # Create table if not exists
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS theft_reports (
                id TEXT PRIMARY KEY,
                reporter_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                method TEXT NOT NULL,
                time_of_day TEXT NOT NULL,
                device_type TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL,
                verified INTEGER DEFAULT 0,
                FOREIGN KEY (reporter_id) REFERENCES users(id)
            )
        """
        )

        db.execute(
            """INSERT INTO theft_reports (id, reporter_id, lat, lng, method, time_of_day, device_type, notes, created_at)  # noqa: E501
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (report_id, user_id, req.lat, req.lng, req.method, time_of_day, req.device_type, req.notes, now),
        )
        db.commit()

    return TheftReportResponse(report_id=report_id, status="reported")


# ─── Get Heatmap Data ──────────────────────────────────────────────────────


@router.get("/heatmap")
async def get_heatmap(
    lat: float = 6.5244,
    lng: float = 3.3792,
    radius_km: float = 10.0,
    days: int = 30,
    auth: str = Depends(require_dashboard_auth),
):
    """Get theft heatmap data for a region.

    Returns clustered hotspots with intensity scores.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    with get_db_context() as db:
        # Simple grid-based clustering
        # Divide the area into 100m x 100m cells
        cell_size = 0.001  # ~100m at equator

        reports = db.execute(
            """
            SELECT lat, lng, method, time_of_day, created_at
            FROM theft_reports
            WHERE created_at > ?
              AND lat BETWEEN ? AND ?
              AND lng BETWEEN ? AND ?
            """,
            (
                cutoff,
                lat - (radius_km / 111.0),
                lat + (radius_km / 111.0),
                lng - (radius_km / 111.0),
                lng + (radius_km / 111.0),
            ),
        ).fetchall()

    # Cluster into grid cells
    cells: dict = {}
    for r in reports:
        cell_lat = round(r[0] / cell_size) * cell_size
        cell_lng = round(r[1] / cell_size) * cell_size
        key = f"{cell_lat:.4f},{cell_lng:.4f}"

        if key not in cells:
            cells[key] = {
                "lat": cell_lat,
                "lng": cell_lng,
                "count": 0,
                "methods": set(),
                "times": [],
            }
        cells[key]["count"] += 1
        cells[key]["methods"].add(r[2])
        cells[key]["times"].append(r[3])

    # Calculate intensity and risk level
    max_count = max((c["count"] for c in cells.values()), default=1)
    hotspots = []
    for _key, cell in cells.items():
        intensity = cell["count"] / max_count
        if intensity >= 0.75:
            risk_level = "critical"
        elif intensity >= 0.5:
            risk_level = "high"
        elif intensity >= 0.25:
            risk_level = "medium"
        else:
            risk_level = "low"

        hotspots.append(
            Hotspot(
                lat=cell["lat"],
                lng=cell["lng"],
                intensity=intensity,
                count=cell["count"],
                methods=sorted(cell["methods"]),
                risk_level=risk_level,
            )
        )

    return {
        "hotspots": hotspots,
        "total_reports": len(reports),
        "period_days": days,
        "radius_km": radius_km,
    }


# ─── Get Recent Reports ────────────────────────────────────────────────────


@router.get("/reports")
async def get_recent_reports(
    lat: float = 6.5244,
    lng: float = 3.3792,
    radius_km: float = 5.0,
    limit: int = 20,
    auth: str = Depends(require_dashboard_auth),
):
    """Get recent theft reports near a location."""
    with get_db_context() as db:
        reports = db.execute(
            """
            SELECT id, lat, lng, method, time_of_day, device_type, notes, created_at, verified
            FROM theft_reports
            WHERE lat BETWEEN ? AND ?
              AND lng BETWEEN ? AND ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (
                lat - (radius_km / 111.0),
                lat + (radius_km / 111.0),
                lng - (radius_km / 111.0),
                lng + (radius_km / 111.0),
                limit,
            ),
        ).fetchall()

    return {
        "reports": [
            {
                "id": r[0],
                "lat": r[1],
                "lng": r[2],
                "method": r[3],
                "time_of_day": r[4],
                "device_type": r[5],
                "notes": r[6],
                "created_at": r[7],
                "verified": bool(r[8]),
            }
            for r in reports
        ]
    }


# ─── Get Safe Route Suggestion ─────────────────────────────────────────────


@router.post("/safe-route")
async def suggest_safe_route(
    req: SafeRouteRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Get a safe route suggestion avoiding theft hotspots.

    Returns a list of waypoints that avoid high-risk areas.
    """
    with get_db_context() as db:
        # Get hotspots along the route
        mid_lat = (req.start_lat + req.end_lat) / 2
        mid_lng = (req.start_lng + req.end_lng) / 2
        route_radius = (
            max(
                abs(req.start_lat - req.end_lat),
                abs(req.start_lng - req.end_lng),
            )
            * 0.5
            + 0.01
        )

        hotspots = db.execute(
            """
            SELECT lat, lng, COUNT(*) as cnt
            FROM theft_reports
            WHERE lat BETWEEN ? AND ?
              AND lng BETWEEN ? AND ?
            GROUP BY ROUND(lat / 0.002) * 0.002, ROUND(lng / 0.002) * 0.002
            HAVING cnt >= 3
            """,
            (
                mid_lat - route_radius,
                mid_lat + route_radius,
                mid_lng - route_radius,
                mid_lng + route_radius,
            ),
        ).fetchall()

    # Simple avoidance: suggest waypoints that go around hotspots
    waypoints = [
        {"lat": req.start_lat, "lng": req.start_lng, "label": "Start"},
    ]

    for h in hotspots:
        # Push waypoint away from hotspot
        offset_lat = 0.003 if h[0] > mid_lat else -0.003
        offset_lng = 0.003 if h[1] > mid_lng else -0.003
        waypoints.append(
            {
                "lat": h[0] + offset_lat,
                "lng": h[1] + offset_lng,
                "label": "Avoid hotspot",
            }
        )

    waypoints.append({"lat": req.end_lat, "lng": req.end_lng, "label": "Destination"})

    return {
        "waypoints": waypoints,
        "hotspots_avoided": len(hotspots),
        "safety_score": max(0, 100 - len(hotspots) * 15),
    }


# ─── Get Trending Areas ────────────────────────────────────────────────────


@router.get("/trending")
async def get_trending_areas(
    days: int = 7,
    auth: str = Depends(require_dashboard_auth),
):
    """Get areas with increasing theft activity."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cutoff_previous = (datetime.now(timezone.utc) - timedelta(days=days * 2)).isoformat()

    with get_db_context() as db:
        # Current period
        current = db.execute(
            """
            SELECT ROUND(lat / 0.005) * 0.005 as grid_lat,
                   ROUND(lng / 0.005) * 0.005 as grid_lng,
                   COUNT(*) as cnt
            FROM theft_reports
            WHERE created_at > ?
            GROUP BY grid_lat, grid_lng
            """,
            (cutoff,),
        ).fetchall()

        # Previous period
        previous = db.execute(
            """
            SELECT ROUND(lat / 0.005) * 0.005 as grid_lat,
                   ROUND(lng / 0.005) * 0.005 as grid_lng,
                   COUNT(*) as cnt
            FROM theft_reports
            WHERE created_at > ? AND created_at <= ?
            GROUP BY grid_lat, grid_lng
            """,
            (cutoff_previous, cutoff),
        ).fetchall()

    # Build lookup for previous period
    prev_lookup = {(r[0], r[1]): r[2] for r in previous}

    trending = []
    for r in current:
        key = (r[0], r[1])
        prev_count = prev_lookup.get(key, 0)
        if prev_count > 0:
            change = (r[2] - prev_count) / prev_count
            if change > 0.2:  # 20%+ increase
                trending.append(
                    {
                        "lat": r[0],
                        "lng": r[1],
                        "current_count": r[2],
                        "previous_count": prev_count,
                        "change_percent": round(change * 100),
                    }
                )

    trending.sort(key=lambda x: x["change_percent"], reverse=True)

    return {"trending": trending[:10], "period_days": days}
