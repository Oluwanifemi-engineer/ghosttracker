"""
Magneetar Abuse Prevention System

Prevents misuse of tracking features for stalking/surveillance.
Implements:
- Consent verification: tracked device must explicitly approve tracking
- Anti-stalking detection: flags suspicious tracking patterns
- Visibility indicators: persistent notification on tracked devices
- Easy opt-out: one-tap to leave Circle and stop sharing
- Reporting mechanism: report unauthorized tracking

Compliance: NDPR, GDPR, anti-stalking best practices.
"""

import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class TrackingConsent:
    """Records explicit consent for location tracking."""

    device_id: str
    grantee_user_id: str  # Who is being tracked
    grantor_user_id: str  # Who is doing the tracking
    consent_given: bool
    consent_timestamp: datetime
    consent_method: str  # "circle_join", "explicit_grant", "device_link"
    revoked: bool = False
    revocation_timestamp: Optional[datetime] = None
    revocation_method: Optional[str] = None  # "user_action", "auto_timeout", "report"


@dataclass
class StalkingPattern:
    """Detected suspicious tracking pattern."""

    pattern_type: str  # "one_to_many", "rapid_circle_join", "geofence_stalk"
    severity: str  # "low", "medium", "high", "critical"
    description: str
    involved_users: list[str] = field(default_factory=list)
    involved_devices: list[str] = field(default_factory=list)
    detected_at: datetime = field(default_factory=datetime.utcnow)
    evidence: dict = field(default_factory=dict)


