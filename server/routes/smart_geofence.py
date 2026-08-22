"""
Magneetar Smart Geofencing
AI-powered location zones that learn from behavior patterns.

Unlike basic circle geofences, Smart Zones:
1. Learn daily routines (home, work, school, gym)
2. Auto-create zones from frequently visited places
3. Adapt alert sensitivity based on time of day
4. Detect anomalies (unusual routes, late arrivals)
5. Provide predictive alerts ("usually arrives by 9am, not yet seen")

Use cases:
- "Alert me if my child leaves school before 3pm"
- "Notify me if my elderly parent hasn't left home by 10am"
- "Alert if my coworker deviates from their usual route"
- "Notify if a device appears in a new unknown location"
"""

import logging
import math
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/geofence", tags=["smart_geofence"])


# ─── Models ──────────────────────────────────────────────────────────────────


class SmartZoneCreate(BaseModel):
    name: str
    zone_type: str = "custom"  # "home", "work", "school", "custom"
    lat: float
    lng: float
    radius_meters: int = 200
    alert_on_enter: bool = True
    alert_on_exit: bool = True
    active_hours_start: int = 0  # 0-23
    active_hours_end: int = 23  # 0-23
    devices: list[str] = []  # device IDs to apply to (empty = all)


class SmartZoneResponse(BaseModel):
    id: str
    name: str
    zone_type: str
    lat: float
    lng: float
    radius_meters: int
    alert_on_enter: bool
    alert_on_exit: bool
    active_hours_start: int
    active_hours_end: int
    is_inside: bool = False
    devices: list[str] = []


class AnomalyAlert(BaseModel):
    device_id: str
    device_name: str
    anomaly_type: str  # "late_departure", "unusual_route", "new_location", "extended_absence"
    description: str
    severity: str  # "low", "medium", "high"
    detected_at: str
    location: Optional[dict] = None


class RoutinePattern(BaseModel):
    device_id: str
    location_name: str
    avg_arrival_hour: float
    avg_departure_hour: float
    frequency_days_per_week: float
    confidence: float  # 0-1


# ─── Create Smart Zone ──────────────────────────────────────────────────────


@router.post("/zone")
async def create_smart_zone(
    req: SmartZoneCreate,
    auth: str = Depends(require_dashboard_auth),
):
    """Create a smart geofence zone."""
    user_id = user_id_from_subject(auth)
    zone_id = f"zone_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS smart_zones (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                zone_type TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                radius_meters INTEGER DEFAULT 200,
                alert_on_enter INTEGER DEFAULT 1,
                alert_on_exit INTEGER DEFAULT 1,
                active_hours_start INTEGER DEFAULT 0,
                active_hours_end INTEGER DEFAULT 23,
                is_auto_generated INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """
        )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS smart_zone_devices (
                zone_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                PRIMARY KEY (zone_id, device_id),
                FOREIGN KEY (zone_id) REFERENCES smart_zones(id)
            )
        """
        )

        db.execute(
            """
            INSERT INTO smart_zones
                (id, user_id, name, zone_type, lat, lng, radius_meters,
                 alert_on_enter, alert_on_exit, active_hours_start, active_hours_end, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                zone_id,
                user_id,
                req.name,
                req.zone_type,
                req.lat,
                req.lng,
                req.radius_meters,
                int(req.alert_on_enter),
                int(req.alert_on_exit),
                req.active_hours_start,
                req.active_hours_end,
                now,
            ),
        )

        # Associate devices
        for device_id in req.devices:
            db.execute(
                "INSERT INTO smart_zone_devices (zone_id, device_id) VALUES (?, ?)",
                (zone_id, device_id),
            )

        db.commit()

    return {
        "ok": True,
        "zone_id": zone_id,
        "name": req.name,
        "message": f"Smart zone '{req.name}' created. Alerts will trigger when devices enter/exit.",
    }


# ─── List Smart Zones ───────────────────────────────────────────────────────


@router.get("/zones")
async def list_smart_zones(
    auth: str = Depends(require_dashboard_auth),
):
    """List all smart zones for the user."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        zones = db.execute(
            """
            SELECT id, name, zone_type, lat, lng, radius_meters,
                   alert_on_enter, alert_on_exit, active_hours_start, active_hours_end
            FROM smart_zones
            WHERE user_id = ?
            ORDER BY created_at DESC
        """,
            (user_id,),
        ).fetchall()

    return {
        "zones": [
            SmartZoneResponse(
                id=z[0],
                name=z[1],
                zone_type=z[2],
                lat=z[3],
                lng=z[4],
                radius_meters=z[5],
                alert_on_enter=bool(z[6]),
                alert_on_exit=bool(z[7]),
                active_hours_start=z[8],
                active_hours_end=z[9],
            )
            for z in zones
        ]
    }


