"""
Magneetar Notification Integrations
Slack/Discord webhook notifications for urgent events.

Events:
- Urgent support tickets
- High sentinel score alerts
- System errors
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Webhook URLs (configure via environment variables)
SLACK_WEBHOOK_URL = os.getenv("MT_SLACK_WEBHOOK_URL", "")
DISCORD_WEBHOOK_URL = os.getenv("MT_DISCORD_WEBHOOK_URL", "")


async def notify_urgent_ticket(
    ticket_id: str,
    subject: str,
    category: str,
    user_email: str,
    description: str,
):
    """Send notification for urgent support tickets."""
    message = {
        "text": "Urgent Support Ticket",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "🚨 Urgent Support Ticket"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Ticket:*\n#{ticket_id[:8]}"},
                    {"type": "mrkdwn", "text": f"*Category:*\n{category}"},
                    {"type": "mrkdwn", "text": f"*From:*\n{user_email}"},
                    {"type": "mrkdwn", "text": f"*Subject:*\n{subject}"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Description:*\n{description[:500]}"},
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Ticket"},
                        "url": f"{os.getenv('MT_FRONTEND_URL', 'https://magneetar.me')}/admin",
                    }
                ],
            },
        ],
    }

    await _send_slack(message)
    await _send_discord(
        {
            "embeds": [
                {
                    "title": "🚨 Urgent Support Ticket",
                    "description": f"**{subject}**\n\n{description[:1000]}",
                    "color": 0xFF0000,
                    "fields": [
                        {"name": "Ticket", "value": f"#{ticket_id[:8]}", "inline": True},
                        {"name": "Category", "value": category, "inline": True},
                        {"name": "From", "value": user_email, "inline": True},
                    ],
                    "footer": {"text": "Magneetar Support"},
                }
            ]
        }
    )


async def notify_high_sentinel_score(
    device_id: str,
    device_name: str,
    score: int,
    owner_email: str,
):
    """Send notification when a device has a high sentinel score."""
    message = {
        "text": f"⚠️ *High Sentinel Score: {device_name}*",
        "blocks": [
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Device:*\n{device_name}"},
                    {"type": "mrkdwn", "text": f"*Score:*\n{score}/100"},
                    {"type": "mrkdwn", "text": f"*Owner:*\n{owner_email}"},
                ],
            },
        ],
    }

    await _send_slack(message)
    await _send_discord(
        {
            "embeds": [
                {
                    "title": f"⚠️ High Sentinel Score: {device_name}",
                    "description": f"Score: {score}/100",
                    "color": 0xFFA500,
                    "fields": [
                        {"name": "Device", "value": device_id[:16], "inline": True},
                        {"name": "Owner", "value": owner_email, "inline": True},
                    ],
                }
            ]
        }
    )


async def notify_system_error(
    error_type: str,
    message: str,
    details: Optional[str] = None,
):
    """Send notification for system errors."""
    payload = {
        "text": f"🔴 *System Error: {error_type}*",
        "blocks": [
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Error:*\n{error_type}"},
                    {"type": "mrkdwn", "text": f"*Message:*\n{message[:500]}"},
                ],
            },
        ],
    }

    if details:
        payload["blocks"].append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Details:*\n```{details[:1000]}```"},
            }
        )

    await _send_slack(payload)
    await _send_discord(
        {
            "embeds": [
                {
                    "title": f"🔴 System Error: {error_type}",
                    "description": message[:2000],
                    "color": 0xFF0000,
                }
            ]
        }
    )


async def _send_slack(payload: dict):
    """Send message to Slack webhook."""
    if not SLACK_WEBHOOK_URL:
        return

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                SLACK_WEBHOOK_URL,
                json=payload,
                timeout=10,
            )
            if resp.status_code != 200:
                logger.warning("Slack webhook failed: %s", resp.status_code)
    except Exception as e:
        logger.error("Slack webhook error: %s", e)


async def _send_discord(payload: dict):
    """Send message to Discord webhook."""
    if not DISCORD_WEBHOOK_URL:
        return

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                DISCORD_WEBHOOK_URL,
                json=payload,
                timeout=10,
            )
            if resp.status_code != 200:
                logger.warning("Discord webhook failed: %s", resp.status_code)
    except Exception as e:
        logger.error("Discord webhook error: %s", e)
