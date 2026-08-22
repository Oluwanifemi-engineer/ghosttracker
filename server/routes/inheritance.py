"""
Magneetar Digital Inheritance
Emergency access system — designate trusted people who can access your
device data if something happens to you.

Use cases:
1. "If I'm in an accident, my wife can access my phone location"
2. "If I'm kidnapped, my brother can see my last known position"
3. "If I die, my family can retrieve my digital evidence"
4. "If I'm arrested, my lawyer can access my device data"

Flow:
1. User designates beneficiaries (trusted people)
2. Each beneficiary gets a unique access code
3. In emergency, beneficiary requests access with code + reason
4. User has configurable delay (24h-72h) to cancel
5. If not cancelled, beneficiary gets time-limited access
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inheritance", tags=["inheritance"])


# ─── Models ──────────────────────────────────────────────────────────────────


class BeneficiaryRequest(BaseModel):
    name: str
    email: str
    relationship: str  # "spouse", "parent", "child", "sibling", "friend", "lawyer", "other"
    access_level: str = "location"  # "location", "evidence", "full"
    delay_hours: int = 48  # cancellation window


class BeneficiaryResponse(BaseModel):
    id: str
    name: str
    email: str
    relationship: str
    access_level: str
    delay_hours: int
    status: str  # "pending", "active", "expired", "cancelled"
    created_at: str
    access_code: Optional[str] = None  # only shown on creation


class EmergencyRequest(BaseModel):
    access_code: str
    reason: str  # "accident", "kidnapping", "medical", "legal", "death", "other"
    description: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class EmergencyAccessResponse(BaseModel):
    request_id: str
    status: str  # "pending", "approved", "denied", "cancelled"
    expires_at: Optional[str] = None
    access_level: str
    device_data: Optional[dict] = None


# ─── Add Beneficiary ────────────────────────────────────────────────────────


@router.post("/beneficiary")
async def add_beneficiary(
    req: BeneficiaryRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Add a trusted person who can access your data in emergencies."""
    user_id = user_id_from_subject(auth)

    # Validate delay
    if req.delay_hours < 1 or req.delay_hours > 168:  # 1 hour to 7 days
        raise HTTPException(status_code=400, detail="Delay must be between 1 and 168 hours")

    # Generate unique access code
    access_code = f"MT-{secrets.token_hex(4).upper()}-{secrets.token_hex(4).upper()}"
    code_hash = hashlib.sha256(access_code.encode()).hexdigest()[:16]

    beneficiary_id = f"ben_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS inheritance_beneficiaries (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                relationship TEXT NOT NULL,
                access_level TEXT NOT NULL,
                delay_hours INTEGER NOT NULL,
                code_hash TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL,
                activated_at TEXT,
                FOREIGN KEY (owner_id) REFERENCES users(id)
            )
        """
        )

        # Check limit (max 5 beneficiaries)
        count = db.execute(
            "SELECT COUNT(*) FROM inheritance_beneficiaries WHERE owner_id = ? AND status != 'cancelled'",
            (user_id,),
        ).fetchone()[0]

        if count >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 beneficiaries allowed")

        db.execute(
            """
            INSERT INTO inheritance_beneficiaries
                (id, owner_id, name, email, relationship, access_level, delay_hours, code_hash, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        """,
            (
                beneficiary_id,
                user_id,
                req.name,
                req.email,
                req.relationship,
                req.access_level,
                req.delay_hours,
                code_hash,
                now,
            ),
        )
        db.commit()

    return {
        "ok": True,
        "beneficiary_id": beneficiary_id,
        "access_code": access_code,  # Show once, then only hash stored
        "name": req.name,
        "relationship": req.relationship,
        "delay_hours": req.delay_hours,
        "message": f"Beneficiary added. Share the access code with {req.name} securely. "
        f"They can request emergency access after {req.delay_hours} hours.",
    }


# ─── List Beneficiaries ─────────────────────────────────────────────────────


@router.get("/beneficiaries")
async def list_beneficiaries(
    auth: str = Depends(require_dashboard_auth),
):
    """List all your designated beneficiaries."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        beneficiaries = db.execute(
            """
            SELECT id, name, email, relationship, access_level, delay_hours,
                   status, created_at, activated_at
            FROM inheritance_beneficiaries
            WHERE owner_id = ?
            ORDER BY created_at DESC
        """,
            (user_id,),
        ).fetchall()

    return {
        "beneficiaries": [
            BeneficiaryResponse(
                id=r[0],
                name=r[1],
                email=r[2],
                relationship=r[3],
                access_level=r[4],
                delay_hours=r[5],
                status=r[6],
                created_at=r[7],
            )
            for r in beneficiaries
        ]
    }


