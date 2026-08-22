"""
Magneetar Family Safety Circles
Real-time location sharing with family members.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/family", tags=["family"])


# ─── Models ──────────────────────────────────────────────────────────────────


class CircleInviteRequest(BaseModel):
    email: str
    role: str = "member"  # "member" or "admin"


class CircleMemberResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    joined_at: str
    last_seen: Optional[str] = None
    location: Optional[dict] = None
    battery_percent: Optional[int] = None
    is_online: bool = False


class CircleStatusResponse(BaseModel):
    circle_id: str
    circle_name: str
    member_count: int
    members: list[CircleMemberResponse]


class LocationShareRequest(BaseModel):
    lat: float
    lng: float
    battery_percent: Optional[int] = None
    accuracy: Optional[float] = None


# ─── Get Circle ──────────────────────────────────────────────────────────────


@router.get("/circle", response_model=CircleStatusResponse)
async def get_circle(auth: str = Depends(require_dashboard_auth)):
    """Get the user's family circle with all members and their locations."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Get user's circle
        circle = db.execute(
            "SELECT id, name FROM family_circles WHERE owner_id = ?",
            (user_id,),
        ).fetchone()

        if not circle:
            # Auto-create a circle for new users
            import secrets

            circle_id = f"circle_{secrets.token_hex(8)}"
            db.execute(
                "INSERT INTO family_circles (id, owner_id, name, created_at) VALUES (?, ?, ?, ?)",
                (circle_id, user_id, "My Family", datetime.now(timezone.utc).isoformat()),
            )
            # Add owner as admin member
            db.execute(
                "INSERT INTO family_members (circle_id, user_id, role, joined_at) VALUES (?, ?, 'admin', ?)",
                (circle_id, user_id, datetime.now(timezone.utc).isoformat()),
            )
            db.commit()
            circle = (circle_id, "My Family")

        circle_id, circle_name = circle

        # Get members with their latest location
        members = db.execute(
            """
            SELECT fm.user_id, fm.role, fm.joined_at,
                   u.name, u.email,
                   dl.lat, dl.lng, dl.battery_percent, dl.timestamp as last_seen
            FROM family_members fm
            JOIN users u ON fm.user_id = u.id
            LEFT JOIN device_locations dl ON dl.device_id = (
                SELECT id FROM devices WHERE owner_id = fm.user_id ORDER BY timestamp DESC LIMIT 1
            )
            WHERE fm.circle_id = ?
            """,
            (circle_id,),
        ).fetchall()

    member_list = []
    for m in members:
        now = datetime.now(timezone.utc)
        last_seen = m[8]
        is_online = False
        if last_seen:
            try:
                last_dt = datetime.fromisoformat(last_seen)
                is_online = (now - last_dt).total_seconds() < 300  # 5 min threshold
            except (ValueError, TypeError):
                pass

        member_list.append(
            CircleMemberResponse(
                user_id=m[0],
                name=m[3] or "Unknown",
                email=m[4] or "",
                role=m[1],
                joined_at=m[2],
                last_seen=last_seen,
                location={"lat": m[5], "lng": m[6]} if m[5] is not None else None,
                battery_percent=m[7],
                is_online=is_online,
            )
        )

    return CircleStatusResponse(
        circle_id=circle_id,
        circle_name=circle_name,
        member_count=len(member_list),
        members=member_list,
    )


# ─── Invite Member ──────────────────────────────────────────────────────────


