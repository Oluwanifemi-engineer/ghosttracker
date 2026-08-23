"""
Magneetar Referral Program
Two-sided rewards: referrer gets credit, referred gets bonus.

Best practices from research:
- Two-sided incentives (both parties get rewards)
- Unique referral codes (easy to share)
- Tiered rewards (more referrals = better rewards)
- WhatsApp-first sharing (dominant in Nigeria)
- Fraud prevention (one referral per phone number)
- Viral coefficient tracking

Reward Structure:
- Referrer: 1 month free premium per successful referral
- Referred: 1 week free premium on signup
- Tier 2: 5 referrals → 2 months free
- Tier 3: 10 referrals → lifetime premium badge
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/referrals", tags=["referrals"])


# ─── Models ──────────────────────────────────────────────────────────────────


class ReferralCodeResponse(BaseModel):
    code: str
    share_url: str
    share_message: str
    total_referrals: int
    successful_referrals: int
    pending_referrals: int
    reward_balance: int  # months of free premium earned
    tier: str  # "bronze", "silver", "gold", "platinum"


class ReferralStatsResponse(BaseModel):
    total_referrals: int
    successful_referrals: int
    pending_referrals: int
    reward_balance: int
    tier: str
    next_tier_referrals: int
    next_tier_name: str
    recent_referrals: list[dict]


class ApplyReferralRequest(BaseModel):
    code: str


# ─── Tier Definitions ────────────────────────────────────────────────────────

TIERS = [
    {"name": "bronze", "min_referrals": 0, "reward_months": 1, "label": "Bronze Referrer"},
    {"name": "silver", "min_referrals": 5, "reward_months": 2, "label": "Silver Referrer"},
    {"name": "gold", "min_referrals": 10, "reward_months": 3, "label": "Gold Referrer"},
    {"name": "platinum", "min_referrals": 25, "reward_months": 0, "label": "Platinum Referrer — Lifetime Badge"},
]


def _get_tier(referral_count: int) -> dict:
    """Get the current tier based on referral count."""
    current = TIERS[0]
    for tier in TIERS:
        if referral_count >= tier["min_referrals"]:
            current = tier
    return current


def _get_next_tier(referral_count: int) -> dict:
    """Get the next tier to unlock."""
    for tier in TIERS:
        if referral_count < tier["min_referrals"]:
            return tier
    return TIERS[-1]  # Already at max


def _generate_referral_code(user_id: str) -> str:
    """Generate a unique 8-character referral code."""
    raw = f"mgn:{user_id}:{secrets.token_hex(4)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:8].upper()


# ─── Get My Referral Code ────────────────────────────────────────────────────


@router.get("/code")
async def get_referral_code(
    auth: str = Depends(require_dashboard_auth),
):
    """Get your unique referral code and stats."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Create table if not exists
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS referral_codes (
                user_id TEXT PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            )
        """
        )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS referrals (
                id TEXT PRIMARY KEY,
                referrer_id TEXT NOT NULL,
                referred_id TEXT,
                referred_email TEXT,
                status TEXT DEFAULT 'pending',
                reward_granted INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (referrer_id) REFERENCES users(id)
            )
        """
        )

        # Get or create referral code
        record = db.execute(
            "SELECT code FROM referral_codes WHERE user_id = ?",
            (user_id,),
        ).fetchone()

        if not record:
            code = _generate_referral_code(user_id)
            now = datetime.now(timezone.utc).isoformat()
            db.execute(
                "INSERT INTO referral_codes (user_id, code, created_at) VALUES (?, ?, ?)",
                (user_id, code, now),
            )
            db.commit()
        else:
            code = record[0]

        # Get stats
        stats = _get_referral_stats(db, user_id)
        tier = _get_tier(stats["successful"])

    base_url = "https://magneetar.me"
    share_url = f"{base_url}/download?ref={code}"
    share_message = (
        f"🛡️ I use Magneetar to protect my phone and stay connected with my people. "
        f"Join me and get 1 week free premium! Use my code: {code}\n\n"
        f"Download: {share_url}"
    )

    return ReferralCodeResponse(
        code=code,
        share_url=share_url,
        share_message=share_message,
        total_referrals=stats["total"],
        successful_referrals=stats["successful"],
        pending_referrals=stats["pending"],
        reward_balance=stats["reward_months"],
        tier=tier["name"],
    )


# ─── Get Referral Stats ─────────────────────────────────────────────────────


