"""
Magneetar Recovery Bounty System
Community-driven phone recovery — users post bounties, finders claim rewards.

Flow:
1. Phone is stolen → owner posts a bounty
2. Nearby Magneetar users see the bounty alert
3. Someone finds the phone → scans QR code on lock screen
4. Finder claims the bounty
5. Owner verifies → payment released
6. Magneetar takes 15% platform fee
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/bounties", tags=["bounties"])


# ─── Models ──────────────────────────────────────────────────────────────────


class BountyCreateRequest(BaseModel):
    device_id: str
    amount: int  # in Kobo (₦5,000 = 500000)
    description: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_whatsapp: Optional[str] = None


class BountyClaimRequest(BaseModel):
    bounty_id: str
    finder_name: str
    finder_phone: str
    location_lat: float
    location_lng: float
    note: Optional[str] = None


class BountyVerifyRequest(BaseModel):
    bounty_id: str
    claim_id: str
    verified: bool
    password: str  # step-up verification


# ─── Create Bounty ──────────────────────────────────────────────────────────


@router.post("/create")
async def create_bounty(
    req: BountyCreateRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Post a bounty for a lost/stolen phone."""
    user_id = user_id_from_subject(auth)

    # Validate amount (min ₦1,000 = 100000 kobo, max ₦500,000 = 50000000 kobo)
    if req.amount < 100000:
        raise HTTPException(status_code=400, detail="Minimum bounty is ₦1,000")
    if req.amount > 50000000:
        raise HTTPException(status_code=400, detail="Maximum bounty is ₦500,000")

    # Verify the device belongs to the user
    with get_db_context() as db:
        device = db.execute(
            "SELECT id, name FROM devices WHERE id = ? AND owner_id = ?",
            (req.device_id, user_id),
        ).fetchone()

        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        # Check if there's already an active bounty for this device
        existing = db.execute(
            "SELECT id FROM bounties WHERE device_id = ? AND status = 'active'",
            (req.device_id,),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="Active bounty already exists for this device")

        bounty_id = f"bnty_{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc).isoformat()
        expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

        db.execute(
            """INSERT INTO bounties (id, device_id, owner_id, amount, description,
               contact_phone, contact_whatsapp, status, created_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)""",
            (
                bounty_id,
                req.device_id,
                user_id,
                req.amount,
                req.description,
                req.contact_phone,
                req.contact_whatsapp,
                now,
                expires_at,
            ),
        )
        db.commit()

    return {
        "ok": True,
        "bounty_id": bounty_id,
        "amount": req.amount,
        "currency": "NGN",
        "expires_at": expires_at,
    }


# ─── Get Active Bounties ───────────────────────────────────────────────────