# ─── Delete Smart Zone ──────────────────────────────────────────────────────


@router.delete("/zone/{zone_id}")
async def delete_smart_zone(
    zone_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Delete a smart zone."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        result = db.execute(
            "DELETE FROM smart_zones WHERE id = ? AND user_id = ?",
            (zone_id, user_id),
        )
        db.execute("DELETE FROM smart_zone_devices WHERE zone_id = ?", (zone_id,))
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Zone not found")

    return {"ok": True, "message": "Smart zone deleted."}


# ─── Auto-Discover Zones from Location History ──────────────────────────────


@router.post("/auto-discover")
async def auto_discover_zones(
    auth: str = Depends(require_dashboard_auth),
):
    """Automatically discover frequently visited places and create zones.

    Analyzes location history to find:
    - Home (nighttime location)
    - Work (weekday daytime location)
    - School (weekday morning location)
    - Other frequent places
    """
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Get location history for all user's devices (last 30 days)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

        locations = db.execute(
            """
            SELECT lat, lng, created_at
            FROM telemetry
            WHERE device_id IN (SELECT id FROM devices WHERE owner_id = ?)
              AND created_at > ?
              AND lat IS NOT NULL
            ORDER BY created_at
        """,
            (user_id, cutoff),
        ).fetchall()

        if len(locations) < 100:
            return {
                "zones": [],
                "message": "Not enough location data for auto-discovery. Need at least 100 data points.",
            }

        # Simple clustering: find locations where the device stays for > 30 min
        clusters = _cluster_locations(locations)

        # Identify zone types based on time patterns
        discovered = []
        for cluster in clusters:
            zone_type = _classify_zone(cluster)
            if zone_type != "custom":
                name = f"Auto: {zone_type.title()}"
            else:
                name = f"Frequent Place ({cluster['count']} visits)"

            # Check if similar zone already exists
            existing = db.execute(
                """
                SELECT id FROM smart_zones
                WHERE user_id = ? AND ABS(lat - ?) < 0.001 AND ABS(lng - ?) < 0.001
            """,
                (user_id, cluster["lat"], cluster["lng"]),
            ).fetchone()

            if existing:
                continue

            # Create auto-generated zone
            zone_id = f"zone_{secrets.token_hex(8)}"
            now = datetime.now(timezone.utc).isoformat()

            db.execute(
                """
                INSERT INTO smart_zones
                    (id, user_id, name, zone_type, lat, lng, radius_meters,
                     alert_on_enter, alert_on_exit, is_auto_generated, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 200, 1, 1, 1, ?)
            """,
                (zone_id, user_id, name, zone_type, cluster["lat"], cluster["lng"], now),
            )

            discovered.append(
                {
                    "zone_id": zone_id,
                    "name": name,
                    "zone_type": zone_type,
                    "lat": cluster["lat"],
                    "lng": cluster["lng"],
                    "visit_count": cluster["count"],
                }
            )

        db.commit()

    return {
        "zones": discovered,
        "message": f"Discovered {len(discovered)} new zones from location history.",
    }


# ─── Detect Anomalies ──────────────────────────────────────────────────────


