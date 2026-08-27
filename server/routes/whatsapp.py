"""
Magneetar WhatsApp Bot — Minimal.

WhatsApp is how Nigerians communicate. This bot lets owners control
their devices by sending simple text commands.

Commands:
  LOCK <phone>   — Lock a device
  UNLOCK <phone> — Unlock a device
  SOS <phone>    — Trigger alarm + capture evidence
  STATUS <phone> — Check device status
  HELP           — Show commands

Integration: WhatsApp Business API (Meta Cloud API) webhook.
"""

import logging
import re
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
    """Meta calls this to verify the webhook endpoint."""
    from config import settings

    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


# ─── WhatsApp Webhook Receiver ──────────────────────────────────────────────


@router.post("/webhook")
async def receive_whatsapp_message(request: Request):
    """Receive incoming WhatsApp messages and respond."""
    body = await request.json()

    # Extract message
    try:
        entry = body["entry"][0]
        changes = entry["changes"][0]
        value = changes["value"]
        messages = value.get("messages", [])
        if not messages:
            return {"status": "ok"}
        msg = messages[0]
        phone = msg["from"]
        text = msg["text"]["body"].strip().upper()
    except (KeyError, IndexError):
        return {"status": "ok"}

    # Parse and respond
    response = _handle_command(text, phone)
    if response:
        await _send_whatsapp_message(phone, response)

    return {"status": "ok"}


def _handle_command(text: str, phone: str) -> Optional[str]:
    """Parse command and return response text."""
    parts = text.split()
    if not parts:
        return None

    cmd = parts[0]

    if cmd == "HELP":
        return (
            "Magneetar Commands:\n\n"
            "LOCK <number> — Lock a device\n"
            "UNLOCK <number> — Unlock a device\n"
            "SOS <number> — Trigger alarm + capture\n"
            "STATUS <number> — Check device status\n"
            "HELP — Show this message"
        )

    if cmd in ("LOCK", "UNLOCK", "SOS", "STATUS"):
        if len(parts) < 2:
            return f"Usage: {cmd} <phone number>\nExample: {cmd} 08012345678"
        target_phone = parts[1]
        return _execute_command(cmd.lower(), target_phone, phone)

    return "I didn't understand that. Send HELP to see available commands."


def _execute_command(cmd: str, target_phone: str, sender_phone: str) -> str:
    """Execute a command on a device."""
    # Normalize phone number
    target_phone = re.sub(r"[^\d]", "", target_phone)
    if len(target_phone) < 10:
        return "Invalid phone number. Use format: 08012345678"

    device = _find_device_by_phone(target_phone)
    if not device:
        return (
            f"No Magneetar device found for {target_phone}.\n"
            "The device must have Magneetar installed and registered."
        )

    if cmd == "status":
        last_seen = device["last_seen"] or "Never"
        score = device["sentinel_score"] or 0
        status = "STOLEN" if score >= 70 else "At risk" if score >= 40 else "Safe"
        return (
            f"Device: {device['model']}\n" f"Status: {status}\n" f"Last seen: {last_seen}\n" f"Theft score: {score}/100"
        )

    # Map command to internal command name
    command_map = {
        "lock": "lock",
        "unlock": "unlock",
        "siren": "alarm",
        "sos": "alarm",
    }
    internal_cmd = command_map.get(cmd)
    if not internal_cmd:
        return "Unknown command."

    _issue_command(device["id"], internal_cmd)

    if cmd == "sos":
        # Also capture evidence on SOS
        _issue_command(device["id"], "capture_photo_front")
        _issue_command(device["id"], "capture_audio")
        return (
            f"EMERGENCY command sent to {device['model']}.\n"
            "Siren triggered + evidence capture activated.\n"
            "The phone will respond on next connection."
        )

    return f"{cmd.upper()} command sent to {device['model']}.\nWill execute on next connection."


def _find_device_by_phone(phone: str) -> Optional[dict]:
    """Find a device by its registered phone number."""
    with get_db_context() as db:
        row = db.execute(
            "SELECT id, model, last_seen, sentinel_score FROM devices WHERE sms_phone=?",
            (phone,),
        ).fetchone()
    return dict(row) if row else None


def _issue_command(device_id: str, command: str) -> bool:
    """Queue a command for a device."""
    from datetime import timedelta

    with get_db_context() as db:
        now = datetime.now(timezone.utc).isoformat()
        expires = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        db.execute(
            "INSERT INTO commands"
            " (device_id, command, params, status, priority,"
            " issued_at, expires_at, delivery_channel)"
            " VALUES (?, ?, '', 'pending', 0, ?, ?, 'poll')",
            (device_id, command, now, expires),
        )
        db.commit()
    return True


async def _send_whatsapp_message(to: str, text: str):
    """Send a WhatsApp message via Meta Cloud API."""
    import httpx
    from config import settings

    if not settings.WHATSAPP_ACCESS_TOKEN:
        logger.warning("WhatsApp access token not configured — message not sent")
        return

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
                headers={
                    "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": to,
                    "type": "text",
                    "text": {"body": text},
                },
                timeout=10,
            )
    except Exception as e:
        logger.error(f"Failed to send WhatsApp message: {e}")
