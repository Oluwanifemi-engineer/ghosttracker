"""
Magneetar Trust Score System
IMEI-based device reputation — like a credit score for phones.
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
    check_type: str = "full"


class TrustScoreResponse(BaseModel):
    imei: str
    trust_score: int
    status: str
    device_info: Optional[dict] = None
    owner_verified: bool = False
    theft_reports: int = 0
    last_active: Optional[str] = None
    warnings: list[str] = []


class TheftReportRequest(BaseModel):
    imei: str
    device_name: Optional[str] = None
    theft_date: str
    theft_location: Optional[str] = None
    theft_method: Optional[str] = None
    police_report_id: Optional[str] = None
    description: Optional[str] = None


class TheftStatusResponse(BaseModel):
    imei: str
    reported_stolen: bool
    report_date: Optional[str] = None
    reporter_name: Optional[str] = None
    recovery_status: str = "unrecovered"


class ReputationRequest(BaseModel):
    user_id: str
    action: str


class ReputationResponse(BaseModel):
    user_id: str
    reputation_score: int
    total_actions: int
    positive_actions: int
    negative_actions: int
    badges: list[str]


# ─── IMEI Check (Public) ────────────────────────────────────────────────────


@router.post("/check")
async def check_imei(req: IMEICheckRequest):
    """Check IMEI status — public endpoint, no auth required."""
    imei = req.imei.strip().replace(" ", "").replace("-", "")

    if len(imei) < 15:
        raise HTTPException(status_code=400, detail="Invalid IMEI number (too short)")

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

        # Check trust score record
        record = db.execute("SELECT * FROM trust_scores WHERE imei_hash = ?", (imei_hash,)).fetchone()

        # Check theft reports
        theft_reports = db.execute(
            "SELECT COUNT(*) FROM theft_status_reports" " WHERE imei_hash = ? AND status = 'active'",
            (imei_hash,),
        ).fetchone()[0]

        # Check if device is registered
        device_record = db.execute(
            "SELECT id, owner_id, alias, model, imei_hash" " FROM devices WHERE imei_hash = ?",
            (imei_hash,),
        ).fetchone()

        if record:
            # Cast to int to avoid str comparison errors
            owner_verified = bool(int(record["owner_verified"] or 0))
            recovery_count = int(record["recovery_count"] or 0)
            last_active = record["last_active"]

            trust_score = _calculate_trust_score(
                theft_reports=theft_reports,
                owner_verified=owner_verified,
                recovery_count=recovery_count,
                last_active=last_active,
            )

            # Determine status
            if theft_reports > 0:
                status = "stolen"
            elif trust_score >= 70:
                status = "clean"
            elif trust_score < 30:
                status = "suspicious"
            else:
                status = "unknown"

            warnings = []
            if theft_reports > 0:
                warnings.append(f"This IMEI has {theft_reports} active theft report(s)")
            if trust_score < 50:
                warnings.append("Low trust score — verify device ownership")
            if not owner_verified:
                warnings.append("Owner not verified")

            return TrustScoreResponse(
                imei=imei,
                trust_score=trust_score,
                status=status,
                device_info=(
                    {
                        "brand": record["device_brand"],
                        "model": record["device_model"],
                        "type": record["device_type"],
                    }
                    if record["device_brand"]
                    else None
                ),
                owner_verified=owner_verified,
                theft_reports=theft_reports,
                last_active=last_active,
                warnings=warnings,
            )
        else:
            # No trust score record — check if device exists
            trust_score = 50
            if theft_reports > 0:
                trust_score = 10
                status = "stolen"
            else:
                status = "unknown"

            device_info = None
            warnings = []
            if device_record:
                # Device exists but no trust score — auto-create
                now = datetime.now(timezone.utc).isoformat()
                db.execute(
                    """
                    INSERT INTO trust_scores
                        (imei_hash, trust_score, status, device_brand,
                         device_model, first_registered, owner_verified,
                         created_at)
                    VALUES (?, 60, 'registered', ?, ?, ?, 1, ?)
                    ON CONFLICT(imei_hash) DO NOTHING
                    """,
                    (
                        imei_hash,
                        device_record["model"],
                        device_record["model"],
                        now,
                        now,
                    ),
                )
                db.commit()

                device_info = {
                    "id": device_record["id"],
                    "name": device_record["alias"],
                    "model": device_record["model"],
                }
                trust_score = 60
                status = "registered"
            else:
                warnings = [
                    "Device not registered with Magneetar",
                    "This IMEI has not been verified through Magneetar",
                ]

            return TrustScoreResponse(
                imei=imei,
                trust_score=trust_score,
                status=status,
                device_info=device_info,
                owner_verified=bool(device_record),
                theft_reports=theft_reports,
                last_active=None,
                warnings=warnings,
            )


# ─── Device ID Check (Android 10+) ────────────────────────────────────────


@router.get("/device/{device_id}")
async def check_device_by_id(device_id: str):
    """Check device trust by device ID — for Android 10+ devices."""
    with get_db_context() as db:
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

        device = db.execute(
            "SELECT id, owner_id, alias, model, imei_hash,"
            " last_seen, sentinel_score, is_stolen"
            " FROM devices WHERE id = ?",
            (device_id,),
        ).fetchone()

        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        if device["imei_hash"]:
            return await check_imei(IMEICheckRequest(imei=device["imei_hash"]))

        trust_score = 50
        warnings = []

        if device["is_stolen"]:
            trust_score = 10
            warnings.append("This device has been reported as stolen")

        if device["last_seen"]:
            try:
                last = datetime.fromisoformat(str(device["last_seen"]).replace("Z", "+00:00"))
                days_since = (datetime.now(timezone.utc) - last).days
                if days_since < 1:
                    trust_score += 20
                elif days_since < 7:
                    trust_score += 10
                elif days_since > 30:
                    trust_score -= 10
            except (ValueError, TypeError):
                pass

        if device["sentinel_score"]:
            if device["sentinel_score"] < 30:
                trust_score += 10
            elif device["sentinel_score"] >= 70:
                trust_score -= 20

        trust_score = max(0, min(100, trust_score))

        return {
            "device_id": device_id,
            "device_name": device["alias"],
            "device_model": device["model"],
            "trust_score": trust_score,
            "status": ("stolen" if device["is_stolen"] else "active" if trust_score >= 50 else "suspicious"),
            "last_seen": str(device["last_seen"]) if device["last_seen"] else None,
            "sentinel_score": device["sentinel_score"] or 0,
            "warnings": warnings,
            "info": ("Device is registered but IMEI is not available" " (Android 10+ restriction)"),
        }


# ─── Report Theft (Authenticated) ───────────────────────────────────────────


@router.post("/report-theft")
async def report_theft(
    req: TheftReportRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Report a phone as stolen."""
    user_id = user_id_from_subject(auth)
    imei = req.imei.strip().replace(" ", "").replace("-", "")
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]

    report_id = f"theft_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
        db.execute(
            """
            INSERT INTO theft_status_reports
                (id, imei_hash, reporter_id, theft_date,
                 theft_location, theft_method, police_report_id,
                 description, status, created_at)
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

        db.execute(
            """
            INSERT INTO trust_scores
                (imei_hash, trust_score, status, theft_reported,
                 theft_report_date, created_at)
            VALUES (?, 10, 'stolen', 1, ?, ?)
            ON CONFLICT(imei_hash) DO UPDATE SET
                trust_score = 10, status = 'stolen',
                theft_reported = theft_reported + 1,
                theft_report_date = ?
        """,
            (imei_hash, req.theft_date, now, req.theft_date),
        )

        db.execute(
            "UPDATE devices SET is_stolen = 1," " theft_confirmed_at = ? WHERE imei_hash = ?",
            (now, imei_hash),
        )

        db.commit()

    return {
        "ok": True,
        "report_id": report_id,
        "imei": imei,
        "trust_score": 10,
        "status": "stolen",
        "message": "Theft reported. Device flagged as stolen.",
    }


# ─── Get Theft Status (Public) ──────────────────────────────────────────────


@router.get("/theft-status/{imei}")
async def get_theft_status(imei: str):
    """Check if a specific IMEI is reported stolen — public."""
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
                report_date=report["theft_date"],
                reporter_name=report["reporter_name"],
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
    """Mark a stolen phone as recovered."""
    user_id_from_subject(auth)
    imei = imei.strip().replace(" ", "").replace("-", "")
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]

    with get_db_context() as db:
        db.execute(
            """
            UPDATE theft_status_reports SET status = 'recovered'
            WHERE imei_hash = ? AND status = 'active'
        """,
            (imei_hash,),
        )

        db.execute(
            """
            UPDATE trust_scores SET
                trust_score = MIN(100, trust_score + 30),
                status = 'clean',
                theft_reported = MAX(0, theft_reported - 1),
                recovery_count = recovery_count + 1
            WHERE imei_hash = ?,
        """,
            (imei_hash,),
        )

        db.execute(
            "UPDATE devices SET is_stolen = 0 WHERE imei_hash = ?",
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
    """Get a user's reputation score — public."""
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

    total_actions = sum(r["count"] for r in records) if records else 0
    total_points = sum(r["sum"] for r in records) if records else 0

    positive = sum(r["count"] for r in records if r["action"] in ("phone_found", "phone_returned", "verified_owner"))
    negative = sum(r["count"] for r in records if r["action"] == "false_report")

    if total_actions == 0:
        reputation_score = 50
    else:
        reputation_score = min(100, max(0, 50 + total_points))

    badges = []
    if positive >= 5:
        badges.append("Guardian Angel")
    if positive >= 10:
        badges.append("Community Hero")
    if negative == 0 and total_actions >= 3:
        badges.append("Trusted Member")
    if total_actions >= 20:
        badges.append("Super Recoverer")

    return ReputationResponse(
        user_id=user_id,
        reputation_score=reputation_score,
        total_actions=total_actions,
        positive_actions=positive,
        negative_actions=negative,
        badges=badges,
    )


@router.post("/reputation/record")
async def record_reputation(
    req: ReputationRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Record a reputation action."""
    now = datetime.now(timezone.utc).isoformat()
    action_id = f"rep_{secrets.token_hex(8)}"

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
            INSERT INTO user_reputation
                (id, user_id, action, points, created_at)
            VALUES (?, ?, ?, ?, ?)
        """,
            (action_id, req.user_id, req.action, points, now),
        )
        db.commit()

    return {"ok": True, "action_id": action_id, "points": points}


# ─── QR Code Data ────────────────────────────────────────────────────────────


@router.get("/qr-data/{device_id}")
async def get_qr_data(
    device_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Generate QR code data for a device's lock screen."""
    with get_db_context() as db:
        device = db.execute(
            "SELECT id, imei_hash, alias, owner_id" " FROM devices WHERE id = ?",
            (device_id,),
        ).fetchone()

        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        imei_hash = device["imei_hash"] if device["imei_hash"] else None

        trust_record = None
        if imei_hash:
            trust_record = db.execute(
                "SELECT trust_score, status FROM trust_scores" " WHERE imei_hash = ?",
                (imei_hash,),
            ).fetchone()

        owner_info = None
        if trust_record and trust_record["status"] != "stolen":
            owner = db.execute(
                "SELECT name, email FROM users WHERE id = ?",
                (device["owner_id"],),
            ).fetchone()
            if owner:
                owner_info = {
                    "name": owner["name"],
                    "contact": owner["email"],
                }

    return {
        "device_id": device_id,
        "device_name": device["alias"],
        "trust_score": (trust_record["trust_score"] if trust_record else 50),
        "status": trust_record["status"] if trust_record else "unknown",
        "owner_info": owner_info,
        "qr_url": f"https://magneetar.me/trust/scan/{device_id}",
        "scan_instructions": ("Scan this code to verify this phone's status" " and contact the owner."),
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
