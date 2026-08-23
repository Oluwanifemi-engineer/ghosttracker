"""
Magneetar WhatsApp Bot
IMSI-first design for Nigeria — WhatsApp is the #1 messaging app.

Features:
- IMEI Trust Score check (send IMEI, get trust score)
- Device registration status check
- Theft report via WhatsApp
- Bounty status check
- Family circle location share
- Download link

Flow:
1. User sends message to Magneetar WhatsApp number
2. Bot parses intent (IMEI check, report theft, etc.)
3. Bot responds with formatted result
4. User can interact via numbered menu

Integration:
- Uses WhatsApp Business API (Meta Cloud API)
- Webhook endpoint receives messages
- Bot processes and responds via API
"""

import hashlib
import logging
import re
import secrets
from datetime import datetime, timezone
from typing import Optional

from database import get_db_context
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


# ─── WhatsApp Webhook Verification ──────────────────────────────────────────


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = "",
    hub_verify_token: str = "",
    hub_challenge: str = "",
):
    """WhatsApp webhook verification — Meta calls this to verify the endpoint.

    The verify token must match the one configured in Meta's developer console.
    """
    from config import settings

    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


# ─── WhatsApp Webhook Receiver ──────────────────────────────────────────────


@router.post("/webhook")
async def receive_whatsapp_message(request: Request):
    """Receive incoming WhatsApp messages and respond.

    This is the main webhook endpoint. Meta sends POST requests here
    when users message the Magneetar WhatsApp number.
    """
    from config import settings

    body = await request.json()

    # Verify webhook signature (X-Hub-Signature-256)
    signature = request.headers.get("X-Hub-Signature-256", "")
    if settings.WHATSAPP_APP_SECRET:
        raw_body = await request.body()
        expected = "sha256=" + hashlib.sha256((settings.WHATSAPP_APP_SECRET.encode() + raw_body)).hexdigest()
        if signature != expected:
            logger.warning("WhatsApp webhook signature mismatch")
            raise HTTPException(status_code=403, detail="Invalid signature")

    # Parse the message
    try:
        entry = body["entry"][0]
        changes = entry["changes"][0]
        value = changes["value"]

        messages = value.get("messages", [])
        if not messages:
            return {"status": "ok"}

        message = messages[0]
        sender_phone = message["from"]
        msg_type = message["type"]

        if msg_type == "text":
            text = message["text"]["body"].strip()
        elif msg_type == "image":
            text = "[image]"
        elif msg_type == "document":
            text = "[document]"
        else:
            text = ""

        if not text:
            return {"status": "ok"}

        # Process the message
        response = await process_message(text, sender_phone)

        # Send response via WhatsApp API
        if response:
            await send_whatsapp_message(sender_phone, response)

    except Exception as e:
        logger.error(f"WhatsApp webhook error: {e}")

    return {"status": "ok"}


# ─── Message Processing ──────────────────────────────────────────────────────


