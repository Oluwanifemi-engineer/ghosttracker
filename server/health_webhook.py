"""
Magneetar Health Alert Webhook Integration
Sends health alerts to Slack, Discord, or custom webhook endpoints.

Usage:
    from health_webhook import send_health_alert

    await send_health_alert("down", "Server is unreachable")
    await send_health_alert("recovery", "Service recovered")
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class HealthAlertWebhook:
    """Send health alerts via webhook (Slack/Discord/custom).

    Features:
    - Rate limiting (one alert per incident, cooldown period)
    - Automatic recovery notifications
    - Rich message formatting for Slack and Discord
    """

    def __init__(self):
        self._last_alert_time: dict[str, float] = {}
        self._cooldown_seconds = 30 * 60  # 30 minutes between repeated alerts
        self._incident_start: dict[str, datetime] = {}

    def _should_alert(self, alert_type: str) -> bool:
        """Check if we should send an alert (respecting cooldown)."""
        now = time.time()
        last = self._last_alert_time.get(alert_type, 0)
        if now - last < self._cooldown_seconds:
            return False
        return True

    def _record_alert(self, alert_type: str):
        """Record that we sent an alert."""
        self._last_alert_time[alert_type] = time.time()

    def _format_slack_message(self, level: str, message: str) -> dict:
        """Format a Slack-compatible message."""
        emoji = "🔴" if level == "down" else "🟢"
        color = "#FF0000" if level == "down" else "#00FF00"

        now = datetime.now(timezone.utc).isoformat()
        incident_start = self._incident_start.get(level)

        fields = []
        if incident_start:
            fields.append(
                {
                    "title": "Incident Started",
                    "value": incident_start.isoformat(),
                    "short": True,
                }
            )
        fields.append(
            {
                "title": "Checked At",
                "value": now,
                "short": True,
            }
        )

        return {
            "attachments": [
                {
                    "color": color,
                    "title": f"{emoji} Magneetar Health Alert: {level.upper()}",
                    "text": message,
                    "fields": fields,
                    "footer": "Magneetar Health Monitor",
                    "ts": int(time.time()),
                }
            ]
        }

    def _format_discord_message(self, level: str, message: str) -> dict:
        """Format a Discord-compatible webhook message."""
        emoji = "🔴" if level == "down" else "🟢"
        color = 0xFF0000 if level == "down" else 0x00FF00

        now = datetime.now(timezone.utc).isoformat()

        embed = {
            "title": f"{emoji} Magneetar Health Alert: {level.upper()}",
            "description": message,
            "color": color,
            "fields": [
                {"name": "Status", "value": level.upper(), "inline": True},
                {"name": "Time", "value": now, "inline": True},
            ],
            "footer": {"text": "Magneetar Health Monitor"},
            "timestamp": now,
        }

        return {"embeds": [embed]}

    def _format_generic_message(self, level: str, message: str) -> dict:
        """Format a generic JSON webhook message."""
        emoji = "🔴" if level == "down" else "🟢"
        return {
            "text": f"{emoji} Magneetar {level}: {message}",
            "level": level,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "incident_start": (self._incident_start.get(level).isoformat() if level in self._incident_start else None),
        }

    async def send_alert(
        self,
        level: str,
        message: str,
        webhook_url: Optional[str] = None,
        webhook_type: str = "auto",
    ) -> bool:
        """Send a health alert via webhook.

        Args:
            level: "down" or "recovery"
            message: Alert message text
            webhook_url: Override webhook URL (default: MT_ALERT_WEBHOOK env)
            webhook_type: "slack", "discord", or "auto" (detect from URL)

        Returns:
            True if alert was sent, False otherwise
        """
        url = webhook_url or os.environ.get("MT_ALERT_WEBHOOK", "")
        if not url:
            return False

        # Rate limiting
        if not self._should_alert(level):
            logger.debug(f"Health alert ({level}) suppressed by cooldown")
            return False

        # Track incident timing
        if level == "down" and level not in self._incident_start:
            self._incident_start[level] = datetime.now(timezone.utc)
        elif level == "recovery":
            self._incident_start.pop("down", None)

        # Detect webhook type
        if webhook_type == "auto":
            if "slack.com" in url:
                webhook_type = "slack"
            elif "discord.com" in url:
                webhook_type = "discord"
            else:
                webhook_type = "generic"

        # Format message
        if webhook_type == "slack":
            payload = self._format_slack_message(level, message)
        elif webhook_type == "discord":
            payload = self._format_discord_message(level, message)
        else:
            payload = self._format_generic_message(level, message)

        # Send
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    timeout=10,
                    headers={"Content-Type": "application/json"},
                )
                if response.status_code in (200, 204):
                    self._record_alert(level)
                    logger.info(f"Health alert ({level}) sent via {webhook_type}")
                    return True
                else:
                    logger.warning(f"Health alert webhook returned {response.status_code}: " f"{response.text[:200]}")
                    return False
        except Exception as e:
            logger.warning(f"Health alert webhook failed: {e}")
            return False


# Singleton
health_webhook = HealthAlertWebhook()


async def send_health_alert(level: str, message: str) -> bool:
    """Convenience function to send a health alert."""
    return await health_webhook.send_alert(level, message)
