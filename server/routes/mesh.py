"""
Magneetar BLE Mesh — Offline Device Finding.

When a phone is stolen and goes offline, other Magneetar phones nearby
can detect its BLE beacon and report the sighting to the server. The
owner sees the location on their dashboard even though the stolen phone
has no internet.

How it works:
1. Stolen phone broadcasts a BLE beacon (its device_id + encrypted token)
2. Nearby Magneetar phones detect the beacon
3. They report the sighting to this endpoint
4. Owner sees the sighting on their dashboard

Privacy:
- Beacons are only active when the owner requests recovery
- Sighting reports contain only the finder's device_id and approximate location
- The stolen device's exact identity is hidden from finders
"""

from datetime import datetime, timezone
from typing import Optional

from auth import get_current_device_or_key
from database import get_db
from fastapi import APIRouter, Depends, HTTPException
from logging_config import get_logger
from pydantic import BaseModel
from websocket_manager import broadcast_to_dashboards

logger = get_logger("magneetar")
router = APIRouter()


# ─── Beacon Registration ────────────────────────────────────────────────────


class BeaconRegistration(BaseModel):
    device_id: str
    beacon_token: str  # Short-lived token proving recovery is active
    active: bool = True


@router.post("/api/mesh/beacon/register")
async def register_beacon(
    reg: BeaconRegistration,
    device_id: str = Depends(get_current_device_or_key),
):
    """Register a device as a BLE beacon for recovery.

    Called by the stolen device when recovery is activated.
    The beacon_token is a short-lived, rotating token that proves
    the owner requested recovery — finders validate this before
    reporting sightings.
    """
    if reg.device_id != device_id:
        raise HTTPException(status_code=403, detail="Device ID mismatch")

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    # Upsert beacon registration
    existing = db.execute("SELECT id FROM mesh_beacons WHERE device_id=?", (device_id,)).fetchone()

    if existing:
        db.execute(
            "UPDATE mesh_beacons SET beacon_token=?, active=?, updated_at=? WHERE device_id=?",
            (reg.beacon_token, reg.active, now, device_id),
        )
    else:
        db.execute(
            "INSERT INTO mesh_beacons (device_id, beacon_token, active, registered_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (device_id, reg.beacon_token, reg.active, now, now),
        )

    db.commit()
    return {"status": "ok", "device_id": device_id, "active": reg.active}


@router.post("/api/mesh/beacon/deactivate")
async def deactivate_beacon(
    device_id: str = Depends(get_current_device_or_key),
):
    """Deactivate BLE beacon (recovery complete or cancelled)."""
    db = get_db()
    db.execute(
        "UPDATE mesh_beacons SET active=0, updated_at=? WHERE device_id=?",
        (datetime.now(timezone.utc).isoformat(), device_id),
    )
    db.commit()
    return {"status": "ok"}


# ─── Sighting Reports ───────────────────────────────────────────────────────


class SightingReport(BaseModel):
    beacon_device_id: str  # The stolen device we detected
    beacon_token: str  # Must match the registered token
    lat: float
    lng: float
    accuracy: Optional[float] = None  # Horizontal accuracy in meters
    rssi: Optional[int] = None  # BLE signal strength


@router.post("/api/mesh/sighting")
async def report_sighting(
    report: SightingReport,
    finder_device_id: str = Depends(get_current_device_or_key),
):
    """Report a BLE sighting of a stolen device.

    Called by finder phones when they detect a beacon.
    Validates the beacon_token to prevent false reports.
    """
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    # Validate beacon exists and is active
    beacon = db.execute(
        "SELECT device_id, beacon_token FROM mesh_beacons " "WHERE device_id=? AND active=1",
        (report.beacon_device_id,),
    ).fetchone()

    if not beacon:
        raise HTTPException(status_code=404, detail="No active beacon for this device")

    if beacon["beacon_token"] != report.beacon_token:
        raise HTTPException(status_code=403, detail="Invalid beacon token")

    # Don't let a device report itself
    if finder_device_id == report.beacon_device_id:
        raise HTTPException(status_code=400, detail="Cannot report own device")

    # Rate limit: max 1 sighting per finder per beacon per 5 minutes
    recent = db.execute(
        "SELECT 1 FROM mesh_sightings "
        "WHERE beacon_device_id=? AND finder_device_id=? "
        "AND datetime(reported_at) > datetime('now', '-5 minutes') LIMIT 1",
        (report.beacon_device_id, finder_device_id),
    ).fetchone()

    if recent:
        return {"status": "ok", "message": "Sighting already reported recently"}

    # Store sighting
    db.execute(
        "INSERT INTO mesh_sightings "
        "(beacon_device_id, finder_device_id, lat, lng, accuracy, rssi, reported_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            report.beacon_device_id,
            finder_device_id,
            report.lat,
            report.lng,
            report.accuracy,
            report.rssi,
            now,
        ),
    )

    # Update device location with the sighting (approximate, from finder)
    db.execute(
        "UPDATE devices SET last_seen=?, last_lat=?, last_lng=? WHERE id=?",
        (now, report.lat, report.lng, report.beacon_device_id),
    )

    db.commit()

    # Notify the owner via WebSocket
    await broadcast_to_dashboards(
        {
            "type": "mesh_sighting",
            "data": {
                "device_id": report.beacon_device_id,
                "lat": report.lat,
                "lng": report.lng,
                "finder": finder_device_id,
                "timestamp": now,
            },
        }
    )

    logger.info(
        "BLE sighting reported",
        extra={
            "extra_data": {
                "beacon": report.beacon_device_id,
                "finder": finder_device_id,
                "lat": report.lat,
                "lng": report.lng,
            }
        },
    )

    return {"status": "ok", "message": "Sighting recorded"}


# ─── Sighting Query (for dashboard) ─────────────────────────────────────────


@router.get("/api/mesh/sightings/{device_id}")
async def get_sightings(
    device_id: str,
    limit: int = 20,
    user_id: str = Depends(get_current_device_or_key),
):
    """Get recent BLE sightings for a device (owner only)."""
    db = get_db()

    # Verify ownership
    device = db.execute("SELECT owner_id FROM devices WHERE id=?", (device_id,)).fetchone()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device["owner_id"] and device["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your device")

    sightings = db.execute(
        "SELECT lat, lng, accuracy, rssi, finder_device_id, reported_at "
        "FROM mesh_sightings WHERE beacon_device_id=? "
        "ORDER BY reported_at DESC LIMIT ?",
        (device_id, limit),
    ).fetchall()

    return {
        "device_id": device_id,
        "sightings": [dict(s) for s in sightings],
    }
