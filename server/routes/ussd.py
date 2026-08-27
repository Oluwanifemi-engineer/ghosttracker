"""
Magneetar USSD — Minimal menu for feature phones.

Reaches the 60% of Nigerians who use feature phones.
Works on 2G/3G, no internet required.

Menu:
  *123# → Main Menu
    1 → Check device status (enter phone number)
    2 → Lock my phone
    3 → Trigger siren
    0 → Back
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from database import get_db_context
from fastapi import APIRouter, Form, Request
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ussd", tags=["ussd"])

# In-memory session store (production: Redis)
_sessions: dict = {}


def _get_session(session_id: str, phone: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = {"phone": phone, "state": "main_menu", "data": {}}
    return _sessions[session_id]


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
            " VALUES (?, ?, '', 'pending', 0, ?, ?, 'sms')",
            (device_id, command, now, expires),
        )
        db.commit()
    return True


@router.post("/callback")
async def ussd_callback(
    request: Request,
    sessionId: str = Form(""),
    phoneNumber: str = Form(""),
    text: str = Form(""),
):
    """Handle USSD callback from telco gateway."""
    session = _get_session(sessionId, phoneNumber)

    # Parse user input
    parts = text.split("*") if text else []
    choice = parts[-1] if parts else ""

    # Route based on state
    if session["state"] == "main_menu":
        return _handle_main_menu(session, choice, sessionId)
    elif session["state"] == "check_device":
        return _handle_check_device(session, choice, sessionId)
    elif session["state"] == "lock_phone":
        return _handle_lock_phone(session, choice, sessionId)
    elif session["state"] == "trigger_siren":
        return _handle_trigger_siren(session, choice, sessionId)

    return _main_menu(sessionId)


def _handle_main_menu(session: dict, choice: str, session_id: str) -> PlainTextResponse:
    if choice == "1":
        session["state"] = "check_device"
        return PlainTextResponse("CON Enter the phone number to check:\n" "(e.g. 08012345678)")
    elif choice == "2":
        session["state"] = "lock_phone"
        return PlainTextResponse("CON Enter the phone number to lock:\n" "(e.g. 08012345678)")
    elif choice == "3":
        session["state"] = "trigger_siren"
        return PlainTextResponse("CON Enter the phone number for siren:\n" "(e.g. 08012345678)")
    return _main_menu(session_id)


def _handle_check_device(session: dict, choice: str, session_id: str) -> PlainTextResponse:
    phone = choice.strip().replace(" ", "")
    if not phone or len(phone) < 10:
        return PlainTextResponse("CON Invalid number. Enter a valid phone number:")

    device = _find_device_by_phone(phone)
    if not device:
        session["state"] = "main_menu"
        return PlainTextResponse(
            "END No Magneetar device found for this number.\n" "Install Magneetar to protect your phone."
        )

    last_seen = device["last_seen"] or "Never"
    score = device["sentinel_score"] or 0
    status = "STOLEN" if score >= 70 else "At risk" if score >= 40 else "Safe"

    session["state"] = "main_menu"
    return PlainTextResponse(
        f"END {device['model']}\n" f"Status: {status}\n" f"Last seen: {last_seen}\n" f"Theft score: {score}/100"
    )


def _handle_lock_phone(session: dict, choice: str, session_id: str) -> PlainTextResponse:
    phone = choice.strip().replace(" ", "")
    if not phone or len(phone) < 10:
        return PlainTextResponse("CON Invalid number. Enter the phone number to lock:")

    device = _find_device_by_phone(phone)
    if not device:
        session["state"] = "main_menu"
        return PlainTextResponse("END No Magneetar device found for this number.")

    _issue_command(device["id"], "lock")
    session["state"] = "main_menu"
    return PlainTextResponse(f"END Lock command sent to {device['model']}.\n" "The phone will lock on next connection.")


def _handle_trigger_siren(session: dict, choice: str, session_id: str) -> PlainTextResponse:
    phone = choice.strip().replace(" ", "")
    if not phone or len(phone) < 10:
        return PlainTextResponse("CON Invalid number. Enter the phone number for siren:")

    device = _find_device_by_phone(phone)
    if not device:
        session["state"] = "main_menu"
        return PlainTextResponse("END No Magneetar device found for this number.")

    _issue_command(device["id"], "alarm")
    session["state"] = "main_menu"
    return PlainTextResponse(
        f"END Siren command sent to {device['model']}.\n" "The alarm will sound on next connection."
    )


def _main_menu(session_id: str) -> PlainTextResponse:
    return PlainTextResponse(
        "CON Welcome to Magneetar\n"
        "Anti-theft protection for your phone\n\n"
        "1. Check device status\n"
        "2. Lock my phone\n"
        "3. Trigger siren\n\n"
        "0. Back"
    )
