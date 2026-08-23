"""
Magneetar USSD Payment Integration
Subscribe to Magneetar via USSD — no smartphone needed.

How it works:
1. User dials *123*5# (Magneetar USSD code)
2. Selects a plan (Personal ₦1,500 or Family ₦3,000)
3. Confirms payment
4. Telco deducts from airtime balance
5. Magneetar activates subscription
6. User receives confirmation SMS

Integration with Nigerian telcos:
- MTN: MoMo (Mobile Money) USSD billing
- Airtel: SmartCash USSD billing
- Glo: GloCash USSD billing
- 9mobile: 9Pay USSD billing

Nigeria switched to end-user USSD billing in June 2025:
- Users pay directly from airtime
- No bank account required
- Works on 2G/3G feature phones

Revenue model:
- Telco takes 2-5% transaction fee
- Magneetar receives 95-98% of subscription price
- Settlement: Monthly via bank transfer
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone

from database import get_db_context
from fastapi import APIRouter, Form, Request
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ussd/payments", tags=["ussd_payments"])


# ─── USSD Payment Menu ──────────────────────────────────────────────────────


@router.post("/callback")
async def ussd_payment_callback(
    request: Request,
    sessionId: str = Form(""),
    phoneNumber: str = Form(""),
    networkCode: str = Form(""),
    text: str = Form(""),
):
    """Handle USSD payment callback.

    Menu flow:
    *123*5# → Main Menu
      1 → Personal Plan (₦1,500/mo)
        1 → Confirm
        2 → Cancel
      2 → Family Plan (₦3,000/mo)
        1 → Confirm
        2 → Cancel
      3 → Check Subscription Status
      4 → Help
      0 → Exit
    """
    parts = text.split("*") if text else []

    # Route based on menu selection
    try:
        if not parts or text == "":
            response = show_payment_menu()
        elif parts[0] == "1":
            response = handle_plan_selection("personal", parts, phoneNumber)
        elif parts[0] == "2":
            response = handle_plan_selection("family", parts, phoneNumber)
        elif parts[0] == "3":
            response = handle_subscription_status(phoneNumber)
        elif parts[0] == "4":
            response = show_help()
        elif parts[-1] == "0":
            response = "END Thank you for using Magneetar. Stay safe!"
        else:
            response = show_payment_menu()
    except Exception as e:
        logger.error(f"USSD payment error: {e}")
        response = "CON Sorry, an error occurred. Please try again.\n\n0. Exit"

    return PlainTextResponse(response, media_type="text/plain")


# ─── Menu Handlers ───────────────────────────────────────────────────────────


def show_payment_menu() -> str:
    """Display the payment menu."""
    return (
        "CON Magneetar Subscription\n"
        "━━━━━━━━━━━━━━━━━━━━━━━\n"
        "1. Personal — ₦1,500/mo\n"
        "   3 devices, 3-sec tracking\n\n"
        "2. Family — ₦3,000/mo\n"
        "   10 devices, unlimited\n\n"
        "3. Check Status\n"
        "4. Help\n\n"
        "0. Exit"
    )


def handle_plan_selection(plan: str, parts: list, phone: str) -> str:
    """Handle plan selection and confirmation."""
    if len(parts) == 1:
        # User selected plan — show confirmation
        if plan == "personal":
            return (
                "CON Personal Plan — ₦1,500/month\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "✓ 3 devices\n"
                "✓ 3-second GPS tracking\n"
                "✓ Smart geofencing\n"
                "✓ Family circles (5 members)\n"
                "✓ Panic button\n"
                "✓ Trust Score check\n\n"
                "Confirm payment from your airtime?\n\n"
                "1. Confirm — Pay ₦1,500\n"
                "2. Cancel"
            )
        else:
            return (
                "CON Family Plan — ₦3,000/month\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "✓ 10 devices\n"
                "✓ Unlimited GPS tracking\n"
                "✓ Smart geofencing\n"
                "✓ Unlimited family members\n"
                "✓ Digital inheritance\n"
                "✓ Panic button\n"
                "✓ Trust Score check\n"
                "✓ Priority support\n\n"
                "Confirm payment from your airtime?\n\n"
                "1. Confirm — Pay ₦3,000\n"
                "2. Cancel"
            )

    elif len(parts) == 2:
        # User confirmed or cancelled
        if parts[1] == "1":
            # Process payment
            result = process_ussd_payment(plan, phone)
            return f"END {result}"
        elif parts[1] == "2":
            return "END Payment cancelled. No charge was made."
        else:
            return "END Invalid option. Please try again."

    return show_payment_menu()


def handle_subscription_status(phone: str) -> str:
    """Check subscription status for a phone number."""
    with get_db_context() as db:
        # Look up user by phone number
        user = db.execute(
            "SELECT id, name, subscription_plan, subscription_expires FROM users WHERE phone = ?",
            (phone,),
        ).fetchone()

    if not user:
        return "END No Magneetar account found for this number.\n\n" "Download the app or dial *123*5# to subscribe."

    plan = user[2] or "free"
    expires = user[3]

    if plan == "free" or not expires:
        return f"END Account: {user[1]}\n" f"Plan: Free\n" f"Upgrade: Dial *123*5#"

    return f"END Account: {user[1]}\n" f"Plan: {plan.title()}\n" f"Expires: {expires}\n" f"Devices: Active"


def show_help() -> str:
    """Show help information."""
    return (
        "END Magneetar Help\n"
        "━━━━━━━━━━━━━━━━\n"
        "Dial *123*5# to subscribe\n"
        "Plans start from ₦1,500/mo\n\n"
        "Download the app:\n"
        "magneetar.me/download\n\n"
        "Support: support@magneetar.me"
    )


# ─── Payment Processing ─────────────────────────────────────────────────────


def process_ussd_payment(plan: str, phone: str) -> str:
    """Process USSD payment via telco airtime deduction.

    In production, this would:
    1. Call the telco's USSD payment API
    2. Wait for callback confirmation
    3. Activate subscription on success
    4. Send confirmation SMS
    """
    now = datetime.now(timezone.utc)

    if plan == "personal":
        amount = 1500
        plan_name = "personal"
        days = 30
    else:
        amount = 3000
        plan_name = "family"
        days = 30

    expires = (now + timedelta(days=days)).isoformat()
    payment_id = f"pay_{secrets.token_hex(8)}"

    with get_db_context() as db:
        # Create payments table if not exists
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS ussd_payments (
                id TEXT PRIMARY KEY,
                phone TEXT NOT NULL,
                plan TEXT NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                telco TEXT,
                network_code TEXT,
                created_at TEXT NOT NULL,
                completed_at TEXT
            )
        """
        )

        # Record the payment attempt
        db.execute(
            """
            INSERT INTO ussd_payments (id, phone, plan, amount, status, created_at)
            VALUES (?, ?, ?, ?, 'pending', ?)
        """,
            (payment_id, phone, plan_name, amount, now.isoformat()),
        )

        # Update user subscription (if user exists)
        db.execute(
            """
            UPDATE users SET
                subscription_plan = ?,
                subscription_expires = ?,
                subscription_method = 'ussd'
            WHERE phone = ?
        """,
            (plan_name, expires, phone),
        )

        db.commit()

    # In production, this would call the telco API
    # For now, simulate successful payment
    logger.info(f"USSD payment initiated: {payment_id} ({plan_name} ₦{amount}) from {phone}")

    return (
        f"✅ PAYMENT SUCCESSFUL\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Plan: {plan_name.title()} — ₦{amount:,}/month\n"
        f"Payment ID: {payment_id}\n"
        f"Expires: {expires[:10]}\n\n"
        f"Your Magneetar subscription is now active!\n"
        f"Download the app: magneetar.me/download\n\n"
        f"Thank you for choosing Magneetar!"
    )