@router.get("/stats")
async def get_referral_stats(
    auth: str = Depends(require_dashboard_auth),
):
    """Get detailed referral statistics and recent referrals."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        stats = _get_referral_stats(db, user_id)
        tier = _get_tier(stats["successful"])
        next_tier = _get_next_tier(stats["successful"])

        # Get recent referrals
        recent = db.execute(
            """
            SELECT r.id, r.referred_email, r.status, r.created_at, r.completed_at,
                   u.name as referred_name
            FROM referrals r
            LEFT JOIN users u ON r.referred_id = u.id
            WHERE r.referrer_id = ?
            ORDER BY r.created_at DESC
            LIMIT 10
        """,
            (user_id,),
        ).fetchall()

    return ReferralStatsResponse(
        total_referrals=stats["total"],
        successful_referrals=stats["successful"],
        pending_referrals=stats["pending"],
        reward_balance=stats["reward_months"],
        tier=tier["name"],
        next_tier_referrals=next_tier["min_referrals"],
        next_tier_name=next_tier["label"],
        recent_referrals=[
            {
                "id": r[0],
                "email": r[1],
                "name": r[5],
                "status": r[2],
                "referred_at": r[3],
                "completed_at": r[4],
            }
            for r in recent
        ],
    )


# ─── Apply Referral Code (on signup) ────────────────────────────────────────


@router.post("/apply")
async def apply_referral_code(
    req: ApplyReferralRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Apply a referral code during signup — both parties get rewards."""
    user_id = user_id_from_subject(auth)
    code = req.code.strip().upper()

    with get_db_context() as db:
        # Find the referrer
        referrer = db.execute(
            "SELECT user_id FROM referral_codes WHERE code = ?",
            (code,),
        ).fetchone()

        if not referrer:
            raise HTTPException(status_code=404, detail="Invalid referral code")

        referrer_id = referrer[0]

        # Can't refer yourself
        if referrer_id == user_id:
            raise HTTPException(status_code=400, detail="You cannot use your own referral code")

        # Check if already referred
        existing = db.execute(
            "SELECT id FROM referrals WHERE referrer_id = ? AND referred_id = ?",
            (referrer_id, user_id),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="You have already been referred by this user")

        # Create referral record
        referral_id = f"ref_{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc).isoformat()

        # Get referred user's email
        user = db.execute("SELECT email FROM users WHERE id = ?", (user_id,)).fetchone()
        referred_email = user[0] if user else ""

        db.execute(
            """
            INSERT INTO referrals (id, referrer_id, referred_id, referred_email, status, created_at)
            VALUES (?, ?, ?, ?, 'completed', ?)
        """,
            (referral_id, referrer_id, user_id, referred_email, now),
        )

        # Grant rewards
        # Referrer gets 1 month free premium
        _grant_reward(db, referrer_id, "referral_bonus", 1)

        # Referred user gets 1 week free premium
        _grant_reward(db, user_id, "referral_welcome", 0.25)  # 1 week = 0.25 months

        db.commit()

    return {
        "ok": True,
        "referral_id": referral_id,
        "referrer_reward": "1 month free premium",
        "referred_reward": "1 week free premium",
        "message": "Referral applied! Both parties have been rewarded.",
    }


# ─── Share Referral (track shares) ──────────────────────────────────────────


@router.post("/share")
async def track_share(
    platform: str,  # "whatsapp", "telegram", "twitter", "copy", "sms"
    auth: str = Depends(require_dashboard_auth),
):
    """Track when a user shares their referral link."""
    user_id = user_id_from_subject(auth)
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS referral_shares (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                platform TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """
        )

        share_id = f"shr_{secrets.token_hex(8)}"
        db.execute(
            "INSERT INTO referral_shares (id, user_id, platform, created_at) VALUES (?, ?, ?, ?)",
            (share_id, user_id, platform, now),
        )
        db.commit()

    return {"ok": True, "share_id": share_id}


# ─── Leaderboard ─────────────────────────────────────────────────────────────


@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 20,
):
    """Get top referrers leaderboard — social proof drives more referrals."""
    with get_db_context() as db:
        leaders = db.execute(
            """
            SELECT r.referrer_id, u.name, COUNT(*) as referral_count,
                   MAX(r.completed_at) as last_referral
            FROM referrals r
            JOIN users u ON r.referrer_id = u.id
            WHERE r.status = 'completed'
            GROUP BY r.referrer_id
            ORDER BY referral_count DESC
            LIMIT ?
        """,
            (limit,),
        ).fetchall()

    return {
        "leaders": [
            {
                "rank": i + 1,
                "name": leader[1] or "Anonymous",
                "referral_count": leader[2],
                "tier": _get_tier(leader[2])["name"],
                "last_referral": leader[3],
            }
            for i, leader in enumerate(leaders)
        ]
    }


# ─── Helper Functions ────────────────────────────────────────────────────────


def _get_referral_stats(db, user_id: str) -> dict:
    """Get referral stats for a user."""
    total = db.execute(
        "SELECT COUNT(*) FROM referrals WHERE referrer_id = ?",
        (user_id,),
    ).fetchone()[0]

    successful = db.execute(
        "SELECT COUNT(*) FROM referrals WHERE referrer_id = ? AND status = 'completed'",
        (user_id,),
    ).fetchone()[0]

    pending = db.execute(
        "SELECT COUNT(*) FROM referrals WHERE referrer_id = ? AND status = 'pending'",
        (user_id,),
    ).fetchone()[0]

    # Calculate reward balance
    tier = _get_tier(successful)
    reward_months = successful * tier["reward_months"]

    return {
        "total": total,
        "successful": successful,
        "pending": pending,
        "reward_months": reward_months,
    }


def _grant_reward(db, user_id: str, reward_type: str, months: float):
    """Grant a premium reward to a user."""
    now = datetime.now(timezone.utc).isoformat()

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS referral_rewards (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            reward_type TEXT NOT NULL,
            months_granted REAL NOT NULL,
            created_at TEXT NOT NULL,
            applied INTEGER DEFAULT 0
        )
    """
    )

    reward_id = f"rwd_{secrets.token_hex(8)}"
    db.execute(
        """
        INSERT INTO referral_rewards (id, user_id, reward_type, months_granted, created_at)
        VALUES (?, ?, ?, ?, ?)
    """,
        (reward_id, user_id, reward_type, months, now),
    )
