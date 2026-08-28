"""
FCM Command Push — Deliver commands to devices via Firebase Cloud Messaging.

When a device is offline (WebSocket dead) and SMS relay is unavailable,
FCM high-priority data messages can wake the app from Doze mode and
execute commands (lock, siren, wipe, etc.).

The Android app's MagneetarMessagingService handles incoming data messages
and routes them to the appropriate command executor.
"""

import asyncio
import json
from typing import Optional

from config import settings
from logging_config import get_logger

logger = get_logger("magneetar.fcm")


async def push_command_to_device(
    device_id: str,
    command: str,
    command_id: int,
    params: Optional[str] = None,
    priority: int = 5,
) -> bool:
    """Push a command to a device via FCM data message.

    Returns True if the message was accepted by FCM (device may or may not
    receive it — FCM is best-effort). Returns False if FCM is not configured
    or no tokens exist for the device.

    FCM data messages (not notification messages) are used because:
    1. They wake the app from Doze mode when sent with priority=high
    2. They are processed by onMessageReceived() even when the app is backgrounded
    3. They carry arbitrary key-value data (command, params, command_id)
    """
    if not settings.FIREBASE_CREDENTIALS:
        logger.debug("FCM not configured — skipping command push")
        return False

    # Look up FCM tokens for this device
    try:
        from database import get_db_context

        with get_db_context() as conn:
            rows = conn.execute(
                "SELECT fcm_token FROM fcm_tokens WHERE device_id=? ORDER BY updated_at DESC LIMIT 5",
                (device_id,),
            ).fetchall()

        if not rows:
            logger.debug(f"No FCM tokens for device {device_id}")
            return False

        tokens = [r["fcm_token"] for r in rows]
    except Exception as e:
        logger.warning(f"Failed to look up FCM tokens: {e}")
        return False

    # Build the data payload
    data_payload = {
        "type": "command",
        "command": command,
        "command_id": str(command_id),
        "params": params or "",
        "priority": str(priority),
    }

    # Send via Firebase Admin SDK (synchronous, run in thread)
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        # Initialize Firebase app if not already initialized
        try:
            firebase_admin.get_app()
        except ValueError:
            cred_path = settings.FIREBASE_CREDENTIALS
            if cred_path.startswith("{"):
                cred = credentials.Certificate(json.loads(cred_path))
            else:
                cred = credentials.Certificate(cred_path)
            await asyncio.to_thread(firebase_admin.initialize_app, cred)

        # Build FCM message with high priority to wake from Doze
        message = messaging.MulticastMessage(
            tokens=tokens,
            data=data_payload,
            android=messaging.AndroidConfig(
                priority="high",
                ttl=300,  # 5 minutes — command expires anyway
            ),
        )

        # Send in thread to avoid blocking the async event loop
        response = await asyncio.to_thread(messaging.send_each, message)

        success_count = response.success_count
        failure_count = response.failure_count

        if success_count > 0:
            logger.info(
                f"FCM command push accepted: {command} #{command_id} to {device_id} "
                f"({success_count}/{len(tokens)} tokens)"
            )

        if failure_count > 0:
            # Clean up stale tokens
            _cleanup_stale_tokens(response, tokens, device_id)

        return success_count > 0

    except ImportError:
        logger.warning("firebase-admin not installed — run: pip install firebase-admin")
        return False
    except Exception as e:
        logger.error(f"FCM command push failed: {e}")
        return False


def _cleanup_stale_tokens(response, tokens: list, device_id: str) -> None:
    """Remove FCM tokens that FCM rejected (unregistered/invalid)."""
    try:
        from database import get_db_context

        with get_db_context() as conn:
            for i, result in enumerate(response.responses):
                if not result.success and i < len(tokens):
                    error = result.exception
                    if error and ("NotRegistered" in str(error) or "registration-token-not-registered" in str(error)):
                        conn.execute(
                            "DELETE FROM fcm_tokens WHERE device_id=? AND fcm_token=?",
                            (device_id, tokens[i]),
                        )
                        logger.info(f"Removed stale FCM token for device {device_id}")
            conn.commit()
    except Exception as e:
        logger.warning(f"Stale token cleanup failed: {e}")
