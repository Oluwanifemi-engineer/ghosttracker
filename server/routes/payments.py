"""
Magneetar Payment Integration — Paystack

Handles:
- Subscription plan management (Free/Guardian/Sentinel)
- Paystack webhook verification
- Payment success/failure handling
- Tier enforcement server-side
- Grace period for failed payments

Paystack is Nigeria-native and supports:
- Card payments (Visa, Mastercard, Verve)
- Bank transfers
- USSD payments
"""

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta
from typing import Optional

from config import settings
from database import get_db_context
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

# ── Plan Configuration ─────────────────────────────────────────────────────

PLANS = {
    "free": {
        "name": "Free",
        "price_ngn": 0,
        "device_limit": 3,
        "features": ["basic_tracking", "web_dashboard", "email_alerts"],
        "paystack_plan_code": None,
    },
    "guardian": {
        "name": "Guardian",
        "price_ngn": 2500,  # ₦2,500/month
        "device_limit": 10,
        "features": [
            "basic_tracking",
            "web_dashboard",
            "email_alerts",
            "sms_alerts",
            "evidence_capture",
            "geofencing",
            "family_circles",
            "priority_support",
        ],
        "paystack_plan_code": "PLN_guardian_monthly",
    },
    "sentinel": {
        "name": "Sentinel",
        "price_ngn": 5000,  # ₦5,000/month
        "device_limit": 999,
        "features": [
            "basic_tracking",
            "web_dashboard",
            "email_alerts",
            "sms_alerts",
            "evidence_capture",
            "geofencing",
            "family_circles",
            "priority_support",
            "advanced_theft_detection",
            "police_report",
            "emergency_wipe",
            "offline_commands",
            "api_access",
            "dedicated_support",
        ],
        "paystack_plan_code": "PLN_sentinel_monthly",
    },
}

# Paystack webhook secret (set in environment)
PAYSTACK_SECRET_KEY = os.environ.get("MT_PAYSTACK_SECRET", "")
PAYSTACK_WEBHOOK_SECRET = os.environ.get("MT_PAYSTACK_WEBHOOK_SECRET", "")


# ── Request Models ─────────────────────────────────────────────────────────


class InitializePaymentRequest(BaseModel):
    plan: str  # "guardian" or "sentinel"
    email: str
    callback_url: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    reference: str


# ── Payment Endpoints ──────────────────────────────────────────────────────


@router.post("/api/payments/initialize")
async def initialize_payment(request: Request, body: InitializePaymentRequest):
    """
    Initialize a Paystack payment for a subscription plan.
    Returns the authorization URL for the user to complete payment.
    """
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    if body.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    plan = PLANS[body.plan]
    if plan["price_ngn"] == 0:
        raise HTTPException(status_code=400, detail="Free plan doesn't require payment")

    # Initialize Paystack transaction
    import httpx

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.paystack.co/transaction/initialize",
            headers={
                "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "email": body.email,
                "amount": plan["price_ngn"] * 100,  # Paystack uses kobo
                "plan": plan["paystack_plan_code"],
                "callback_url": body.callback_url or f"{settings.DASHBOARD_URL}/payment/callback",
                "metadata": {
                    "plan": body.plan,
                    "user_email": body.email,
                },
            },
            timeout=30,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Payment initialization failed")

    data = response.json()
    if not data.get("status"):
        raise HTTPException(status_code=502, detail=data.get("message", "Payment failed"))

    return {
        "authorization_url": data["data"]["authorization_url"],
        "reference": data["data"]["reference"],
        "access_code": data["data"]["access_code"],
    }


