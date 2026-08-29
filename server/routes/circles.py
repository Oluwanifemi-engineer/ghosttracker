"""
Magneetar Circles — Group Device Sharing Routes
Circles let families and friend groups share device locations on one map.
"""

import secrets
import string

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context, log_audit
from fastapi import APIRouter, Depends, HTTPException
from logging_config import get_logger
from pydantic import BaseModel

logger = get_logger(__name__)
router = APIRouter(prefix="/api/circles", tags=["circles"])


def _generate_invite_code() -> str:
    """Generate a 6-character alphanumeric invite code (readable, no ambiguous chars)."""
    alphabet = string.ascii_uppercase.replace("O", "").replace("I", "").replace("L", "") + string.digits.replace(
        "0", ""
    ).replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(6))


class CreateCircleRequest(BaseModel):
    name: str


class JoinCircleRequest(BaseModel):
    invite_code: str


class CircleDeviceRequest(BaseModel):
    device_id: str


class UpdateMemberRequest(BaseModel):
    role: str  # admin or member


# ─── Create Circle ──────────────────────────────────────────────────────────


@router.post("")
async def create_circle(
    body: CreateCircleRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Create a new circle. The creator becomes the owner/admin."""
    owner_id = user_id_from_subject(auth)
    if not owner_id:
        raise HTTPException(status_code=403, detail="User account required")

    circle_id = secrets.token_hex(16)
    invite_code = _generate_invite_code()

    with get_db_context() as db:
        # Ensure unique invite code (extremely unlikely to collide, but be safe)
        attempts = 0
        while attempts < 10:
            existing = db.execute("SELECT id FROM circles WHERE invite_code=?", (invite_code,)).fetchone()
            if not existing:
                break
            invite_code = _generate_invite_code()
            attempts += 1

        db.execute(
            "INSERT INTO circles (id, name, owner_id, invite_code) VALUES (?, ?, ?, ?)",
            (circle_id, body.name.strip()[:50], owner_id, invite_code),
        )
        # Owner is also a member with admin role
        member_id = secrets.token_hex(16)
        db.execute(
            "INSERT INTO circle_members (id, circle_id, user_id, role) VALUES (?, ?, ?, 'admin')",
            (member_id, circle_id, owner_id),
        )
        db.commit()

    log_audit("circle_created", actor=auth, details=f"Circle: {body.name}, ID: {circle_id}")

    return {
        "circle_id": circle_id,
        "name": body.name.strip()[:50],
        "invite_code": invite_code,
        "role": "admin",
    }


# ─── Join Circle ────────────────────────────────────────────────────────────


@router.post("/join")
async def join_circle(
    body: JoinCircleRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Join an existing circle using a 6-char invite code."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    code = body.invite_code.strip().upper()

    with get_db_context() as db:
        circle = db.execute("SELECT id, name FROM circles WHERE invite_code=?", (code,)).fetchone()
        if not circle:
            raise HTTPException(status_code=404, detail="Invalid invite code")

        # Check if already a member
        existing = db.execute(
            "SELECT id FROM circle_members WHERE circle_id=? AND user_id=?",
            (circle["id"], user_id),
        ).fetchone()
        if existing:
            return {"circle_id": circle["id"], "name": circle["name"], "role": "member", "message": "Already a member"}

        member_id = secrets.token_hex(16)
        db.execute(
            "INSERT INTO circle_members (id, circle_id, user_id, role) VALUES (?, ?, ?, 'member')",
            (member_id, circle["id"], user_id),
        )
        db.commit()

    log_audit("circle_joined", actor=auth, details=f"Circle: {circle['id']}")

    return {"circle_id": circle["id"], "name": circle["name"], "role": "member"}


# ─── List My Circles ────────────────────────────────────────────────────────


@router.get("")
async def list_circles(auth: str = Depends(require_dashboard_auth)):
    """List all circles the current user belongs to."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    with get_db_context() as db:
        rows = db.execute(
            """SELECT c.id, c.name, c.invite_code, c.owner_id, c.created_at,
                      cm.role as my_role,
                      (SELECT COUNT(*) FROM circle_members WHERE circle_id=c.id) as member_count,
                      (SELECT COUNT(*) FROM circle_devices WHERE circle_id=c.id) as device_count
               FROM circles c
               JOIN circle_members cm ON cm.circle_id = c.id AND cm.user_id = ?
               ORDER BY c.created_at DESC""",
            (user_id,),
        ).fetchall()

    return {"circles": [dict(r) for r in rows]}


# ─── Get Circle Details ─────────────────────────────────────────────────────


@router.get("/{circle_id}")
async def get_circle(
    circle_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Get circle details, members, and shared devices."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    with get_db_context() as db:
        # Verify membership
        membership = db.execute(
            "SELECT role FROM circle_members WHERE circle_id=? AND user_id=?",
            (circle_id, user_id),
        ).fetchone()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this circle")

        circle = db.execute(
            "SELECT id, name, owner_id, invite_code, created_at FROM circles WHERE id=?",
            (circle_id,),
        ).fetchone()
        if not circle:
            raise HTTPException(status_code=404, detail="Circle not found")

        members = db.execute(
            """SELECT cm.user_id, cm.role, cm.joined_at, u.email, u.display_name
               FROM circle_members cm
               JOIN users u ON u.id = cm.user_id
               WHERE cm.circle_id = ?
               ORDER BY cm.joined_at ASC""",
            (circle_id,),
        ).fetchall()

        devices = db.execute(
            """SELECT cd.device_id, cd.shared_by, cd.created_at, d.alias, d.model,
                      u.display_name as shared_by_name
               FROM circle_devices cd
               JOIN devices d ON d.id = cd.device_id
               JOIN users u ON u.id = cd.shared_by
               WHERE cd.circle_id = ?
               ORDER BY cd.created_at DESC""",
            (circle_id,),
        ).fetchall()

    return {
        "circle": dict(circle),
        "my_role": membership["role"],
        "members": [dict(m) for m in members],
        "devices": [dict(d) for d in devices],
    }


# ─── Share Device with Circle ───────────────────────────────────────────────


@router.post("/{circle_id}/devices")
async def share_device_to_circle(
    circle_id: str,
    body: CircleDeviceRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Share a device with the circle. You must own or have admin access to the device."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    with get_db_context() as db:
        # Verify circle membership
        membership = db.execute(
            "SELECT role FROM circle_members WHERE circle_id=? AND user_id=?",
            (circle_id, user_id),
        ).fetchone()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this circle")

        # Verify user owns the device or has admin share
        device = db.execute("SELECT id, owner_id FROM devices WHERE id=?", (body.device_id,)).fetchone()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        is_owner = device["owner_id"] == user_id
        is_admin_share = db.execute(
            "SELECT role FROM device_shares WHERE device_id=? AND grantee_user_id=? AND role='admin'",
            (body.device_id, user_id),
        ).fetchone()
        if not is_owner and not is_admin_share:
            raise HTTPException(status_code=403, detail="You need owner or admin access to share this device")

        # Add to circle (idempotent)
        entry_id = secrets.token_hex(16)
        db.execute(
            """INSERT INTO circle_devices (id, circle_id, device_id, shared_by)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(circle_id, device_id) DO UPDATE SET shared_by=excluded.shared_by""",
            (entry_id, circle_id, body.device_id, user_id),
        )
        db.commit()

    log_audit("circle_device_shared", actor=auth, details=f"Circle: {circle_id}, Device: {body.device_id}")

    return {"status": "ok", "circle_id": circle_id, "device_id": body.device_id}


# ─── Remove Device from Circle ──────────────────────────────────────────────


@router.delete("/{circle_id}/devices/{device_id}")
async def remove_device_from_circle(
    circle_id: str,
    device_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Remove a device from a circle. Admins or the person who shared it can remove."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    with get_db_context() as db:
        membership = db.execute(
            "SELECT role FROM circle_members WHERE circle_id=? AND user_id=?",
            (circle_id, user_id),
        ).fetchone()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this circle")

        entry = db.execute(
            "SELECT shared_by FROM circle_devices WHERE circle_id=? AND device_id=?",
            (circle_id, device_id),
        ).fetchone()
        if not entry:
            raise HTTPException(status_code=404, detail="Device not in this circle")

        # Only admins or the person who shared it can remove
        if membership["role"] != "admin" and entry["shared_by"] != user_id:
            raise HTTPException(status_code=403, detail="Only admins or the sharing user can remove devices")

        db.execute("DELETE FROM circle_devices WHERE circle_id=? AND device_id=?", (circle_id, device_id))
        db.commit()

    return {"status": "ok"}


# ─── Remove Member ──────────────────────────────────────────────────────────


@router.delete("/{circle_id}/members/{target_user_id}")
async def remove_member(
    circle_id: str,
    target_user_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Remove a member from the circle (admin only). Cannot remove the owner."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    with get_db_context() as db:
        membership = db.execute(
            "SELECT role FROM circle_members WHERE circle_id=? AND user_id=?",
            (circle_id, user_id),
        ).fetchone()
        if not membership or membership["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        circle = db.execute("SELECT owner_id FROM circles WHERE id=?", (circle_id,)).fetchone()
        if circle and circle["owner_id"] == target_user_id:
            raise HTTPException(status_code=400, detail="Cannot remove the circle owner")

        db.execute("DELETE FROM circle_members WHERE circle_id=? AND user_id=?", (circle_id, target_user_id))
        # Also remove any devices they shared with the circle
        db.execute("DELETE FROM circle_devices WHERE circle_id=? AND shared_by=?", (circle_id, target_user_id))
        db.commit()

    return {"status": "ok"}


# ─── Leave Circle ───────────────────────────────────────────────────────────


@router.post("/{circle_id}/leave")
async def leave_circle(
    circle_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Leave a circle. Owner must transfer ownership or delete the circle first."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    with get_db_context() as db:
        circle = db.execute("SELECT owner_id FROM circles WHERE id=?", (circle_id,)).fetchone()
        if not circle:
            raise HTTPException(status_code=404, detail="Circle not found")
        if circle["owner_id"] == user_id:
            raise HTTPException(
                status_code=400, detail="Owner cannot leave. Delete the circle or transfer ownership first."
            )

        db.execute("DELETE FROM circle_members WHERE circle_id=? AND user_id=?", (circle_id, user_id))
        db.execute("DELETE FROM circle_devices WHERE circle_id=? AND shared_by=?", (circle_id, user_id))
        db.commit()

    return {"status": "ok"}


# ─── Delete Circle ──────────────────────────────────────────────────────────


@router.delete("/{circle_id}")
async def delete_circle(
    circle_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Delete a circle (owner only). Removes all members and shared devices."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    with get_db_context() as db:
        circle = db.execute("SELECT owner_id FROM circles WHERE id=?", (circle_id,)).fetchone()
        if not circle:
            raise HTTPException(status_code=404, detail="Circle not found")
        if circle["owner_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the owner can delete a circle")

        db.execute("DELETE FROM circle_devices WHERE circle_id=?", (circle_id,))
        db.execute("DELETE FROM circle_members WHERE circle_id=?", (circle_id,))
        db.execute("DELETE FROM circles WHERE id=?", (circle_id,))
        db.commit()

    log_audit("circle_deleted", actor=auth, details=f"Circle: {circle_id}")

    return {"status": "ok"}


# ─── Refresh Invite Code ────────────────────────────────────────────────────


@router.post("/{circle_id}/refresh-invite")
async def refresh_invite_code(
    circle_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Generate a new invite code (admin only). The old code stops working."""
    user_id = user_id_from_subject(auth)
    if not user_id:
        raise HTTPException(status_code=403, detail="User account required")

    with get_db_context() as db:
        membership = db.execute(
            "SELECT role FROM circle_members WHERE circle_id=? AND user_id=?",
            (circle_id, user_id),
        ).fetchone()
        if not membership or membership["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        new_code = _generate_invite_code()
        db.execute("UPDATE circles SET invite_code=? WHERE id=?", (new_code, circle_id))
        db.commit()

    return {"invite_code": new_code}