# ─── Telco Webhook (Payment Confirmation) ───────────────────────────────────


@router.post("/webhook")
async def payment_webhook(request: Request):
    """Receive payment confirmation from telco USSD gateway.

    The telco calls this endpoint when a payment is confirmed or failed.
    """
    body = await request.json()

    payment_id = body.get("payment_id", "")
    status = body.get("status", "")  # "completed" or "failed"
    telco = body.get("telco", "")  # "mtn", "airtel", "glo", "9mobile"
    network_code = body.get("network_code", "")

    if not payment_id:
        return {"status": "error", "message": "Missing payment_id"}

    with get_db_context() as db:
        db.execute(
            """
            UPDATE ussd_payments SET
                status = ?,
                telco = ?,
                network_code = ?,
                completed_at = ?
            WHERE id = ?
        """,
            (status, telco, network_code, datetime.now(timezone.utc).isoformat(), payment_id),
        )

        # If payment completed, activate subscription
        if status == "completed":
            payment = db.execute(
                "SELECT phone, plan, amount FROM ussd_payments WHERE id = ?",
                (payment_id,),
            ).fetchone()

            if payment:
                expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                db.execute(
                    """
                    UPDATE users SET
                        subscription_plan = ?,
                        subscription_expires = ?,
                        subscription_method = 'ussd'
                    WHERE phone = ?
                """,
                    (payment[1], expires, payment[0]),
                )

        db.commit()

    logger.info(f"USSD payment webhook: {payment_id} → {status}")
    return {"status": "ok"}
