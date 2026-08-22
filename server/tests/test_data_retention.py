"""
Tests for data_retention.py — DataRetentionService.

Covers:
- get_user_retention (defaults + persisted)
- update_user_retention (create + update + minimum enforcement)
- cleanup_user_data (dry_run + real delete + disabled cleanup)
- get_cleanup_schedule
"""

import pytest
from data_retention import DataRetentionService


@pytest.fixture
def svc():
    return DataRetentionService()


class TestGetUserRetention:
    """get_user_retention returns defaults for unknown users, persisted for known."""

    def test_unknown_user_returns_defaults(self, svc):
        # Ensure table exists (created by update_user_retention)
        svc.update_user_retention("__ensure_table__")
        result = svc.get_user_retention("__nonexistent_user__")
        assert result["locations_days"] == DataRetentionService.DEFAULT_LOCATIONS
        assert result["commands_days"] == DataRetentionService.DEFAULT_COMMANDS
        assert result["alerts_days"] == DataRetentionService.DEFAULT_ALERTS
        assert result["heartbeats_days"] == DataRetentionService.DEFAULT_HEARTBEATS
        assert result["media_days"] == DataRetentionService.DEFAULT_MEDIA
        assert result["evidence_days"] == DataRetentionService.DEFAULT_EVIDENCE
        assert result["auto_cleanup_enabled"]

    def test_updated_user_returns_persisted_values(self, svc):
        uid = "test_retention_user_1"
        svc.update_user_retention(uid, locations_days=30, commands_days=60)
        result = svc.get_user_retention(uid)
        assert result["locations_days"] == 30
        assert result["commands_days"] == 60
        # Others stay at defaults
        assert result["alerts_days"] == DataRetentionService.DEFAULT_ALERTS

    def test_user_id_in_result(self, svc):
        uid = "test_retention_user_2"
        result = svc.get_user_retention(uid)
        assert result["user_id"] == uid


class TestUpdateUserRetention:
    """update_user_retention creates + updates with minimum enforcement."""

    def test_create_new_retention(self, svc):
        uid = "test_retention_user_3"
        result = svc.update_user_retention(uid, locations_days=45)
        assert result["locations_days"] == 45

    def test_update_existing_retention(self, svc):
        uid = "test_retention_user_4"
        svc.update_user_retention(uid, locations_days=45)
        result = svc.update_user_retention(uid, locations_days=60)
        assert result["locations_days"] == 60

    def test_minimum_enforcement_locations(self, svc):
        uid = "test_retention_user_5"
        result = svc.update_user_retention(uid, locations_days=1)
        assert result["locations_days"] == DataRetentionService.MIN_LOCATIONS

    def test_minimum_enforcement_commands(self, svc):
        uid = "test_retention_user_6"
        result = svc.update_user_retention(uid, commands_days=5)
        assert result["commands_days"] == DataRetentionService.MIN_COMMANDS

    def test_minimum_enforcement_alerts(self, svc):
        uid = "test_retention_user_7"
        result = svc.update_user_retention(uid, alerts_days=10)
        assert result["alerts_days"] == DataRetentionService.MIN_ALERTS

    def test_minimum_enforcement_heartbeats(self, svc):
        uid = "test_retention_user_8"
        result = svc.update_user_retention(uid, heartbeats_days=1)
        assert result["heartbeats_days"] == DataRetentionService.MIN_HEARTBEATS

    def test_minimum_enforcement_media(self, svc):
        uid = "test_retention_user_9"
        result = svc.update_user_retention(uid, media_days=5)
        assert result["media_days"] == DataRetentionService.MIN_MEDIA

    def test_minimum_enforcement_evidence(self, svc):
        uid = "test_retention_user_10"
        result = svc.update_user_retention(uid, evidence_days=100)
        assert result["evidence_days"] == DataRetentionService.MIN_EVIDENCE

    def test_disable_auto_cleanup(self, svc):
        uid = "test_retention_user_11"
        result = svc.update_user_retention(uid, auto_cleanup_enabled=False)
        assert not result["auto_cleanup_enabled"]

    def test_partial_update_preserves_other_fields(self, svc):
        uid = "test_retention_user_12"
        svc.update_user_retention(uid, locations_days=50, commands_days=75)
        result = svc.update_user_retention(uid, locations_days=100)
        assert result["locations_days"] == 100
        assert result["commands_days"] == 75  # preserved


class TestCleanupUserData:
    """cleanup_user_data respects retention settings and dry_run."""

    def test_dry_run_returns_counts_without_deleting(self, svc):
        uid = "test_retention_user_13"
        svc.update_user_retention(uid, locations_days=30)
        result = svc.cleanup_user_data(uid, dry_run=True)
        assert result["status"] == "dry_run"
        assert "deleted" in result
        assert result["user_id"] == uid

    def test_disabled_cleanup_skips(self, svc):
        uid = "test_retention_user_14"
        svc.update_user_retention(uid, auto_cleanup_enabled=False)
        result = svc.cleanup_user_data(uid)
        assert result["status"] == "skipped"
        assert result["reason"] == "auto_cleanup_disabled"

    def test_cleanup_with_no_devices(self, svc):
        uid = "test_retention_user_15__no_devices"
        result = svc.cleanup_user_data(uid, dry_run=True)
        assert result["status"] == "dry_run"
        assert result["total_deleted"] == 0

    def test_cleanup_returns_retention_days(self, svc):
        uid = "test_retention_user_16"
        svc.update_user_retention(uid, locations_days=45)
        result = svc.cleanup_user_data(uid, dry_run=True)
        assert result["retention_days"]["locations_days"] == 45

    def test_real_cleanup_with_no_devices(self, svc):
        uid = "test_retention_user_17__no_devices"
        result = svc.cleanup_user_data(uid, dry_run=False)
        assert result["status"] == "completed"
        assert result["total_deleted"] == 0


class TestGetCleanupSchedule:
    """get_cleanup_schedule returns defaults and minimums."""

    def test_returns_global_defaults(self, svc):
        result = svc.get_cleanup_schedule()
        assert result["global_defaults"]["locations_days"] == DataRetentionService.DEFAULT_LOCATIONS
        assert result["global_defaults"]["evidence_days"] == DataRetentionService.DEFAULT_EVIDENCE

    def test_returns_minimum_retention(self, svc):
        result = svc.get_cleanup_schedule()
        assert result["minimum_retention"]["locations_days"] == DataRetentionService.MIN_LOCATIONS
        assert result["minimum_retention"]["evidence_days"] == DataRetentionService.MIN_EVIDENCE

    def test_returns_next_cleanup(self, svc):
        result = svc.get_cleanup_schedule()
        assert "next_cleanup" in result
