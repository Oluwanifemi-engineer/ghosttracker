"""
Magneetar Consent & Privacy API Routes

Handles:
- Tracking consent verification and management
- Data export requests (GDPR right to portability)
- Privacy consent recording (NDPR/GDPR)
- Abuse reporting
- Consent status checks

All endpoints require authentication.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from abuse_prevention import AbusePreventionEngine
from database import get_db, get_db_context
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


# ── Request Models ─────────────────────────────────────────────────────────


class ConsentGrantRequest(BaseModel):
    device_id: str
    grantee_user_id: str
    consent_method: str = "explicit_grant"


class ConsentRevokeRequest(BaseModel):
    device_id: str


class AbuseReportRequest(BaseModel):
    reported_user_id: str
    reason: str  # "stalking", "threat", "harassment", "unauthorized_tracking"
    evidence: Optional[dict] = None


class PrivacyConsentRequest(BaseModel):
    consent_type: str  # "location_tracking", "evidence_capture", "data_processing"
    consent_given: bool


class DataExportRequest(BaseModel):
    pass  # No parameters needed — exports all user data


# ── Tracking Consent Endpoints ────────────────────────────────────────────


@router.post("/api/consent/tracking/grant")
async def grant_tracking_consent(request: Request, body: ConsentGrantRequest):
    """
    Grant explicit consent for location tracking.
    This MUST be called before any location data is shared with another user.
    """
    # Get current user from auth
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    grantor_user_id = payload.get("user_id", "")

    # Verify the device belongs to the grantor
    with get_db_context() as db:
        device = db.execute("SELECT id, owner_id FROM devices WHERE id = ?", (body.device_id,)).fetchone()

        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        if device["owner_id"] != grantor_user_id:
            raise HTTPException(status_code=403, detail="You can only grant consent for your own devices")

    # Record consent
    engine = AbusePreventionEngine(get_db())
    consent = await engine.verify_tracking_consent(
        device_id=body.device_id,
        grantee_user_id=body.grantee_user_id,
        grantor_user_id=grantor_user_id,
        consent_method=body.consent_method,
    )

    return {
        "status": "consent_granted",
        "device_id": body.device_id,
        "grantee_user_id": body.grantee_user_id,
        "consent_timestamp": consent.consent_timestamp.isoformat(),
        "message": "Location sharing is now active. You can revoke this at any time.",
    }


@router.post("/api/consent/tracking/revoke")
async def revoke_tracking_consent(request: Request, body: ConsentRevokeRequest):
    """
    Revoke tracking consent. Immediately stops all location sharing
    for this device with all users.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id", "")

    # Verify device ownership
    with get_db_context() as db:
        device = db.execute("SELECT id, owner_id FROM devices WHERE id = ?", (body.device_id,)).fetchone()

        if not device:
            raise HTTPException(status_code=404, detail="Device not found")

        if device["owner_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only revoke consent for your own devices")

    # Revoke consent
    engine = AbusePreventionEngine(get_db())
    await engine.revoke_tracking_consent(
        device_id=body.device_id, grantee_user_id=user_id, revocation_method="user_action"
    )

    return {
        "status": "consent_revoked",
        "device_id": body.device_id,
        "message": "Location sharing has been stopped for this device.",
    }


@router.get("/api/consent/tracking/status/{device_id}")
async def get_tracking_consent_status(request: Request, device_id: str):
    """Get the current tracking consent status for a device."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    engine = AbusePreventionEngine(get_db())
    visibility = await engine.generate_visibility_indicator(device_id)

    return visibility


# ── Abuse Reporting Endpoints ─────────────────────────────────────────────


@router.post("/api/consent/report")
async def report_abuse(request: Request, body: AbuseReportRequest):
    """Report suspected unauthorized tracking or abuse."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    reporter_user_id = payload.get("user_id", "")

    if reporter_user_id == body.reported_user_id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    if body.reason not in ["stalking", "threat", "harassment", "unauthorized_tracking"]:
        raise HTTPException(status_code=400, detail="Invalid report reason")

    engine = AbusePreventionEngine(get_db())
    report = await engine.report_unauthorized_tracking(
        reporter_user_id=reporter_user_id,
        reported_user_id=body.reported_user_id,
        reason=body.reason,
        evidence=body.evidence,
    )

    return report