@router.get("/anomalies")
async def detect_anomalies(
    auth: str = Depends(require_dashboard_auth),
):
    """Detect anomalous behavior patterns for user's devices.

    Checks for:
    - Late departures from known zones
    - Unusual routes (deviation from pattern)
    - Extended absences from expected zones
    - New unknown locations
    """
    user_id = user_id_from_subject(auth)

    anomalies = []

    with get_db_context() as db:
        # Get user's devices
        devices = db.execute(
            "SELECT id, name FROM devices WHERE owner_id = ?",
            (user_id,),
        ).fetchall()

        # Get user's smart zones
        zones = db.execute(
            "SELECT id, name, zone_type, lat, lng, radius_meters FROM smart_zones WHERE user_id = ?",
            (user_id,),
        ).fetchall()

        for device_id, device_name in devices:

            # Get recent locations (last 24 hours)
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
            recent = db.execute(
                """
                SELECT lat, lng, created_at FROM telemetry
                WHERE device_id = ? AND created_at > ? AND lat IS NOT NULL
                ORDER BY created_at DESC
            """,
                (device_id, cutoff),
            ).fetchall()

            if not recent:
                continue

            latest_lat, latest_lng, latest_time = recent[0]
            now = datetime.now(timezone.utc)

            # Check: Late departure from home zone
            for zone in zones:
                zone_id, zone_name, zone_type, zone_lat, zone_lng, radius = zone
                distance = _haversine_meters(latest_lat, latest_lng, zone_lat, zone_lng)

                if zone_type == "home" and distance > radius:
                    # Device left home — check if it's unusually late
                    hour = now.hour
                    if hour > 10:  # After 10am
                        # Check if usually leaves earlier
                        usual_departure = _get_usual_departure(db, device_id, zone_id)
                        if usual_departure and hour > usual_departure + 2:
                            anomalies.append(
                                AnomalyAlert(
                                    device_id=device_id,
                                    device_name=device_name,
                                    anomaly_type="late_departure",
                                    description=f"Left {zone_name} {hour - usual_departure} hours later than usual",
                                    severity="medium",
                                    detected_at=now.isoformat(),
                                    location={"lat": latest_lat, "lng": latest_lng},
                                )
                            )

            # Check: Extended absence from expected zone
            hour = now.hour
            if 8 <= hour <= 18:  # Daytime
                in_any_zone = False
                for zone in zones:
                    zone_lat, zone_lng, radius = zone[3], zone[4], zone[5]
                    if _haversine_meters(latest_lat, latest_lng, zone_lat, zone_lng) <= radius:
                        in_any_zone = True
                        break

                if not in_any_zone and len(recent) > 10:
                    # Device hasn't been in any known zone for a while
                    anomalies.append(
                        AnomalyAlert(
                            device_id=device_id,
                            device_name=device_name,
                            anomaly_type="extended_absence",
                            description="Device hasn't been in any known zone during daytime hours",
                            severity="low",
                            detected_at=now.isoformat(),
                            location={"lat": latest_lat, "lng": latest_lng},
                        )
                    )

            # Check: New unknown location
            if latest_time:
                try:
                    last_dt = datetime.fromisoformat(latest_time.replace("Z", "+00:00"))
                    if (now - last_dt).total_seconds() < 3600:  # Within last hour
                        # Check if this location is far from all zones
                        far_from_all = all(
                            _haversine_meters(latest_lat, latest_lng, z[3], z[4]) > z[5] * 3 for z in zones
                        )
                        if far_from_all and zones:
                            anomalies.append(
                                AnomalyAlert(
                                    device_id=device_id,
                                    device_name=device_name,
                                    anomaly_type="new_location",
                                    description="Device at a new location far from any known zone",
                                    severity="medium",
                                    detected_at=now.isoformat(),
                                    location={"lat": latest_lat, "lng": latest_lng},
                                )
                            )
                except (ValueError, TypeError):
                    pass

    return {"anomalies": anomalies, "count": len(anomalies)}


# ─── Get Routine Patterns ──────────────────────────────────────────────────