class AbusePreventionEngine:
    """Detects and prevents tracking abuse patterns."""

    # Thresholds for anti-stalking detection
    MAX_TRACKED_DEVICES_PER_USER = 10  # Max devices one user can track
    MAX_TRACKERS_PER_DEVICE = 5  # Max users tracking one device
    RAPID_CIRCLE_JOIN_THRESHOLD = 5  # Circles joined in 1 hour
    GEOFENCE_STALK_THRESHOLD = 3  # Geofences near same location
    SUSPICIOUS_TRACKING_HOURS = 168  # 7 days of continuous tracking

    def __init__(self, db):
        self.db = db

    async def verify_tracking_consent(
        self, device_id: str, grantee_user_id: str, grantor_user_id: str, consent_method: str = "explicit_grant"
    ) -> TrackingConsent:
        """
        Record explicit consent for tracking. This MUST be called
        before any location data is shared with another user.
        """
        consent = TrackingConsent(
            device_id=device_id,
            grantee_user_id=grantee_user_id,
            grantor_user_id=grantor_user_id,
            consent_given=True,
            consent_timestamp=datetime.utcnow(),
            consent_method=consent_method,
        )

        # Store consent record
        await self.db.execute(
            """INSERT INTO tracking_consents
               (device_id, grantee_user_id, grantor_user_id,
                consent_given, consent_timestamp, consent_method)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (device_id, grantee_user_id, grantor_user_id, True, consent.consent_timestamp.isoformat(), consent_method),
        )

        return consent

    async def revoke_tracking_consent(
        self, device_id: str, grantee_user_id: str, revocation_method: str = "user_action"
    ) -> bool:
        """Revoke tracking consent. Immediately stops all location sharing."""
        await self.db.execute(
            """UPDATE tracking_consents
               SET revoked = 1, revocation_timestamp = ?, revocation_method = ?
               WHERE device_id = ? AND grantee_user_id = ? AND revoked = 0""",
            (datetime.utcnow().isoformat(), revocation_method, device_id, grantee_user_id),
        )

        # Immediately remove device from shared circles
        await self.db.execute(
            """DELETE FROM circle_devices
               WHERE device_id = ? AND shared_by = ?""",
            (device_id, grantee_user_id),
        )

        return True

    async def check_tracking_allowed(self, device_id: str, requestor_user_id: str) -> bool:
        """Check if a user is allowed to track a device. Returns False if consent revoked."""
        row = await self.db.fetch_one(
            """SELECT consent_given, revoked FROM tracking_consents
               WHERE device_id = ? AND grantee_user_id = ?
               ORDER BY consent_timestamp DESC LIMIT 1""",
            (device_id, requestor_user_id),
        )

        if not row:
            return False  # No consent record = not allowed

        return row["consent_given"] and not row["revoked"]

    async def detect_stalking_patterns(self, user_id: str) -> list[StalkingPattern]:
        """Analyze a user's tracking behavior for suspicious patterns."""
        patterns = []

        # Pattern 1: One user tracking too many devices
        tracked_count = await self.db.fetch_one(
            """SELECT COUNT(DISTINCT device_id) as cnt
               FROM circle_devices cd
               JOIN circles c ON cd.circle_id = c.id
               WHERE c.owner_id = ?""",
            (user_id,),
        )

        if tracked_count and tracked_count["cnt"] > self.MAX_TRACKED_DEVICES_PER_USER:
            patterns.append(
                StalkingPattern(
                    pattern_type="one_to_many",
                    severity="high",
                    description=(
                        f"User tracking {tracked_count['cnt']} devices " f"(limit: {self.MAX_TRACKED_DEVICES_PER_USER})"
                    ),
                    involved_users=[user_id],
                    evidence={"device_count": tracked_count["cnt"]},
                )
            )

        # Pattern 2: Rapid Circle joining (potential fake family)
        recent_joins = await self.db.fetch_one(
            """SELECT COUNT(*) as cnt FROM circle_members
               WHERE user_id = ?
               AND joined_at > datetime('now', '-1 hour')""",
            (user_id,),
        )

        if recent_joins and recent_joins["cnt"] > self.RAPID_CIRCLE_JOIN_THRESHOLD:
            patterns.append(
                StalkingPattern(
                    pattern_type="rapid_circle_join",
                    severity="medium",
                    description=f"User joined {recent_joins['cnt']} circles in 1 hour",
                    involved_users=[user_id],
                    evidence={"joins_in_hour": recent_joins["cnt"]},
                )
            )

        # Pattern 3: Excessive continuous tracking (>7 days without user interaction)
        long_tracking = await self.db.fetch_one(
            """SELECT COUNT(DISTINCT device_id) as cnt
               FROM circle_devices cd
               JOIN circles c ON cd.circle_id = c.id
               WHERE c.owner_id = ?
               AND cd.created_at < datetime('now', '-7 days')""",
            (user_id,),
        )

        if long_tracking and long_tracking["cnt"] > 0:
            patterns.append(
                StalkingPattern(
                    pattern_type="long_term_tracking",
                    severity="low",
                    description=f"Tracking {long_tracking['cnt']} devices for >7 days without refresh",
                    involved_users=[user_id],
                    evidence={"devices_tracked_days": long_tracking["cnt"]},
                )
            )

        return patterns

    async def generate_visibility_indicator(self, device_id: str) -> dict:
        """
        Generate visibility information for a tracked device.
        This MUST be shown to the device owner so they know they're being tracked.
        """
        # Get all users tracking this device
        trackers = await self.db.fetch_all(
            """SELECT DISTINCT c.owner_id, c.name as circle_name
               FROM circle_devices cd
               JOIN circles c ON cd.circle_id = c.id
               WHERE cd.device_id = ?""",
            (device_id,),
        )

        return {
            "device_id": device_id,
            "is_being_tracked": len(trackers) > 0,
            "tracker_count": len(trackers),
            "trackers": [{"user_id": t["owner_id"], "circle_name": t["circle_name"]} for t in trackers],
            "notification_message": (
                f"Magneetar is sharing your location with " f"{len(trackers)} circle(s)"
                if trackers
                else "Your location is not being shared"
            ),
            "opt_out_available": True,
            "opt_out_url": f"/api/device/{device_id}/opt-out-tracking",
        }

    async def report_unauthorized_tracking(
        self, reporter_user_id: str, reported_user_id: str, reason: str, evidence: dict = None
    ) -> dict:
        """
        Report suspected unauthorized tracking. Triggers investigation
        and may automatically revoke access.
        """
        report_id = f"report_{int(time.time())}_{reporter_user_id[:8]}"

        # Store report
        await self.db.execute(
            """INSERT INTO abuse_reports
               (id, reporter_user_id, reported_user_id, reason,
                evidence, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'pending', ?)""",
            (report_id, reporter_user_id, reported_user_id, reason, str(evidence or {}), datetime.utcnow().isoformat()),
        )

        # Auto-revoke access for high-severity reports
        if reason in ["stalking", "threat", "harassment"]:
            # Revoke all tracking consent from reported user
            await self.db.execute(
                """UPDATE tracking_consents
                   SET revoked = 1, revocation_method = 'abuse_report'
                   WHERE grantor_user_id = ?""",
                (reported_user_id,),
            )

            # Remove from all circles
            await self.db.execute(
                """DELETE FROM circle_members
                   WHERE user_id = ?""",
                (reported_user_id,),
            )

        return {
            "report_id": report_id,
            "status": "submitted",
            "action_taken": "immediate_revoke" if reason in ["stalking", "threat"] else "under_review",
            "message": "Your report has been submitted. We take unauthorized tracking very seriously.",
        }


# Consent middleware for API routes
def require_tracking_consent(db):
    """Middleware that verifies tracking consent before sharing location data."""

    async def middleware(device_id: str, requestor_user_id: str) -> bool:
        """Check if tracking consent exists and is valid."""
        consent_row = await db.fetch_one(
            """SELECT consent_given, revoked, consent_timestamp
               FROM tracking_consents
               WHERE device_id = ? AND grantee_user_id = ?
               ORDER BY consent_timestamp DESC LIMIT 1""",
            (device_id, requestor_user_id),
        )

        if not consent_row:
            return False  # No consent = no tracking

        if consent_row["revoked"]:
            return False  # Consent revoked = no tracking

        if not consent_row["consent_given"]:
            return False  # Explicitly denied = no tracking

        # Check consent expiry (re-confirm every 90 days)
        consent_time = datetime.fromisoformat(consent_row["consent_timestamp"])
        if datetime.utcnow() - consent_time > timedelta(days=90):
            return False  # Consent expired = need re-confirmation

        return True

    return middleware
