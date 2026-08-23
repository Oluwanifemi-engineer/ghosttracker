"""
Magneetar Trust Score System
IMEI-based device reputation — like a credit score for phones.

Features:
- IMEI verification (blacklist check, device info)
- Trust Score calculation (0-100) based on multiple signals
- Theft status reporting and verification
- Community reputation for finders/owners
- QR code scan for instant phone verification

Use cases:
1. Buying a used phone → scan IMEI → check trust score
2. Finding a phone → scan QR on lock screen → see if stolen
3. Insurance claims → verify device history
4. Police reports → generate evidence package
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trust", tags=["trust_score"])


# ─── Models ──────────────────────────────────────────────────────────────────


class IMEICheckRequest(BaseModel):
    imei: str
    check_type: str = "full"  # "full", "basic", "theft_only"


class TrustScoreResponse(BaseModel):
    imei: str
    trust_score: int  # 0-100
    status: str  # "clean", "suspicious", "stolen", "unknown"
    device_info: Optional[dict] = None
    owner_verified: bool = False
    theft_reports: int = 0
    last_active: Optional[str] = None
    warnings: list[str] = []


class TheftReportRequest(BaseModel):
    imei: str
    device_name: Optional[str] = None
    theft_date: str  # ISO date
    theft_location: Optional[str] = None
    theft_method: Optional[str] = None
    police_report_id: Optional[str] = None
    description: Optional[str] = None


class TheftStatusResponse(BaseModel):
    imei: str
    reported_stolen: bool
    report_date: Optional[str] = None
    reporter_name: Optional[str] = None
    recovery_status: str = "unrecovered"  # "unrecovered", "recovered", "disputed"


class ReputationRequest(BaseModel):
    user_id: str
    action: str  # "phone_found", "phone_returned", "false_report", "verified_owner"


class ReputationResponse(BaseModel):
    user_id: str
    reputation_score: int  # 0-100
    total_actions: int
    positive_actions: int
    negative_actions: int
    badges: list[str]


# ─── IMEI Check (Public) ────────────────────────────────────────────────────


@router.post("/check")
async def check_imei(req: IMEICheckRequest):
    """Check IMEI status — returns trust score and theft status.

    This is a PUBLIC endpoint (no auth required) so anyone can verify
    a phone before buying it or after finding it.
    """
    imei = req.imei.strip().replace(" ", "").replace("-", "")

    if len(imei) < 15:
        raise HTTPException(status_code=400, detail="Invalid IMEI number (too short)")

    # Calculate IMEI hash for privacy (don't store raw IMEI)
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]

    with get_db_context() as db:
        # Create tables if not exists
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS trust_scores (
                imei_hash TEXT PRIMARY KEY,
                trust_score INTEGER DEFAULT 50,
                status TEXT DEFAULT 'unknown',
                device_brand TEXT,
                device_model TEXT,
                device_type TEXT,
                first_registered TEXT,
                last_active TEXT,
                theft_reported INTEGER DEFAULT 0,
                theft_report_date TEXT,
                owner_verified INTEGER DEFAULT 0,
                recovery_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """
        )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS theft_status_reports (
                id TEXT PRIMARY KEY,
                imei_hash TEXT NOT NULL,
                reporter_id TEXT,
                theft_date TEXT NOT NULL,
                theft_location TEXT,
                theft_method TEXT,
                police_report_id TEXT,
                description TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL,
                FOREIGN KEY (reporter_id) REFERENCES users(id)
            )
        """
        )

        # Check if we have a trust score record
        record = db.execute("SELECT * FROM trust_scores WHERE imei_hash = ?", (imei_hash,)).fetchone()

        # Check theft reports
        theft_reports = db.execute(
            "SELECT COUNT(*) FROM theft_status_reports WHERE imei_hash = ? AND status = 'active'",
            (imei_hash,),
        ).fetchone()[0]

        # Check if device is registered with any user
        device_record = db.execute(
            "SELECT id, owner_id, alias FROM devices WHERE imei_hash = ?",
            (imei_hash,),
        ).fetchone()

        if record:
            # Update trust score based on current data
            trust_score = _calculate_trust_score(
                theft_reports=theft_reports,
                owner_verified=bool(record[10]),  # owner_verified column
                recovery_count=record[12],  # recovery_count column
                last_active=record[8],  # last_active column
            )

            # Determine status
            if theft_reports > 0:
                status = "stolen"
            elif trust_score < 30:
                status = "suspicious"
            elif trust_score >= 70:
                status = "clean"
            else:
                status = "unknown"

            warnings = []
            if theft_reports > 0:
                warnings.append(f"This IMEI has {theft_reports} active theft report(s)")
            if trust_score < 50:
                warnings.append("Low trust score — verify device ownership")
            if not record[10]:  # owner_verified
                warnings.append("Owner not verified")

            return TrustScoreResponse(
                imei=imei,
                trust_score=trust_score,
                status=status,
                device_info=(
                    {
                        "brand": record[4],
                        "model": record[5],
                        "type": record[6],
                    }
                    if record[4]
                    else None
                ),
                owner_verified=bool(record[10]),
                theft_reports=theft_reports,
                last_active=record[8],
                warnings=warnings,
            )
        else:
            # No record — calculate based on available data
            trust_score = 50  # neutral
            if theft_reports > 0:
                trust_score = 10
                status = "stolen"
            else:
                status = "unknown"

            device_info = None
            if device_record:
                device_info = {
                    "id": device_record[0],
                    "name": device_record[2],
                }

            return TrustScoreResponse(
                imei=imei,
                trust_score=trust_score,
                status=status,
                device_info=device_info,
                owner_verified=False,
                theft_reports=theft_reports,
                last_active=None,
                warnings=["Device not registered with Magneetar"] if not device_record else [],
            )


# ─── Report Theft (Authenticated) ───────────────────────────────────────────


@router.post("/report-theft")
async def report_theft(
    req: TheftReportRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Report a phone as stolen — updates trust score for this IMEI."""
    user_id = user_id_from_subject(auth)
    imei = req.imei.strip().replace(" ", "").replace("-", "")
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]

    report_id = f"theft_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
        # Create theft report
        db.execute(
            """
            INSERT INTO theft_status_reports (id, imei_hash, reporter_id, theft_date,
                theft_location, theft_method, police_report_id, description, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        """,
            (
                report_id,
                imei_hash,
                user_id,
                req.theft_date,
                req.theft_location,
                req.theft_method,
                req.police_report_id,
                req.description,
                now,
            ),
        )

        # Update trust score record
        db.execute(
            """
            INSERT INTO trust_scores (imei_hash, trust_score, status, theft_reported,
                theft_report_date, created_at)
            VALUES (?, 10, 'stolen', 1, ?, ?)
            ON CONFLICT(imei_hash) DO UPDATE SET
                trust_score = 10,
                status = 'stolen',
                theft_reported = theft_reported + 1,
                theft_report_date = ?
        """,
            (imei_hash, req.theft_date, now, req.theft_date),
        )

        db.commit()

    return {
        "ok": True,
        "report_id": report_id,
        "imei": imei,
        "trust_score": 10,
        "status": "stolen",
        "message": "Theft reported. Trust score updated. The device is now flagged as stolen.",
    }


