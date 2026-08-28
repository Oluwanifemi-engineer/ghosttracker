"""Tests for FCM command push (server/fcm_command.py)."""

from unittest.mock import MagicMock, patch

import pytest


class TestFcmCommandPush:
    """Test the FCM command push module."""

    @pytest.mark.asyncio
    async def test_fcm_not_configured_returns_false(self):
        """FCM push returns False when FIREBASE_CREDENTIALS is not set."""
        from fcm_command import push_command_to_device

        with patch("fcm_command.settings") as mock_settings:
            mock_settings.FIREBASE_CREDENTIALS = ""
            result = await push_command_to_device("dev-1", "lock", 1)
            assert result is False

    @pytest.mark.asyncio
    async def test_fcm_no_tokens_returns_false(self):
        """FCM push returns False when device has no FCM tokens."""
        from fcm_command import push_command_to_device

        with patch("fcm_command.settings") as mock_settings, patch("database.get_db_context") as mock_db:
            mock_settings.FIREBASE_CREDENTIALS = "firebase-key.json"
            mock_conn = MagicMock()
            mock_conn.execute.return_value.fetchall.return_value = []
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_conn)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            result = await push_command_to_device("dev-1", "lock", 1)
            assert result is False

    @pytest.mark.asyncio
    async def test_fcm_push_sends_multicast(self):
        """FCM push sends a multicast message to all device tokens."""
        from fcm_command import push_command_to_device

        with patch("fcm_command.settings") as mock_settings, patch("database.get_db_context") as mock_db:
            mock_settings.FIREBASE_CREDENTIALS = "firebase-key.json"
            mock_conn = MagicMock()
            mock_conn.execute.return_value.fetchall.return_value = [
                {"fcm_token": "token-1"},
                {"fcm_token": "token-2"},
            ]
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_conn)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            # Mock firebase_admin
            mock_response = MagicMock()
            mock_response.success_count = 2
            mock_response.failure_count = 0
            mock_response.responses = []

            with patch("firebase_admin.get_app", side_effect=ValueError), patch("firebase_admin.initialize_app"), patch(
                "firebase_admin.messaging.MulticastMessage"
            ), patch("firebase_admin.messaging.send_each", return_value=mock_response):
                result = await push_command_to_device("dev-1", "lock", 42, params="msg=help")
                assert result is True

    @pytest.mark.asyncio
    async def test_fcm_push_partial_failure(self):
        """FCM push returns True even if some tokens fail."""
        from fcm_command import push_command_to_device

        with patch("fcm_command.settings") as mock_settings, patch("database.get_db_context") as mock_db:
            mock_settings.FIREBASE_CREDENTIALS = "firebase-key.json"
            mock_conn = MagicMock()
            mock_conn.execute.return_value.fetchall.return_value = [
                {"fcm_token": "token-good"},
                {"fcm_token": "token-stale"},
            ]
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_conn)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_response = MagicMock()
            mock_response.success_count = 1
            mock_response.failure_count = 1
            success_result = MagicMock()
            success_result.success = True
            fail_result = MagicMock()
            fail_result.success = False
            fail_result.exception = Exception("NotRegistered")
            mock_response.responses = [success_result, fail_result]

            with patch("firebase_admin.get_app"), patch("firebase_admin.messaging.MulticastMessage"), patch(
                "firebase_admin.messaging.send_each", return_value=mock_response
            ):
                result = await push_command_to_device("dev-1", "alarm", 99)
                assert result is True

    @pytest.mark.asyncio
    async def test_fcm_push_all_tokens_fail(self):
        """FCM push returns False when all tokens fail."""
        from fcm_command import push_command_to_device

        with patch("fcm_command.settings") as mock_settings, patch("database.get_db_context") as mock_db:
            mock_settings.FIREBASE_CREDENTIALS = "firebase-key.json"
            mock_conn = MagicMock()
            mock_conn.execute.return_value.fetchall.return_value = [
                {"fcm_token": "token-stale"},
            ]
            mock_db.return_value.__enter__ = MagicMock(return_value=mock_conn)
            mock_db.return_value.__exit__ = MagicMock(return_value=False)

            mock_response = MagicMock()
            mock_response.success_count = 0
            mock_response.failure_count = 1
            fail_result = MagicMock()
            fail_result.success = False
            fail_result.exception = Exception("NotRegistered")
            mock_response.responses = [fail_result]

            with patch("firebase_admin.get_app"), patch("firebase_admin.messaging.MulticastMessage"), patch(
                "firebase_admin.messaging.send_each", return_value=mock_response
            ):
                result = await push_command_to_device("dev-1", "wipe", 100)
                assert result is False