async def process_message(text: str, sender_phone: str) -> Optional[str]:
    """Parse user intent and generate response."""
    text_lower = text.lower().strip()

    # ── IMEI Check ───────────────────────────────────────────────────────
    # User sends a 15-digit IMEI number
    imei_match = re.search(r"\b(\d{15})\b", text)
    if imei_match:
        imei = imei_match.group(1)
        return await handle_imei_check(imei)

    # ── Menu Commands ────────────────────────────────────────────────────
    if text_lower in ("menu", "help", "start", "hi", "hello"):
        return get_welcome_menu()

    if text_lower in ("1", "check", "verify"):
        return (
            "📱 *IMEI Check*\n\n"
            "Send me a 15-digit IMEI number and I'll check its trust score.\n\n"
            "Dial *#06# on any phone to find the IMEI."
        )

    if text_lower in ("2", "report", "theft", "stolen"):
        return (
            "🚨 *Report Theft*\n\n"
            "To report a stolen phone, send:\n"
            "REPORT [IMEI] [LOCATION]\n\n"
            "Example: REPORT 123456789012345 Lagos\n\n"
            "We'll flag this IMEI as stolen in our database."
        )

    if text_lower in ("3", "bounty", "reward"):
        return (
            "💰 *Recovery Bounty*\n\n"
            "Post a bounty to recover your phone:\n"
            "BOUNTY [AMOUNT] [DEVICE NAME]\n\n"
            "Example: BOUNTY 50000 Samsung Galaxy\n\n"
            "Nearby Magneetar users will be notified."
        )

    if text_lower in ("4", "location", "track"):
        return (
            "📍 *Location Check*\n\n"
            "To check a device's location, send:\n"
            "LOCATE [DEVICE NAME]\n\n"
            "Example: LOCATE My Phone\n\n"
            "You must be registered on Magneetar."
        )

    if text_lower in ("5", "download", "install"):
        return (
            "📲 *Download Magneetar*\n\n"
            "Get the app for free:\n"
            "https://magneetar.me/download\n\n"
            "Protect your phone with military-grade anti-theft tracking."
        )

    if text_lower in ("6", "price", "plan", "subscribe"):
        return (
            "💳 *Magneetar Plans*\n\n"
            "🆓 *Free* — ₦0\n"
            "• 1 device, 5-min tracking\n"
            "• Trust Score check\n\n"
            "⭐ *Personal* — ₦1,500/mo\n"
            "• 3 devices, 3-sec tracking\n"
            "• Smart geofencing\n\n"
            "👨‍👩‍👧‍👦 *Family* — ₦3,000/mo\n"
            "• 10 devices, unlimited tracking\n"
            "• Digital inheritance\n\n"
            "Upgrade: https://magneetar.me/download"
        )

    if text_lower in ("7", "support", "help me"):
        return (
            "🆘 *Support*\n\n"
            "For help, visit:\n"
            "https://magneetar.me/support\n\n"
            "Or email: support@magneetar.me\n\n"
            "We respond within 24 hours."
        )

    # ── REPORT Command ───────────────────────────────────────────────────
    report_match = re.match(r"report\s+(\d{15})\s*(.*)", text_lower, re.IGNORECASE)
    if report_match:
        imei = report_match.group(1)
        location = report_match.group(2).strip() or "Unknown"
        return await handle_theft_report(imei, location, sender_phone)

    # ── BOUNTY Command ───────────────────────────────────────────────────
    bounty_match = re.match(r"bounty\s+(\d+)\s*(.*)", text_lower, re.IGNORECASE)
    if bounty_match:
        amount = int(bounty_match.group(1))
        device_name = bounty_match.group(2).strip() or "My Phone"
        return await handle_bounty_create(amount, device_name, sender_phone)

    # ── LOCATE Command ───────────────────────────────────────────────────
    locate_match = re.match(r"locate\s+(.*)", text_lower, re.IGNORECASE)
    if locate_match:
        device_name = locate_match.group(1).strip()
        return await handle_locate(device_name, sender_phone)

    # ── Default / Unknown ────────────────────────────────────────────────
    return get_welcome_menu()


# ─── Handler Functions ───────────────────────────────────────────────────────


async def handle_imei_check(imei: str) -> str:
    """Check IMEI trust score and return formatted response."""
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]

    with get_db_context() as db:
        # Check theft reports
        theft_reports = db.execute(
            "SELECT COUNT(*) FROM theft_status_reports WHERE imei_hash = ? AND status = 'active'",
            (imei_hash,),
        ).fetchone()[0]

        # Check trust score
        record = db.execute(
            "SELECT trust_score, status, device_brand, device_model FROM trust_scores WHERE imei_hash = ?",
            (imei_hash,),
        ).fetchone()

    if record:
        score = record[0]
        status = record[1]
        brand = record[2] or ""
        model = record[3] or ""

        if status == "stolen":
            return (
                f"🚨 *STOLEN PHONE*\n\n"
                f"IMEI: {imei}\n"
                f"Trust Score: {score}/100\n"
                f"Status: REPORTED STOLEN\n\n"
                f"This device has been reported stolen. "
                f"If you purchased this device, contact the nearest police station."
            )
        elif status == "clean":
            device_info = f"Brand: {brand}\nModel: {model}\n" if brand else ""
            return (
                f"✅ *VERIFIED CLEAN*\n\n"
                f"IMEI: {imei}\n"
                f"Trust Score: {score}/100\n"
                f"{device_info}"
                f"No theft reports. This device appears safe."
            )
        else:
            return (
                f"⚠️ *UNKNOWN STATUS*\n\n"
                f"IMEI: {imei}\n"
                f"Trust Score: {score}/100\n"
                f"Status: {status.upper()}\n\n"
                f"This device is not fully verified. Proceed with caution."
            )
    else:
        # No record found
        if theft_reports > 0:
            return (
                f"🚨 *STOLEN PHONE*\n\n"
                f"IMEI: {imei}\n"
                f"Theft Reports: {theft_reports}\n\n"
                f"This device has been reported stolen!"
            )
        else:
            return (
                f"❓ *NO DATA*\n\n"
                f"IMEI: {imei}\n\n"
                f"This IMEI is not in our database. "
                f"It may not be registered with Magneetar.\n\n"
                f"Download Magneetar to protect your phone: "
                f"https://magneetar.me/download"
            )