# ─── Get Theft Status (Public) ──────────────────────────────────────────────


@router.get("/theft-status/{imei}")
async def get_theft_status(imei: str):
    """Check if a specific IMEI is reported stolen — public endpoint."""
    imei = imei.strip().replace(" ", "").replace("-", "")
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]

    with get_db_context() as db:
        report = db.execute(
            """
            SELECT ts.theft_date, ts.theft_location, ts.theft_method,
                   ts.status, ts.created_at, u.name as reporter_name
            FROM theft_status_reports ts
            LEFT JOIN users u ON ts.reporter_id = u.id
            WHERE ts.imei_hash = ? AND ts.status = 'active'
            ORDER BY ts.created_at DESC LIMIT 1
        """,
            (imei_hash,),
        ).fetchone()

        if report:
            return TheftStatusResponse(
                imei=imei,
                reported_stolen=True,
                report_date=report[0],
                reporter_name=report[5],
                recovery_status="unrecovered",
            )
        else:
            return TheftStatusResponse(
                imei=imei,
                reported_stolen=False,
                recovery_status="unrecovered",
            )


# ─── Mark Recovered (Authenticated) ────────────────────────────────────────


@router.post("/mark-recovered")
async def mark_recovered(
    imei: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Mark a stolen phone as recovered — updates trust score."""
    user_id_from_subject(auth)  # verify auth
    imei = imei.strip().replace(" ", "").replace("-", "")
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]

    with get_db_context() as db:
        # Mark theft reports as recovered
        db.execute(
            """
            UPDATE theft_status_reports SET status = 'recovered'
            WHERE imei_hash = ? AND status = 'active'
        """,
            (imei_hash,),
        )

        # Update trust score
        db.execute(
            """
            UPDATE trust_scores SET
                trust_score = MIN(100, trust_score + 30),
                status = 'clean',
                theft_reported = MAX(0, theft_reported - 1),
                recovery_count = recovery_count + 1
            WHERE imei_hash = ?
        """,
            (imei_hash,),
        )

        db.commit()

    return {
        "ok": True,
        "imei": imei,
        "message": "Phone marked as recovered. Trust score improved.",
    }


# ─── User Reputation ────────────────────────────────────────────────────────


@router.get("/reputation/{user_id}")
async def get_reputation(user_id: str):
    """Get a user's reputation score — public for trust verification."""
    with get_db_context() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS user_reputation (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                action TEXT NOT NULL,
                points INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """
        )

        records = db.execute(
            """
            SELECT action, COUNT(*), SUM(points)
            FROM user_reputation WHERE user_id = ?
            GROUP BY action
        """,
            (user_id,),
        ).fetchall()

    total_actions = sum(r[1] for r in records) if records else 0
    total_points = sum(r[2] for r in records) if records else 0

    # Calculate reputation score (0-100) using points as the primary signal
    positive_actions = sum(r[1] for r in records if r[0] in ("phone_found", "phone_returned", "verified_owner"))
    negative_actions = sum(r[1] for r in records if r[0] == "false_report")

    if total_actions == 0:
        reputation_score = 50  # neutral
    else:
        # Use accumulated points as the primary signal
        reputation_score = min(100, max(0, 50 + total_points))

    # Generate badges
    badges = []
    if positive_actions >= 5:
        badges.append("Guardian Angel")
    if positive_actions >= 10:
        badges.append("Community Hero")
    if negative_actions == 0 and total_actions >= 3:
        badges.append("Trusted Member")
    if total_actions >= 20:
        badges.append("Super Recoverer")

    return ReputationResponse(
        user_id=user_id,
        reputation_score=reputation_score,
        total_actions=total_actions,
        positive_actions=positive_actions,
        negative_actions=negative_actions,
        badges=badges,
    )


@router.post("/reputation/record")
async def record_reputation(
    req: ReputationRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Record a reputation action (phone found, returned, etc.)."""
    now = datetime.now(timezone.utc).isoformat()
    action_id = f"rep_{secrets.token_hex(8)}"

    # Points per action
    points_map = {
        "phone_found": 10,
        "phone_returned": 25,
        "verified_owner": 5,
        "false_report": -20,
    }
    points = points_map.get(req.action, 0)

    with get_db_context() as db:
        db.execute(
            """
            INSERT INTO user_reputation (id, user_id, action, points, created_at)
            VALUES (?, ?, ?, ?, ?)
        """,
            (action_id, req.user_id, req.action, points, now),
        )
        db.commit()

    return {"ok": True, "action_id": action_id, "points": points}


# ─── QR Code Data (for lock screen) ────────────────────────────────────────


@router.get("/qr-data/{device_id}")
async def get_qr_data(
    device_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Generate QR code data for a device's lock screen.

    When someone finds a phone, they scan this QR to see:
    - Trust score
    - Theft status
    - Owner contact info (optional)
    """
    with get_db_context() as db:
        device = db.execute(
            "SELECT id, imei, name, owner_id FROM devices WHERE id = ?",
            (device_id,),
        ).fetchone()

        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        imei = device[1]
        imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16] if imei else None

        # Get trust score
        trust_record = None
        if imei_hash:
            trust_record = db.execute(
                "SELECT trust_score, status FROM trust_scores WHERE imei_hash = ?",
                (imei_hash,),
            ).fetchone()

        # Get owner info (only if device is not stolen — privacy)
        owner_info = None
        if trust_record and trust_record[1] != "stolen":
            owner = db.execute("SELECT name, email FROM users WHERE id = ?", (device[3],)).fetchone()
            if owner:
                owner_info = {"name": owner[0], "contact": owner[1]}

    return {
        "device_id": device_id,
        "device_name": device[2],
        "trust_score": trust_record[0] if trust_record else 50,
        "status": trust_record[1] if trust_record else "unknown",
        "owner_info": owner_info,
        "qr_url": f"https://magneetar.me/trust/scan/{device_id}",
        "scan_instructions": "Scan this code to verify this phone's status and contact the owner.",
    }


# ─── Helper Functions ────────────────────────────────────────────────────────


def _calculate_trust_score(
    theft_reports: int = 0,
    owner_verified: bool = False,
    recovery_count: int = 0,
    last_active: Optional[str] = None,
) -> int:
    """Calculate trust score (0-100) based on multiple signals."""
    score = 50  # baseline

    # Theft reports drastically reduce score
    score -= theft_reports * 30

    # Verified owner increases trust
    if owner_verified:
        score += 20

    # Recovery history shows active engagement
    score += min(20, recovery_count * 5)

    # Recently active devices are more trustworthy
    if last_active:
        try:
            last = datetime.fromisoformat(last_active.replace("Z", "+00:00"))
            days_since = (datetime.now(timezone.utc) - last).days
            if days_since < 7:
                score += 10
            elif days_since > 90:
                score -= 10
        except (ValueError, TypeError):
            pass

    return max(0, min(100, score))
