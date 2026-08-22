"""
Magneetar Payment Integration (Paystack)
Handles subscription initialization, verification, and webhook processing.

Paystack flow:
1. Frontend calls /payments/initialize → gets authorization_url
2. User completes payment on Paystack
3. Paystack sends webhook to /payments/webhook
4. Server verifies transaction, updates user plan
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

# ─── Configuration ──────────────────────────────────────────────────────────

PAYSTACK_SECRET_KEY = os.getenv("MT_PAYSTACK_SECRET_KEY", "")
PAYSTACK_PUBLIC_KEY = os.getenv("MT_PAYSTACK_PUBLIC_KEY", "")
PAYSTACK_WEBHOOK_SECRET = os.getenv("MT_PAYSTACK_WEBHOOK_SECRET", "")
PAYSTACK_BASE_URL = "https://api.paystack.co"

# Plan pricing (in Kobo — Paystack uses the smallest currency unit)
PLANS = {
    "personal_monthly": {
        "name": "Personal Monthly",
        "amount": 150000,  # ₦1,500 = 150,000 kobo
        "interval": "monthly",
        "description": "Magneetar Personal — 3 devices, real-time tracking, family circles",
        "currency": "NGN",
    },
    "personal_yearly": {
        "name": "Personal Yearly",
        "amount": 1500000,  # ₦15,000 = 1,500,000 kobo (2 months free)
        "interval": "annually",
        "description": "Magneetar Personal — Yearly (2 months free)",
        "currency": "NGN",
    },
    "family_monthly": {
        "name": "Family Monthly",
        "amount": 300000,  # ₦3,000 = 300,000 kobo
        "interval": "monthly",
        "description": "Magneetar Family — 10 devices, everything in Personal + bounties",
        "currency": "NGN",
    },
    "family_yearly": {
        "name": "Family Yearly",
        "amount": 3000000,  # ₦30,000 = 3,000,000 kobo (2 months free)
        "interval": "annually",
        "description": "Magneetar Family — Yearly (2 months free)",
        "currency": "NGN",
    },
}

# Free tier limits
FREE_TIER = {
    "max_devices": 1,
    "tracking_interval_seconds": 300,  # 5 minutes
    "family_circle_members": 0,
    "location_history_days": 7,
    "features": ["basic_tracking", "community_watch_read_only", "security_score_basic"],
}

# Paid tier limits
PERSONAL_TIER = {
    "max_devices": 3,
    "tracking_interval_seconds": 3,  # 3 seconds
    "family_circle_members": 5,
    "location_history_days": 90,
    "features": [
        "realtime_tracking",
        "family_circles",
        "panic_button",
        "smart_geofencing",
        "remote_lock",
        "evidence_capture",
        "device_health",
        "recovery_leaderboard",
        "community_bounties",
    ],
}

FAMILY_TIER = {
    "max_devices": 10,
    "tracking_interval_seconds": 3,
    "family_circle_members": -1,  # unlimited
    "location_history_days": 365,
    "features": [
        "realtime_tracking",
        "family_circles",
        "panic_button",
        "smart_geofencing",
        "remote_lock",
        "evidence_capture",
        "device_health",
        "recovery_leaderboard",
        "community_bounties",
        "digital_inheritance",
        "ai_theft_prediction",
        "gift_subscription",
        "priority_support",
    ],
}

TIER_MAP = {
    "free": FREE_TIER,
    "personal": PERSONAL_TIER,
    "family": FAMILY_TIER,
}


# ─── Models ──────────────────────────────────────────────────────────────────


class PaymentInitRequest(BaseModel):
    plan: str  # "personal_monthly", "personal_yearly", etc.
    email: str
    callback_url: Optional[str] = None


class PaymentInitResponse(BaseModel):
    authorization_url: str
    access_code: str
    reference: str


class SubscriptionStatus(BaseModel):
    plan: str
    status: str  # "active", "inactive", "cancelled", "expired"
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    tier: str  # "free", "personal", "family"


# ─── Paystack API Helpers ───────────────────────────────────────────────────


def _paystack_headers() -> dict:
    return {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


def generate_reference() -> str:
    """Generate a unique transaction reference."""
    return f"mgn_{secrets.token_hex(12)}_{int(datetime.now(timezone.utc).timestamp())}"


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify Paystack webhook signature using HMAC-SHA512."""
    if not PAYSTACK_WEBHOOK_SECRET:
        return False
    computed = hmac.new(
        PAYSTACK_WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(computed, signature)


def get_user_tier(user_data: dict) -> str:
    """Determine user's tier from their subscription data."""
    plan = user_data.get("subscription_plan", "free")
    status = user_data.get("subscription_status", "inactive")

    if status != "active" or not plan or plan == "free":
        return "free"

    if plan.startswith("personal"):
        return "personal"
    elif plan.startswith("family"):
        return "family"

    return "free"


def get_tier_limits(tier: str) -> dict:
    """Get the feature limits for a given tier."""
    return TIER_MAP.get(tier, FREE_TIER)