@router.get("/active")
async def get_active_bounties(
    lat: float = 6.5244,
    lng: float = 3.3792,
    radius_km: float = 20.0,
    auth: str = Depends(require_dashboard_auth),
):
    """Get active bounties near a location."""
    with get_db_context() as db:
        bounties = db.execute(
            """
            SELECT b.id, b.device_id, b.amount, b.description,
                   b.contact_phone, b.contact_whatsapp, b.created_at, b.expires_at,
                   d.name as device_name
            FROM bounties b
            JOIN devices d ON b.device_id = d.id
            WHERE b.status = 'active'
              AND b.expires_at > ?
              AND d.lat BETWEEN ? AND ?
              AND d.lng BETWEEN ? AND ?
            ORDER BY b.amount DESC
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                lat - (radius_km / 111.0),
                lat + (radius_km / 111.0),
                lng - (radius_km / 111.0),
                lng + (radius_km / 111.0),
            ),
        ).fetchall()

    return {
        "bounties": [
            {
                "id": r[0],
                "device_id": r[1],
                "amount": r[2],
                "amount_display": f"₦{r[2] // 100:,}",
                "description": r[3],
                "contact_phone": r[4],
                "contact_whatsapp": r[5],
                "created_at": r[6],
                "expires_at": r[7],
                "device_name": r[8],
            }
            for r in bounties
        ]
    }


# ─── Claim Bounty ───────────────────────────────────────────────────────────


@router.post("/claim")
async def claim_bounty(
    req: BountyClaimRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Claim a bounty — you found the phone."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Verify bounty exists and is active
        bounty = db.execute(
            "SELECT id, owner_id, amount, device_id FROM bounties WHERE id = ? AND status = 'active'",
            (req.bounty_id,),
        ).fetchone()

        if not bounty:
            raise HTTPException(status_code=404, detail="Bounty not found or already claimed")

        # Can't claim your own bounty
        if bounty[1] == user_id:
            raise HTTPException(status_code=400, detail="Cannot claim your own bounty")

        # Check if already claimed
        existing = db.execute(
            "SELECT id FROM bounty_claims WHERE bounty_id = ?",
            (req.bounty_id,),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="Bounty already has a pending claim")

        claim_id = f"clm_{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc).isoformat()

        db.execute(
            """INSERT INTO bounty_claims (id, bounty_id, finder_id, finder_name,
               finder_phone, location_lat, location_lng, note, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
            (
                claim_id,
                req.bounty_id,
                user_id,
                req.finder_name,
                req.finder_phone,
                req.location_lat,
                req.location_lng,
                req.note,
                now,
            ),
        )
        db.commit()

    return {
        "ok": True,
        "claim_id": claim_id,
        "status": "pending",
        "message": "Claim submitted. The owner will verify and release the bounty.",
    }


# ─── Verify Claim ───────────────────────────────────────────────────────────


@router.post("/verify")
async def verify_claim(
    req: BountyVerifyRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Verify a bounty claim (owner confirms they got their phone back)."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Get bounty
        bounty = db.execute(
            "SELECT id, owner_id, amount FROM bounties WHERE id = ?",
            (req.bounty_id,),
        ).fetchone()

        if not bounty:
            raise HTTPException(status_code=404, detail="Bounty not found")

        if bounty[1] != user_id:
            raise HTTPException(status_code=403, detail="Only the bounty owner can verify claims")

        # Get claim
        claim = db.execute(
            "SELECT id, finder_id, status FROM bounty_claims WHERE id = ? AND bounty_id = ?",
            (req.claim_id, req.bounty_id),
        ).fetchone()

        if not claim:
            raise HTTPException(status_code=404, detail="Claim not found")

        if claim[2] != "pending":
            raise HTTPException(status_code=400, detail="Claim already processed")

        now = datetime.now(timezone.utc).isoformat()

        if req.verified:
            # Release bounty (minus 15% platform fee)
            platform_fee = int(bounty[2] * 0.15)
            finder_reward = bounty[2] - platform_fee

            db.execute(
                "UPDATE bounty_claims SET status = 'verified', verified_at = ?, reward_amount = ? WHERE id = ?",
                (now, finder_reward, req.claim_id),
            )
            db.execute(
                "UPDATE bounties SET status = 'completed', completed_at = ? WHERE id = ?",
                (now, req.bounty_id),
            )

            # Credit finder's account (for future withdrawal)
            db.execute(
                """INSERT INTO bounty_credits (user_id, amount, source_bounty_id, created_at)
                   VALUES (?, ?, ?, ?)""",
                (claim[1], finder_reward, req.bounty_id, now),
            )

            message = f"Bounty verified! ₦{finder_reward // 100:,} credited to finder."
        else:
            # Reject claim
            db.execute(
                "UPDATE bounty_claims SET status = 'rejected', verified_at = ? WHERE id = ?",
                (now, req.claim_id),
            )
            message = "Claim rejected."

        db.commit()

    return {"ok": True, "message": message}


# ─── Get My Bounties ────────────────────────────────────────────────────────


@router.get("/my")
async def get_my_bounties(
    auth: str = Depends(require_dashboard_auth),
):
    """Get bounties posted by the current user."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        bounties = db.execute(
            """
            SELECT b.id, b.device_id, b.amount, b.status, b.created_at, b.expires_at,
                   d.name as device_name,
                   (SELECT COUNT(*) FROM bounty_claims WHERE bounty_id = b.id) as claim_count
            FROM bounties b
            JOIN devices d ON b.device_id = d.id
            WHERE b.owner_id = ?
            ORDER BY b.created_at DESC
            """,
            (user_id,),
        ).fetchall()

    return {
        "bounties": [
            {
                "id": r[0],
                "device_id": r[1],
                "amount": r[2],
                "amount_display": f"₦{r[2] // 100:,}",
                "status": r[3],
                "created_at": r[4],
                "expires_at": r[5],
                "device_name": r[6],
                "claim_count": r[7],
            }
            for r in bounties
        ]
    }