async def handle_theft_report(imei: str, location: str, sender_phone: str) -> str:
    """Report a theft via WhatsApp."""
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]
    report_id = f"rpt_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
        # Create table if not exists
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
                created_at TEXT NOT NULL
            )
        """
        )

        db.execute(
            """
            INSERT INTO theft_status_reports (id, imei_hash, theft_date, theft_location, status, created_at)
            VALUES (?, ?, ?, ?, 'active', ?)
        """,
            (report_id, imei_hash, now, location, now),
        )

        # Update trust score
        db.execute(
            """
            INSERT INTO trust_scores (imei_hash, trust_score, status, theft_reported, theft_report_date, created_at)
            VALUES (?, 10, 'stolen', 1, ?, ?)
            ON CONFLICT(imei_hash) DO UPDATE SET
                trust_score = 10, status = 'stolen',
                theft_reported = theft_reported + 1, theft_report_date = ?
        """,
            (imei_hash, now, now, now),
        )

        db.commit()

    return (
        f"✅ *THEFT REPORTED*\n\n"
        f"IMEI: {imei}\n"
        f"Location: {location}\n"
        f"Report ID: {report_id}\n\n"
        f"This IMEI has been flagged as stolen. "
        f"Anyone checking this IMEI will see the stolen status.\n\n"
        f"For police report assistance, visit:\n"
        f"https://magneetar.me/support"
    )


async def handle_bounty_create(amount: int, device_name: str, sender_phone: str) -> str:
    """Create a recovery bounty via WhatsApp."""
    if amount < 1000:
        return "❌ Minimum bounty is ₦1,000. Please try again with a higher amount."

    if amount > 500000:
        return "❌ Maximum bounty is ₦500,000. Please try again with a lower amount."

    # Note: In production, this would require authentication
    # For now, return instructions
    return (
        f"💰 *BOUNTY REQUEST*\n\n"
        f"Amount: ₦{amount:,}\n"
        f"Device: {device_name}\n\n"
        f"To complete your bounty, please:\n"
        f"1. Open the Magneetar app\n"
        f"2. Go to Bounties\n"
        f"3. Post your bounty with payment\n\n"
        f"Or visit: https://magneetar.me/download"
    )


async def handle_locate(device_name: str, sender_phone: str) -> str:
    """Locate a device by name."""
    # Note: In production, this would require authentication
    return (
        f"📍 *LOCATE DEVICE*\n\n"
        f"Device: {device_name}\n\n"
        f"To locate your device, please:\n"
        f"1. Open the Magneetar app\n"
        f"2. Go to Dashboard\n"
        f"3. Select your device\n\n"
        f"Or visit: https://magneetar.me/dashboard"
    )


def get_welcome_menu() -> str:
    """Return the welcome menu."""
    return (
        "🛡️ *MAGNEETAR — Phone Safety*\n\n"
        "Welcome to Magneetar! How can I help you?\n\n"
        "1️⃣ *Check IMEI* — Verify a phone's trust score\n"
        "2️⃣ *Report Theft* — Report a stolen phone\n"
        "3️⃣ *Recovery Bounty* — Post a reward for finding your phone\n"
        "4️⃣ *Locate Device* — Find your phone's location\n"
        "5️⃣ *Download App* — Get Magneetar for free\n"
        "6️⃣ *Pricing* — View plans and pricing\n"
        "7️⃣ *Support* — Get help\n\n"
        "📱 *Quick Check:* Just send a 15-digit IMEI number to check its trust score instantly!\n\n"
        "Dial *#06# on any phone to find the IMEI."
    )


# ─── Send Message Helper ─────────────────────────────────────────────────────


async def send_whatsapp_message(phone: str, message: str):
    """Send a message via WhatsApp Business API.

    Uses Meta Cloud API with the configured access token.
    """
    import httpx
    from config import settings

    if not settings.WHATSAPP_ACCESS_TOKEN:
        logger.warning("WhatsApp access token not configured — message not sent")
        return

    url = f"https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": message},
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code != 200:
                logger.error(f"WhatsApp send failed: {resp.status_code} {resp.text}")
        except Exception as e:
            logger.error(f"WhatsApp send error: {e}")