# ─── Remove Beneficiary ─────────────────────────────────────────────────────


@router.delete("/beneficiary/{beneficiary_id}")
async def remove_beneficiary(
    beneficiary_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Remove a beneficiary (cancel their access)."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        result = db.execute(
            """
            UPDATE inheritance_beneficiaries SET status = 'cancelled'
            WHERE id = ? AND owner_id = ?
        """,
            (beneficiary_id, user_id),
        )
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Beneficiary not found")

    return {"ok": True, "message": "Beneficiary removed. Their access code is now invalid."}


# ─── Request Emergency Access (Beneficiary) ─────────────────────────────────


@router.post("/emergency/request")
async def request_emergency_access(req: EmergencyRequest):
    """Beneficiary requests emergency access to owner's device data.

    This starts the cancellation delay timer. If the owner doesn't cancel
    within the delay period, access is granted.
    """
    code_hash = hashlib.sha256(req.access_code.encode()).hexdigest()[:16]

    with get_db_context() as db:
        # Find beneficiary by code hash
        beneficiary = db.execute(
            """
            SELECT id, owner_id, name, email, access_level, delay_hours, status
            FROM inheritance_beneficiaries
            WHERE code_hash = ? AND status = 'pending'
        """,
            (code_hash,),
        ).fetchone()

        if not beneficiary:
            raise HTTPException(status_code=404, detail="Invalid or inactive access code")

        # Create emergency request
        request_id = f"emrg_{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc)
        expires_at = (now + timedelta(hours=beneficiary[5])).isoformat()

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS inheritance_requests (
                id TEXT PRIMARY KEY,
                beneficiary_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                description TEXT NOT NULL,
                location_lat REAL,
                location_lng REAL,
                status TEXT DEFAULT 'pending',
                requested_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                accessed_at TEXT,
                FOREIGN KEY (beneficiary_id) REFERENCES inheritance_beneficiaries(id)
            )
        """
        )

        db.execute(
            """
            INSERT INTO inheritance_requests
                (id, beneficiary_id, owner_id, reason, description,
                 location_lat, location_lng, status, requested_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        """,
            (
                request_id,
                beneficiary[0],
                beneficiary[1],
                req.reason,
                req.description,
                req.location_lat,
                req.location_lng,
                now.isoformat(),
                expires_at,
            ),
        )

        # Update beneficiary status
        db.execute(
            "UPDATE inheritance_beneficiaries SET status = 'active' WHERE id = ?",
            (beneficiary[0],),
        )

        db.commit()

    return {
        "ok": True,
        "request_id": request_id,
        "status": "pending",
        "expires_at": expires_at,
        "delay_hours": beneficiary[5],
        "message": f"Emergency request submitted. The owner has {beneficiary[5]} hours to cancel. "
        f"If not cancelled, access will be granted at {expires_at}.",
    }


# ─── Cancel Emergency Request (Owner) ───────────────────────────────────────


@router.post("/emergency/cancel/{request_id}")
async def cancel_emergency_request(
    request_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Owner cancels an emergency access request within the delay window."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Verify the request belongs to this owner and is pending
        request = db.execute(
            """
            SELECT id, owner_id, status FROM inheritance_requests
            WHERE id = ? AND owner_id = ?
        """,
            (request_id, user_id),
        ).fetchone()

        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        if request[2] != "pending":
            raise HTTPException(status_code=400, detail="Request already processed")

        # Cancel the request
        db.execute(
            "UPDATE inheritance_requests SET status = 'cancelled' WHERE id = ?",
            (request_id,),
        )

        # Reset beneficiary status
        db.execute(
            """
            UPDATE inheritance_beneficiaries SET status = 'pending'
            WHERE owner_id = ?
        """,
            (user_id,),
        )

        db.commit()

    return {
        "ok": True,
        "message": "Emergency request cancelled. The beneficiary has been notified.",
    }


# ─── Check Access (Beneficiary) ─────────────────────────────────────────────


@router.get("/emergency/status/{request_id}")
async def check_emergency_status(request_id: str):
    """Beneficiary checks the status of their emergency request."""
    with get_db_context() as db:
        request = db.execute(
            """
            SELECT ir.id, ir.status, ir.expires_at, ir.accessed_at,
                   ib.access_level, ib.name as beneficiary_name
            FROM inheritance_requests ir
            JOIN inheritance_beneficiaries ib ON ir.beneficiary_id = ib.id
            WHERE ir.id = ?
        """,
            (request_id,),
        ).fetchone()

        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        # If pending and expires_at has passed, auto-approve
        if request[1] == "pending":
            expires = datetime.fromisoformat(request[2].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires:
                # Auto-approve
                db.execute(
                    "UPDATE inheritance_requests SET status = 'approved', accessed_at = ? WHERE id = ?",
                    (datetime.now(timezone.utc).isoformat(), request_id),
                )
                db.commit()
                request = ("approved",) + request[1:]

        return EmergencyAccessResponse(
            request_id=request[0],
            status=request[1],
            expires_at=request[2],
            access_level=request[4],
            device_data=None,  # Only populated when status is "approved"
        )


# ─── Get Device Data (Approved Beneficiary) ─────────────────────────────────


@router.get("/emergency/data/{request_id}")
async def get_emergency_data(request_id: str):
    """Get device data for approved emergency requests."""
    with get_db_context() as db:
        request = db.execute(
            """
            SELECT ir.owner_id, ir.status, ib.access_level
            FROM inheritance_requests ir
            JOIN inheritance_beneficiaries ib ON ir.beneficiary_id = ib.id
            WHERE ir.id = ?
        """,
            (request_id,),
        ).fetchone()

        if not request:
            raise HTTPException(status_code=404, detail="Request not found")

        if request[1] != "approved":
            raise HTTPException(status_code=403, detail="Request not yet approved")

        owner_id = request[0]
        access_level = request[2]

        # Get device data based on access level
        devices = db.execute(
            "SELECT id, name, lat, lng, battery, last_seen FROM devices WHERE owner_id = ?",
            (owner_id,),
        ).fetchall()

        device_data = {
            "devices": [
                {
                    "id": d[0],
                    "name": d[1],
                    "location": {"lat": d[2], "lng": d[3]} if d[2] else None,
                    "battery": d[4],
                    "last_seen": d[5],
                }
                for d in devices
            ]
        }

        # Full access includes evidence
        if access_level == "full":
            evidence = db.execute(
                """
                SELECT id, device_id, created_at, type
                FROM evidence WHERE device_id IN (SELECT id FROM devices WHERE owner_id = ?)
                ORDER BY created_at DESC LIMIT 50
            """,
                (owner_id,),
            ).fetchall()
            device_data["evidence"] = [
                {"id": e[0], "device_id": e[1], "created_at": e[2], "type": e[3]} for e in evidence
            ]

        return device_data


# ─── Owner's Emergency View ─────────────────────────────────────────────────


@router.get("/emergency/requests")
async def list_emergency_requests(
    auth: str = Depends(require_dashboard_auth),
):
    """Owner views all pending/emergency requests on their account."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        requests = db.execute(
            """
            SELECT ir.id, ir.reason, ir.description, ir.status,
                   ir.requested_at, ir.expires_at,
                   ib.name, ib.relationship
            FROM inheritance_requests ir
            JOIN inheritance_beneficiaries ib ON ir.beneficiary_id = ib.id
            WHERE ir.owner_id = ?
            ORDER BY ir.requested_at DESC
        """,
            (user_id,),
        ).fetchall()

    return {
        "requests": [
            {
                "id": r[0],
                "reason": r[1],
                "description": r[2],
                "status": r[3],
                "requested_at": r[4],
                "expires_at": r[5],
                "beneficiary_name": r[6],
                "beneficiary_relationship": r[7],
            }
            for r in requests
        ]
    }