@router.post("/invite")
async def invite_member(
    req: CircleInviteRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Invite a user to your family circle by email."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Get user's circle
        circle = db.execute(
            "SELECT id FROM family_circles WHERE owner_id = ?",
            (user_id,),
        ).fetchone()

        if not circle:
            raise HTTPException(status_code=404, detail="No family circle found")

        circle_id = circle[0]

        # Check tier limits
        user_row = db.execute(
            "SELECT subscription_plan, subscription_status FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        from payments import get_tier_limits, get_user_tier

        tier = get_user_tier(
            {
                "subscription_plan": user_row[0] if user_row else "free",
                "subscription_status": user_row[1] if user_row else "inactive",
            }
        )
        limits = get_tier_limits(tier)

        # Check member count
        member_count = db.execute(
            "SELECT COUNT(*) FROM family_members WHERE circle_id = ?",
            (circle_id,),
        ).fetchone()[0]

        max_members = limits["family_circle_members"]
        if max_members == 0:
            raise HTTPException(
                status_code=403,
                detail="Family circles require a Personal or Family subscription",
            )
        if max_members > 0 and member_count >= max_members:
            raise HTTPException(
                status_code=403,
                detail=f"Your {tier} plan allows {max_members} family members",
            )

        # Find the invited user
        invitee = db.execute(
            "SELECT id, name FROM users WHERE email = ?",
            (req.email,),
        ).fetchone()

        if not invitee:
            raise HTTPException(
                status_code=404,
                detail="User not found. They need to create a Magneetar account first.",
            )

        invitee_id = invitee[0]

        # Check if already a member
        existing = db.execute(
            "SELECT id FROM family_members WHERE circle_id = ? AND user_id = ?",
            (circle_id, invitee_id),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="User is already in your circle")

        # Add member
        db.execute(
            "INSERT INTO family_members (circle_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
            (circle_id, invitee_id, req.role, datetime.now(timezone.utc).isoformat()),
        )
        db.commit()

    return {"ok": True, "message": f"Added {invitee[1]} to your family circle"}


# ─── Remove Member ──────────────────────────────────────────────────────────


@router.delete("/member/{member_id}")
async def remove_member(
    member_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Remove a member from your family circle."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        circle = db.execute(
            "SELECT id FROM family_circles WHERE owner_id = ?",
            (user_id,),
        ).fetchone()

        if not circle:
            raise HTTPException(status_code=404, detail="No family circle found")

        db.execute(
            "DELETE FROM family_members WHERE circle_id = ? AND user_id = ?",
            (circle[0], member_id),
        )
        db.commit()

    return {"ok": True, "message": "Member removed from circle"}


# ─── Share Location (for family members) ────────────────────────────────────


@router.post("/location")
async def share_location(
    req: LocationShareRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Share location with family circle members.

    This is called by the Android app to update the family's view.
    """
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Get user's primary device
        device = db.execute(
            "SELECT id FROM devices WHERE owner_id = ? ORDER BY last_seen DESC LIMIT 1",
            (user_id,),
        ).fetchone()

        if not device:
            raise HTTPException(status_code=404, detail="No device registered")

        device_id = device[0]
        now = datetime.now(timezone.utc)

        # Insert location
        db.execute(
            """
            INSERT INTO device_locations (device_id, lat, lng, battery_percent, accuracy, timestamp, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (device_id, req.lat, req.lng, req.battery_percent, req.accuracy, now.isoformat(), now.isoformat()),
        )
        db.commit()

    return {"ok": True}


# ─── Get Member Locations (for family view) ─────────────────────────────────


@router.get("/locations")
async def get_family_locations(auth: str = Depends(require_dashboard_auth)):
    """Get real-time locations of all family circle members."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        circle = db.execute(
            "SELECT id FROM family_circles WHERE owner_id = ?",
            (user_id,),
        ).fetchone()

        if not circle:
            return {"members": []}

        members = db.execute(
            """
            SELECT fm.user_id, u.name,
                   dl.lat, dl.lng, dl.battery_percent, dl.timestamp,
                   d.name as device_name
            FROM family_members fm
            JOIN users u ON fm.user_id = u.id
            LEFT JOIN devices d ON d.owner_id = fm.user_id
            LEFT JOIN device_locations dl ON dl.device_id = d.id
                AND dl.timestamp = (
                    SELECT MAX(timestamp) FROM device_locations WHERE device_id = d.id
                )
            WHERE fm.circle_id = ?
            """,
            (circle[0],),
        ).fetchall()

    result = []
    for m in members:
        now = datetime.now(timezone.utc)
        last_seen = m[5]
        is_online = False
        if last_seen:
            try:
                last_dt = datetime.fromisoformat(last_seen)
                is_online = (now - last_dt).total_seconds() < 300
            except (ValueError, TypeError):
                pass

        result.append(
            {
                "user_id": m[0],
                "name": m[1],
                "location": {"lat": m[2], "lng": m[3]} if m[2] is not None else None,
                "battery_percent": m[4],
                "last_seen": last_seen,
                "is_online": is_online,
                "device_name": m[6],
            }
        )

    return {"members": result}
