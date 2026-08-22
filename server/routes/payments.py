"""
Magneetar Payment Routes
Handles Paystack payment flow for subscriptions.
"""

import json
import logging
import os
from datetime import datetime, timezone

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException, Request
from payments import (
    PAYSTACK_PUBLIC_KEY,
    PLANS,
    PaymentInitRequest,
    PaymentInitResponse,
    SubscriptionStatus,
    generate_reference,
    get_tier_limits,
    get_user_tier,
    verify_webhook_signature,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])


# ─── Initialize Payment ─────────────────────────────────────────────────────


@router.post("/initialize", response_model=PaymentInitResponse)
async def initialize_payment(
    req: PaymentInitRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Initialize a Paystack payment for a subscription plan.

    Returns authorization_url for redirecting the user to Paystack's checkout.
    """
    import httpx

    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {req.plan}")

    if not PAYSTACK_PUBLIC_KEY:
        raise HTTPException(
            status_code=503,
            detail="Payments not configured. Contact support.",
        )

    plan = PLANS[req.plan]
    reference = generate_reference()

    user_id = user_id_from_subject(auth)

    # Initialize transaction with Paystack
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.paystack.co/transaction/initialize",
            headers={
                "Authorization": f"Bearer {os.getenv('MT_PAYSTACK_SECRET_KEY', '')}",
                "Content-Type": "application/json",
            },
            json={
                "amount": plan["amount"],
                "email": req.email,
                "currency": plan["currency"],
                "reference": reference,
                "metadata": {
                    "user_id": user_id,
                    "plan": req.plan,
                    "plan_name": plan["name"],
                    "custom_fields": [
                        {
                            "display_name": "Plan",
                            "variable_name": "plan",
                            "value": plan["name"],
                        }
                    ],
                },
                "callback_url": req.callback_url
                or f"{os.getenv('MT_FRONTEND_URL', 'https://magneetar.me')}/dashboard?payment=success",
            },
            timeout=30,
        )

    if resp.status_code != 200:
        logger.error("Paystack init failed: %s", resp.text)
        raise HTTPException(status_code=502, detail="Payment initialization failed")

    data = resp.json()
    if not data.get("status"):
        raise HTTPException(
            status_code=502,
            detail=data.get("message", "Payment initialization failed"),
        )

    return PaymentInitResponse(
        authorization_url=data["data"]["authorization_url"],
        access_code=data["data"]["access_code"],
        reference=reference,
    )


# ─── Verify Payment ─────────────────────────────────────────────────────────


@router.get("/verify/{reference}")
async def verify_payment(
    reference: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Verify a payment transaction and activate subscription."""
    import httpx

    user_id = user_id_from_subject(auth)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.paystack.co/transaction/verify/{reference}",
            headers={
                "Authorization": f"Bearer {os.getenv('MT_PAYSTACK_SECRET_KEY', '')}",
            },
            timeout=30,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Payment verification failed")

    data = resp.json()
    if not data.get("status") or not data["data"].get("status") == "success":
        raise HTTPException(
            status_code=400,
            detail=f"Payment not successful: {data.get('message', 'unknown')}",
        )

    tx_data = data["data"]
    metadata = tx_data.get("metadata", {})
    plan = metadata.get("plan", "personal_monthly")

    # Update user subscription in database
    now = datetime.now(timezone.utc)
    period_end = _calculate_period_end(plan, now)

    with get_db_context() as db:
        db.execute(
            """
            UPDATE users SET
                subscription_plan = ?,
                subscription_status = 'active',
                subscription_started = ?,
                subscription_expires = ?,
                paystack_reference = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (plan, now.isoformat(), period_end.isoformat(), reference, now.isoformat(), user_id),
        )
        db.commit()

    return {
        "ok": True,
        "plan": plan,
        "status": "active",
        "period_end": period_end.isoformat(),
    }


# ─── Subscription Status ────────────────────────────────────────────────────


@router.get("/subscription", response_model=SubscriptionStatus)
async def get_subscription_status(
    auth: str = Depends(require_dashboard_auth),
):
    """Get the current user's subscription status."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        row = db.execute(
            """
            SELECT subscription_plan, subscription_status,
                   subscription_started, subscription_expires
            FROM users WHERE id = ?
            """,
            (user_id,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    tier = get_user_tier(
        {
            "subscription_plan": row[0] or "free",
            "subscription_status": row[1] or "inactive",
        }
    )

    return SubscriptionStatus(
        plan=row[0] or "free",
        status=row[1] or "inactive",
        current_period_start=row[2],
        current_period_end=row[3],
        tier=tier,
    )


# ─── Tier Limits ────────────────────────────────────────────────────────────


@router.get("/tier-limits")
async def get_tier_limits_endpoint(
    auth: str = Depends(require_dashboard_auth),
):
    """Get feature limits for the user's current tier."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        row = db.execute(
            "SELECT subscription_plan, subscription_status FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    tier = get_user_tier(
        {
            "subscription_plan": row[0] if row else "free",
            "subscription_status": row[1] if row else "inactive",
        }
    )

    return {
        "tier": tier,
        "limits": get_tier_limits(tier),
    }


# ─── Webhook ────────────────────────────────────────────────────────────────


@router.post("/webhook")
async def paystack_webhook(request: Request):
    """Handle Paystack webhook events.

    Events handled:
    - charge.success → activate subscription
    - invoice.payment_failed → deactivate subscription
    - subscription.create → record subscription
    """
    body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    if not verify_webhook_signature(body, signature):
        logger.warning("Invalid Paystack webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event = json.loads(body)
    event_type = event.get("event", "")
    data = event.get("data", {})

    logger.info("Paystack webhook: %s", event_type)

    if event_type == "charge.success":
        await _handle_charge_success(data)
    elif event_type == "invoice.payment_failed":
        await _handle_payment_failed(data)
    elif event_type == "subscription.create":
        await _handle_subscription_create(data)
    else:
        logger.info("Unhandled Paystack event: %s", event_type)

    return {"ok": True}


async def _handle_charge_success(data: dict):
    """Activate subscription after successful charge."""
    metadata = data.get("metadata", {})
    user_id = metadata.get("user_id")
    plan = metadata.get("plan")

    if not user_id or not plan:
        logger.warning("charge.success missing metadata: %s", data.get("reference"))
        return

    now = datetime.now(timezone.utc)
    period_end = _calculate_period_end(plan, now)

    with get_db_context() as db:
        db.execute(
            """
            UPDATE users SET
                subscription_plan = ?,
                subscription_status = 'active',
                subscription_started = ?,
                subscription_expires = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (plan, now.isoformat(), period_end.isoformat(), now.isoformat(), user_id),
        )
        db.commit()

    logger.info("Subscription activated: user=%s plan=%s", user_id, plan)


async def _handle_payment_failed(data: dict):
    """Deactivate subscription after failed payment."""
    customer = data.get("customer", {})
    customer_code = customer.get("customer_code")

    if not customer_code:
        return

    with get_db_context() as db:
        db.execute(
            """
            UPDATE users SET
                subscription_status = 'inactive',
                updated_at = ?
            WHERE paystack_customer_code = ?
            """,
            (datetime.now(timezone.utc).isoformat(), customer_code),
        )
        db.commit()

    logger.info("Subscription deactivated: customer=%s", customer_code)


async def _handle_subscription_create(data: dict):
    """Record new subscription."""
    # This is handled by charge.success, but we log it for auditing
    logger.info("Subscription created: %s", data.get("subscription_code"))


def _calculate_period_end(plan: str, start: datetime) -> datetime:
    """Calculate subscription period end date based on plan."""
    if "yearly" in plan:
        return start.replace(year=start.year + 1)
    else:
        # Add 1 month
        if start.month == 12:
            return start.replace(year=start.year + 1, month=1)
        return start.replace(month=start.month + 1)
