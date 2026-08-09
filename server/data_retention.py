"""
Magneetar Data Retention Controls
User-configurable data retention and cleanup.

Features:
- Per-user retention settings
- Automatic data cleanup
- Retention policy enforcement
- Audit trail for deletions
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from database import get_db_context

logger = logging.getLogger(__name__)


class DataRetentionService:
    """Data retention management service."""

    # Default retention periods (days)
    DEFAULT_LOCATIONS = 90
    DEFAULT_COMMANDS = 90
    DEFAULT_ALERTS = 180
    DEFAULT_HEARTBEATS = 30
    DEFAULT_MEDIA = 365
    DEFAULT_EVIDENCE = 730  # 2 years for evidence

    # Minimum retention periods (days) - for legal/safety reasons
    MIN_LOCATIONS = 7
    MIN_COMMANDS = 30
    MIN_ALERTS = 90
    MIN_HEARTBEATS = 7
    MIN_MEDIA = 30
    MIN_EVIDENCE = 365  # Evidence must be kept for at least 1 year

    def get_user_retention(self, user_id: str) -> dict:
        """Get retention settings for a user."""
        with get_db_context() as conn:
            row = conn.execute(
                "SELECT * FROM data_retention WHERE user_id=?",
                (user_id,),
            ).fetchone()

            if row:
                return dict(row)

        # Return defaults
        return {
            "user_id": user_id,
            "locations_days": self.DEFAULT_LOCATIONS,
            "commands_days": self.DEFAULT_COMMANDS,
            "alerts_days": self.DEFAULT_ALERTS,
            "heartbeats_days": self.DEFAULT_HEARTBEATS,
            "media_days": self.DEFAULT_MEDIA,
            "evidence_days": self.DEFAULT_EVIDENCE,
            "auto_cleanup_enabled": True,
        }

    def update_user_retention(
        self,
        user_id: str,
        locations_days: Optional[int] = None,
        commands_days: Optional[int] = None,
        alerts_days: Optional[int] = None,
        heartbeats_days: Optional[int] = None,
        media_days: Optional[int] = None,
        evidence_days: Optional[int] = None,
        auto_cleanup_enabled: Optional[bool] = None,
    ) -> dict:
        """Update retention settings for a user."""
        # Enforce minimum retention periods
        if locations_days is not None:
            locations_days = max(locations_days, self.MIN_LOCATIONS)
        if commands_days is not None:
            commands_days = max(commands_days, self.MIN_COMMANDS)
        if alerts_days is not None:
            alerts_days = max(alerts_days, self.MIN_ALERTS)
        if heartbeats_days is not None:
            heartbeats_days = max(heartbeats_days, self.MIN_HEARTBEATS)
        if media_days is not None:
            media_days = max(media_days, self.MIN_MEDIA)
        if evidence_days is not None:
            evidence_days = max(evidence_days, self.MIN_EVIDENCE)

        with get_db_context() as conn:
            # Ensure table exists
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS data_retention (
                    user_id TEXT PRIMARY KEY,
                    locations_days INTEGER DEFAULT 90,
                    commands_days INTEGER DEFAULT 90,
                    alerts_days INTEGER DEFAULT 180,
                    heartbeats_days INTEGER DEFAULT 30,
                    media_days INTEGER DEFAULT 365,
                    evidence_days INTEGER DEFAULT 730,
                    auto_cleanup_enabled BOOLEAN DEFAULT TRUE,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Get current settings
            current = self.get_user_retention(user_id)

            # Merge with new values
            updates = {
                "locations_days": locations_days if locations_days is not None else current["locations_days"],
                "commands_days": commands_days if commands_days is not None else current["commands_days"],
                "alerts_days": alerts_days if alerts_days is not None else current["alerts_days"],
                "heartbeats_days": heartbeats_days if heartbeats_days is not None else current["heartbeats_days"],
                "media_days": media_days if media_days is not None else current["media_days"],
                "evidence_days": evidence_days if evidence_days is not None else current["evidence_days"],
                "auto_cleanup_enabled": (
                    auto_cleanup_enabled if auto_cleanup_enabled is not None else current["auto_cleanup_enabled"]
                ),
            }

            # Upsert
            conn.execute(
                """
                INSERT OR REPLACE INTO data_retention
                (user_id, locations_days, commands_days, alerts_days, heartbeats_days,
                 media_days, evidence_days, auto_cleanup_enabled, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
                (
                    user_id,
                    updates["locations_days"],
                    updates["commands_days"],
                    updates["alerts_days"],
                    updates["heartbeats_days"],
                    updates["media_days"],
                    updates["evidence_days"],
                    updates["auto_cleanup_enabled"],
                ),
            )
            conn.commit()

        logger.info(f"Retention settings updated for user {user_id}")
        return self.get_user_retention(user_id)

    def cleanup_user_data(self, user_id: str, dry_run: bool = False) -> dict:
        """Clean up data based on retention settings."""
        retention = self.get_user_retention(user_id)

        if not retention.get("auto_cleanup_enabled", True):
            return {"status": "skipped", "reason": "auto_cleanup_disabled"}

        deleted = {
            "locations": 0,
            "commands": 0,
            "alerts": 0,
            "heartbeats": 0,
            "media": 0,
        }

        with get_db_context() as conn:
            # Get user's devices
            devices = conn.execute(
                "SELECT id FROM devices WHERE owner_id=?",
                (user_id,),
            ).fetchall()

            for device in devices:
                device_id = device["id"]

                # Clean locations
                cutoff = (datetime.now(timezone.utc) - timedelta(days=retention["locations_days"])).isoformat()
                if dry_run:
                    count = conn.execute(
                        "SELECT COUNT(*) as cnt FROM locations WHERE device_id=? AND server_timestamp<?",
                        (device_id, cutoff),
                    ).fetchone()["cnt"]
                else:
                    result = conn.execute(
                        "DELETE FROM locations WHERE device_id=? AND server_timestamp<?",
                        (device_id, cutoff),
                    )
                    count = result.rowcount
                deleted["locations"] += count

                # Clean commands
                cutoff = (datetime.now(timezone.utc) - timedelta(days=retention["commands_days"])).isoformat()
                if dry_run:
                    count = conn.execute(
                        "SELECT COUNT(*) as cnt FROM commands WHERE device_id=? AND issued_at<?",
                        (device_id, cutoff),
                    ).fetchone()["cnt"]
                else:
                    result = conn.execute(
                        "DELETE FROM commands WHERE device_id=? AND issued_at<?",
                        (device_id, cutoff),
                    )
                    count = result.rowcount
                deleted["commands"] += count

                # Clean alerts
                cutoff = (datetime.now(timezone.utc) - timedelta(days=retention["alerts_days"])).isoformat()
                if dry_run:
                    count = conn.execute(
                        "SELECT COUNT(*) as cnt FROM alerts WHERE device_id=? AND sent_at<?",
                        (device_id, cutoff),
                    ).fetchone()["cnt"]
                else:
                    result = conn.execute(
                        "DELETE FROM alerts WHERE device_id=? AND sent_at<?",
                        (device_id, cutoff),
                    )
                    count = result.rowcount
                deleted["alerts"] += count

                # Clean heartbeats
                cutoff = (datetime.now(timezone.utc) - timedelta(days=retention["heartbeats_days"])).isoformat()
                if dry_run:
                    count = conn.execute(
                        "SELECT COUNT(*) as cnt FROM heartbeats WHERE device_id=? AND timestamp<?",
                        (device_id, cutoff),
                    ).fetchone()["cnt"]
                else:
                    result = conn.execute(
                        "DELETE FROM heartbeats WHERE device_id=? AND timestamp<?",
                        (device_id, cutoff),
                    )
                    count = result.rowcount
                deleted["heartbeats"] += count

                # Clean media (but not evidence)
                if not dry_run:
                    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention["media_days"])).isoformat()
                    # Get media to delete
                    media_rows = conn.execute(
                        """SELECT id, file_path FROM media
                           WHERE device_id=? AND timestamp<?
                           AND NOT EXISTS (
                               SELECT 1 FROM evidence_cases
                               WHERE id=media.evidence_case_id AND status='active'
                           )""",
                        (device_id, cutoff),
                    ).fetchall()

                    # Delete files from disk
                    try:
                        from media_store import delete_media_file

                        for row in media_rows:
                            if row["file_path"]:
                                delete_media_file(row["file_path"])
                    except Exception:
                        pass

                    result = conn.execute(
                        """DELETE FROM media
                           WHERE device_id=? AND timestamp<?
                           AND NOT EXISTS (
                               SELECT 1 FROM evidence_cases
                               WHERE id=media.evidence_case_id AND status='active'
                           )""",
                        (device_id, cutoff),
                    )
                    deleted["media"] += result.rowcount
                else:
                    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention["media_days"])).isoformat()
                    count = conn.execute(
                        """SELECT COUNT(*) as cnt FROM media
                           WHERE device_id=? AND timestamp<?
                           AND NOT EXISTS (
                               SELECT 1 FROM evidence_cases
                               WHERE id=media.evidence_case_id AND status='active'
                           )""",
                        (device_id, cutoff),
                    ).fetchone()["cnt"]
                    deleted["media"] += count

            if not dry_run:
                conn.commit()

        return {
            "status": "completed" if not dry_run else "dry_run",
            "user_id": user_id,
            "retention_days": retention,
            "deleted": deleted,
            "total_deleted": sum(deleted.values()),
        }

    def get_cleanup_schedule(self) -> dict:
        """Get cleanup schedule information."""
        with get_db_context():
            # Count data that would be cleaned up
            return {
                "global_defaults": {
                    "locations_days": self.DEFAULT_LOCATIONS,
                    "commands_days": self.DEFAULT_COMMANDS,
                    "alerts_days": self.DEFAULT_ALERTS,
                    "heartbeats_days": self.DEFAULT_HEARTBEATS,
                    "media_days": self.DEFAULT_MEDIA,
                    "evidence_days": self.DEFAULT_EVIDENCE,
                },
                "minimum_retention": {
                    "locations_days": self.MIN_LOCATIONS,
                    "commands_days": self.MIN_COMMANDS,
                    "alerts_days": self.MIN_ALERTS,
                    "heartbeats_days": self.MIN_HEARTBEATS,
                    "media_days": self.MIN_MEDIA,
                    "evidence_days": self.MIN_EVIDENCE,
                },
                "next_cleanup": "Daily at 3:00 AM UTC",
            }


# Singleton
data_retention_service = DataRetentionService()