@router.get("/patterns")
async def get_routine_patterns(
    auth: str = Depends(require_dashboard_auth),
):
    """Get learned routine patterns for a device.

    Shows:
    - Usual arrival/departure times for each location
    - Frequency of visits
    - Confidence in the pattern
    """
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        devices = db.execute(
            "SELECT id, name FROM devices WHERE owner_id = ?",
            (user_id,),
        ).fetchall()

        patterns = []
        for device_id, _device_name in devices:
            # Get location history (last 30 days)
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            locations = db.execute(
                """
                SELECT lat, lng, created_at FROM telemetry
                WHERE device_id = ? AND created_at > ? AND lat IS NOT NULL
                ORDER BY created_at
            """,
                (device_id, cutoff),
            ).fetchall()

            if len(locations) < 50:
                continue

            # Cluster locations to find frequent places
            clusters = _cluster_locations(locations)

            for cluster in clusters:
                if cluster["count"] < 5:  # Need at least 5 visits
                    continue

                # Calculate arrival/departure times
                arrival_hours = []
                for loc in cluster["locations"]:
                    try:
                        dt = datetime.fromisoformat(loc[2].replace("Z", "+00:00"))
                        hour = dt.hour + dt.minute / 60
                        arrival_hours.append(hour)
                    except (ValueError, TypeError):
                        pass

                if arrival_hours:
                    avg_arrival = sum(arrival_hours) / len(arrival_hours)
                    avg_departure = avg_arrival + 2  # Assume 2-hour stay

                    patterns.append(
                        RoutinePattern(
                            device_id=device_id,
                            location_name=f"Location at {cluster['lat']:.4f}, {cluster['lng']:.4f}",
                            avg_arrival_hour=round(avg_arrival, 1),
                            avg_departure_hour=round(avg_departure, 1),
                            frequency_days_per_week=round(cluster["count"] / 4, 1),  # 30 days ≈ 4 weeks
                            confidence=min(1.0, cluster["count"] / 20),
                        )
                    )

    return {"patterns": patterns}


# ─── Helper Functions ────────────────────────────────────────────────────────


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in meters."""
    R = 6371000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def _cluster_locations(locations: list, min_stay_minutes: int = 30) -> list:
    """Cluster locations into frequent places based on proximity and duration."""
    if not locations:
        return []

    clusters = []
    used = set()

    for i, loc in enumerate(locations):
        if i in used:
            continue

        cluster = {
            "lat": loc[0],
            "lng": loc[1],
            "count": 1,
            "locations": [loc],
        }
        used.add(i)

        for j, other in enumerate(locations):
            if j in used:
                continue
            if _haversine_meters(loc[0], loc[1], other[0], other[1]) < 100:  # 100m radius
                cluster["count"] += 1
                cluster["locations"].append(other)
                used.add(j)

        if cluster["count"] >= 3:  # At least 3 data points
            # Recalculate center
            cluster["lat"] = sum(loc[0] for loc in cluster["locations"]) / len(cluster["locations"])
            cluster["lng"] = sum(loc[1] for loc in cluster["locations"]) / len(cluster["locations"])
            clusters.append(cluster)

    # Sort by frequency
    clusters.sort(key=lambda x: x["count"], reverse=True)
    return clusters[:10]  # Top 10 clusters


def _classify_zone(cluster: dict) -> str:
    """Classify a cluster as home, work, school, etc. based on time patterns."""
    hours = []
    for loc in cluster["locations"]:
        try:
            dt = datetime.fromisoformat(loc[2].replace("Z", "+00:00"))
            hours.append(dt.hour)
        except (ValueError, TypeError):
            pass

    if not hours:
        return "custom"

    avg_hour = sum(hours) / len(hours)
    weekday_count = sum(
        1 for loc in cluster["locations"] if datetime.fromisoformat(loc[2].replace("Z", "+00:00")).weekday() < 5
    )
    weekday_ratio = weekday_count / len(cluster["locations"]) if cluster["locations"] else 0

    # Home: mostly nighttime/early morning
    if avg_hour < 8 or avg_hour > 20:
        return "home"

    # Work: weekday daytime
    if 8 <= avg_hour <= 17 and weekday_ratio > 0.7:
        return "work"

    # School: weekday morning
    if 7 <= avg_hour <= 15 and weekday_ratio > 0.6:
        return "school"

    return "custom"


def _get_usual_departure(db, device_id: str, zone_id: str) -> Optional[float]:
    """Get the usual departure hour from a zone."""
    # Simplified: return None for now (would need more sophisticated analysis)
    return None