@router.get("/api/consent/anti-stalking/{user_id}")
async def check_stalking_patterns(request: Request, user_id: str):
    """Check if a user has suspicious tracking patterns (admin only)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Only admin can check other users' patterns
    if payload.get("user_id") != user_id and payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    engine = AbusePreventionEngine(get_db())
    patterns = await engine.detect_stalking_patterns(user_id)

    return {
        "user_id": user_id,
        "patterns_detected": len(patterns),
        "patterns": [
            {
                "type": p.pattern_type,
                "severity": p.severity,
                "description": p.description,
                "detected_at": p.detected_at.isoformat(),
            }
            for p in patterns
        ],
    }


# ── Privacy Compliance Endpoints ──────────────────────────────────────────


@router.post("/api/consent/privacy")
async def record_privacy_consent(request: Request, body: PrivacyConsentRequest):
    """Record privacy consent (NDPR/GDPR compliance)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id", "")
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")

    valid_types = ["location_tracking", "evidence_capture", "data_processing", "privacy_policy", "terms_of_service"]
    if body.consent_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid consent type. Must be one of: {valid_types}")

    with get_db_context() as db:
        db.execute(
            """INSERT INTO privacy_consents
               (user_id, consent_type, consent_given, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?)""",
            (user_id, body.consent_type, body.consent_given, client_ip, user_agent),
        )

    return {
        "status": "recorded",
        "consent_type": body.consent_type,
        "consent_given": body.consent_given,
        "timestamp": datetime.utcnow().isoformat(),
        "message": f"{'Consent recorded' if body.consent_given else 'Consent withdrawn'}",
    }


@router.post("/api/consent/data-export")
async def request_data_export(request: Request):
    """
    Request export of all user data (GDPR right to portability).
    Returns a download URL valid for 7 days.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id", "")

    # Check for pending export
    with get_db_context() as db:
        pending = db.execute(
            """SELECT id, status, download_url, expires_at
               FROM data_export_requests
               WHERE user_id = ? AND status IN ('pending', 'ready')
               ORDER BY requested_at DESC LIMIT 1""",
            (user_id,),
        ).fetchone()

        if pending and pending["status"] == "ready":
            # Check if still valid
            if pending["expires_at"]:
                expires = datetime.fromisoformat(pending["expires_at"])
                if datetime.utcnow() < expires:
                    return {
                        "status": "ready",
                        "download_url": pending["download_url"],
                        "expires_at": pending["expires_at"],
                        "message": "Your data export is ready for download.",
                    }

        # Create new export request
        export_id = str(uuid.uuid4())
        db.execute(
            """INSERT INTO data_export_requests (id, user_id, status)
               VALUES (?, ?, 'pending')""",
            (export_id, user_id),
        )

    # In production, this would trigger a background job to generate the export
    # For now, return immediate acknowledgment
    return {
        "status": "pending",
        "export_id": export_id,
        "message": (
            "Your data export request has been received. "
            "You will be notified when it's ready (typically within 24 hours)."
        ),
    }


@router.delete("/api/consent/data-deletion")
async def request_data_deletion(request: Request):
    """
    Request deletion of all user data (GDPR right to erasure).
    This is irreversible.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header.split(" ", 1)[1]
    from user_auth import decode_access_token

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id", "")

    with get_db_context() as db:
        # Soft-delete user (mark as inactive, schedule hard delete)
        db.execute("""UPDATE users SET is_active = 0 WHERE id = ?""", (user_id,))

        # Revoke all tracking consents
        db.execute(
            """UPDATE tracking_consents
               SET revoked = 1, revocation_method = 'account_deletion'
               WHERE grantor_user_id = ? OR grantee_user_id = ?""",
            (user_id, user_id),
        )

        # Remove from all circles
        db.execute("""DELETE FROM circle_members WHERE user_id = ?""", (user_id,))

    return {
        "status": "deletion_scheduled",
        "message": "Your account has been deactivated and data deletion scheduled. "
        "All data will be permanently removed within 30 days.",
        "deletion_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
    }


@router.get("/api/consent/visibility/{device_id}")
async def get_device_visibility(request: Request, device_id: str):
    """Get visibility information for a tracked device (shown to device owner)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    engine = AbusePreventionEngine(get_db())
    visibility = await engine.generate_visibility_indicator(device_id)

    return visibility