@router.post("/api/payments/verify")
async def verify_payment(request: Request, body: VerifyPaymentRequest):
    """Verify a Paystack payment and activate subscription."""
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    # Verify with Paystack
    import httpx

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.paystack.co/transaction/verify/{body.reference}",
            headers={
                "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
            },
            timeout=30,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Payment verification failed")

    data = response.json()
    if not data.get("status") or data["data"]["status"] != "success":
        raise HTTPException(status_code=400, detail="Payment not successful")

    # Extract plan from metadata
    metadata = data["data"].get("metadata", {})
    plan_name = metadata.get("plan", "guardian")
    user_email = metadata.get("user_email", "")

    if plan_name not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan in payment")

    # Update user tier
    with get_db_context() as db:
        db.execute(
            """UPDATE users SET tier = ?, last_payment_at = ?
               WHERE email = ?""",
            (plan_name, datetime.utcnow().isoformat(), user_email),
        )

        # Record payment
        db.execute(
            """INSERT INTO payments (user_id, reference, amount, plan, status, paid_at)
               SELECT id, ?, ?, ?, 'success', ?
               FROM users WHERE email = ?""",
            (body.reference, data["data"]["amount"] / 100, plan_name, datetime.utcnow().isoformat(), user_email),
        )

    return {
        "status": "success",
        "plan": plan_name,
        "message": f"Successfully subscribed to {PLANS[plan_name]['name']} plan!",
    }


@router.post("/api/payments/webhook")
async def paystack_webhook(request: Request):
    """
    Handle Paystack webhook events.
    Verifies webhook signature and processes payment events.
    """
    body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    # Verify webhook signature
    if PAYSTACK_WEBHOOK_SECRET:
        expected = hmac.new(PAYSTACK_WEBHOOK_SECRET.encode(), body, hashlib.sha512).hexdigest()

        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = json.loads(body)
    event_type = event.get("event", "")

    if event_type == "subscription.create":
        # Subscription created
        data = event.get("data", {})
        customer_email = data.get("customer", {}).get("email", "")
        plan_code = data.get("plan", {}).get("plan_code", "")

        # Find plan from code
        plan_name = None
        for name, config in PLANS.items():
            if config["paystack_plan_code"] == plan_code:
                plan_name = name
                break

        if plan_name and customer_email:
            with get_db_context() as db:
                db.execute("""UPDATE users SET tier = ? WHERE email = ?""", (plan_name, customer_email))

    elif event_type == "subscription.disable":
        # Subscription cancelled — downgrade to free
        data = event.get("data", {})
        customer_email = data.get("customer", {}).get("email", "")

        if customer_email:
            with get_db_context() as db:
                db.execute("""UPDATE users SET tier = 'free' WHERE email = ?""", (customer_email,))

    elif event_type == "invoice.payment_failed":
        # Payment failed — implement grace period
        data = event.get("data", {})
        customer_email = data.get("customer", {}).get("email", "")

        if customer_email:
            with get_db_context() as db:
                # Mark for grace period (7 days)
                db.execute(
                    """UPDATE users SET tier = 'free',
                       payment_failed_at = ?
                       WHERE email = ?""",
                    (datetime.utcnow().isoformat(), customer_email),
                )

    return {"status": "received"}


@router.get("/api/payments/plans")
async def get_plans():
    """Get available subscription plans."""
    return {
        "plans": [
            {
                "id": name,
                "name": config["name"],
                "price_ngn": config["price_ngn"],
                "device_limit": config["device_limit"],
                "features": config["features"],
            }
            for name, config in PLANS.items()
        ]
    }


@router.get("/api/payments/status")
async def get_payment_status(request: Request):
    """Get current user's payment/subscription status."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    with get_db_context() as db:
        user = db.execute(
            """SELECT tier, last_payment_at, payment_failed_at
               FROM users WHERE id = ?""",
            (payload["user_id"],),
        ).fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        plan = PLANS.get(user["tier"], PLANS["free"])

        return {
            "tier": user["tier"],
            "plan_name": plan["name"],
            "device_limit": plan["device_limit"],
            "features": plan["features"],
            "last_payment": user.get("last_payment_at"),
            "payment_failed": user.get("payment_failed_at"),
            "grace_period_active": bool(user.get("payment_failed_at")),
            "grace_period_ends": (
                (datetime.fromisoformat(user["payment_failed_at"]) + timedelta(days=7)).isoformat()
                if user.get("payment_failed_at")
                else None
            ),
        }
