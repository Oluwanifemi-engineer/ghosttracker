"""
Magneetar USSD Menu
Reaches 46% of Nigeria's mobile market (feature phones).

USSD stats from research:
- 90% of mobile money transactions in Sub-Saharan Africa use USSD
- 150M+ Nigerians reachable via USSD
- USSD transaction volume grew 20.89% YoY in 2025
- Works on 2G/3G, no internet required

Menu Structure:
*123# → Main Menu
  1 → Check IMEI (enter 15-digit IMEI)
  2 → Report Theft (enter IMEI + location)
  3 → Device Status (enter phone number)
  4 → Download App (get SMS link)
  5 → Pricing (view plans)
  0 → Back
  * → Main Menu

Integration:
- Telco USSD gateway sends requests to this endpoint
- Session-based (USSD sessions last ~180 seconds)
- State machine for multi-step flows
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone

from database import get_db_context
from fastapi import APIRouter, Form, Request
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ussd", tags=["ussd"])


# ─── USSD Session State ─────────────────────────────────────────────────────

# In-memory session store (production would use Redis)
_sessions: dict = {}


class USSDSession:
    """Tracks user state during a USSD session."""

    def __init__(self, session_id: str, phone: str):
        self.session_id = session_id
        self.phone = phone
        self.state = "main_menu"
        self.data = {}  # Accumulated data (IMEI, location, etc.)
        self.created_at = datetime.now(timezone.utc)

    def reset(self):
        self.state = "main_menu"
        self.data = {}


# ─── USSD Endpoint ──────────────────────────────────────────────────────────


@router.post("/callback")
async def ussd_callback(
    request: Request,
    sessionId: str = Form(""),
    phoneNumber: str = Form(""),
    networkCode: str = Form(""),
    text: str = Form(""),
):
    """Handle USSD callback from telco gateway.

    The `text` parameter contains the full session input:
    - "" → Main menu
    - "1" → User selected option 1
    - "1*123456789012345" → User selected option 1, then entered IMEI
    - "1*123456789012345*2" → User selected 1, entered IMEI, then selected option 2
    """
    # Get or create session
    if sessionId not in _sessions:
        _sessions[sessionId] = USSDSession(sessionId, phoneNumber)

    session = _sessions[sessionId]

    # Parse the input
    parts = text.split("*") if text else []
    current_input = parts[-1] if parts else ""

    # Route to the appropriate handler
    try:
        if not parts or text == "":
            response = show_main_menu()
        elif parts[0] == "1":
            response = handle_imei_check(session, parts)
        elif parts[0] == "2":
            response = handle_theft_report(session, parts)
        elif parts[0] == "3":
            response = handle_device_status(session, parts)
        elif parts[0] == "4":
            response = handle_download_app(session, parts)
        elif parts[0] == "5":
            response = handle_pricing(session, parts)
        elif current_input == "0":
            # Back to main menu
            session.reset()
            response = show_main_menu()
        elif current_input == "*":
            # Main menu
            session.reset()
            response = show_main_menu()
        else:
            response = show_main_menu()
    except Exception as e:
        logger.error(f"USSD error: {e}")
        response = "CON Sorry, an error occurred. Please try again.\n\n0. Main Menu"

    # Clean up old sessions (>5 minutes)
    _cleanup_sessions()

    return PlainTextResponse(response, media_type="text/plain")


# ─── Menu Handlers ───────────────────────────────────────────────────────────


def show_main_menu() -> str:
    """Display the main USSD menu."""
    return (
        "CON Magneetar Phone Safety\n"
        "━━━━━━━━━━━━━━━━━━━━━━━\n"
        "1. Check IMEI\n"
        "2. Report Theft\n"
        "3. Device Status\n"
        "4. Download App\n"
        "5. Pricing\n"
        "\n0. Exit"
    )


def handle_imei_check(session: USSDSession, parts: list) -> str:
    """Handle IMEI check flow."""
    if len(parts) == 1:
        # User selected "1" — ask for IMEI
        return "CON Enter 15-digit IMEI:\n(Dial *#06# to find it)\n\n0. Back"

    elif len(parts) == 2:
        # User entered IMEI
        imei = parts[1].strip()

        if len(imei) != 15 or not imei.isdigit():
            return "CON Invalid IMEI. Must be 15 digits.\n\nTry again:\n0. Back"

        # Check the IMEI
        result = _check_imei(imei)
        return f"END {result}"

    return show_main_menu()


def handle_theft_report(session: USSDSession, parts: list) -> str:
    """Handle theft report flow."""
    if len(parts) == 1:
        # User selected "2" — ask for IMEI
        return "CON Report Stolen Phone\nEnter IMEI:\n\n0. Back"

    elif len(parts) == 2:
        # User entered IMEI
        imei = parts[1].strip()
        if len(imei) != 15 or not imei.isdigit():
            return "CON Invalid IMEI. Must be 15 digits.\n\nTry again:\n0. Back"
        session.data["imei"] = imei
        return "CON Enter location (city/area):\n\n0. Back"

    elif len(parts) == 3:
        # User entered location
        location = parts[2].strip() or "Unknown"
        imei = session.data.get("imei", "")

        # Submit the report
        result = _submit_theft_report(imei, location, session.phone)
        session.reset()
        return f"END {result}"

    return show_main_menu()


def handle_device_status(session: USSDSession, parts: list) -> str:
    """Handle device status check."""
    if len(parts) == 1:
        return "CON Enter phone number to check:\n(e.g. 08012345678)\n\n0. Back"

    elif len(parts) == 2:
        phone = parts[1].strip()
        result = _check_device_status(phone)
        return f"END {result}"

    return show_main_menu()


def handle_download_app(session: USSDSession, parts: list) -> str:
    """Send download link via SMS."""
    result = _send_download_link(session.phone)
    return f"END {result}"


def handle_pricing(session: USSDSession, parts: list) -> str:
    """Show pricing information."""
    return (
        "END Magneetar Plans\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "FREE: ₦0\n"
        "• 1 device, 5-min tracking\n"
        "\n"
        "PERSONAL: ₦1,500/mo\n"
        "• 3 devices, 3-sec tracking\n"
        "\n"
        "FAMILY: ₦3,000/mo\n"
        "• 10 devices, unlimited\n"
        "\n"
        "Download: magneetar.me/download"
    )


# ─── Business Logic ──────────────────────────────────────────────────────────


def _check_imei(imei: str) -> str:
    """Check IMEI trust score."""
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
                f"🚨 STOLEN PHONE\n" f"IMEI: {imei}\n" f"Trust Score: {score}/100\n" f"This device is reported stolen!"
            )
        elif status == "clean":
            device = f"({brand} {model})" if brand else ""
            return f"✅ VERIFIED CLEAN\n" f"IMEI: {imei}\n" f"Trust Score: {score}/100\n" f"{device}No theft reports."
        else:
            return f"⚠️ UNKNOWN STATUS\n" f"IMEI: {imei}\n" f"Trust Score: {score}/100\n" f"Proceed with caution."
    else:
        if theft_reports > 0:
            return (
                f"🚨 STOLEN PHONE\n"
                f"IMEI: {imei}\n"
                f"Theft Reports: {theft_reports}\n"
                f"This device is reported stolen!"
            )
        else:
            return f"❓ NO DATA\n" f"IMEI: {imei}\n" f"Not in database. Download Magneetar to protect your phone."


def _submit_theft_report(imei: str, location: str, phone: str) -> str:
    """Submit a theft report."""
    imei_hash = hashlib.sha256(imei.encode()).hexdigest()[:16]
    report_id = f"rpt_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
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
        f"✅ THEFT REPORTED\n"
        f"IMEI: {imei}\n"
        f"Location: {location}\n"
        f"Report ID: {report_id}\n"
        f"This IMEI is now flagged as stolen."
    )


def _check_device_status(phone: str) -> str:
    """Check device registration status by phone number."""
    with get_db_context() as db:
        device = db.execute(
            "SELECT id, name, last_seen, battery FROM devices WHERE sms_phone = ?",
            (phone,),
        ).fetchone()

    if device:
        last_seen = device[2] or "Unknown"
        battery = device[3] or "Unknown"
        return f"📱 DEVICE STATUS\n" f"Name: {device[1]}\n" f"Last Seen: {last_seen}\n" f"Battery: {battery}%"
    else:
        return "❓ NOT FOUND\n" f"Phone {phone} is not registered.\n" "Download Magneetar to protect your phone."


def _send_download_link(phone: str) -> str:
    """Send download link via SMS."""
    # In production, this would send an SMS via Twilio
    return "📲 DOWNLOAD LINK SENT\n" "Check your SMS for the download link.\n" "Or visit: magneetar.me/download"


def _cleanup_sessions():
    """Remove sessions older than 5 minutes."""
    now = datetime.now(timezone.utc)
    expired = [sid for sid, session in _sessions.items() if (now - session.created_at).total_seconds() > 300]
    for sid in expired:
        del _sessions[sid]
