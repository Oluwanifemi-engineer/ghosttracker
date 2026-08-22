"""
Magneetar Onboarding Email Cron Job
Runs periodically to send onboarding emails based on user signup timing.

Schedule:
- Every hour: check for users who need day1, day3, or day7 emails
- Only sends once per user per email type (tracked via onboarding_email_sent)

Run manually: python -m cron_onboarding
Run via cron: 0 * * * * cd /app && python -m cron_onboarding
"""

import logging
from datetime import datetime, timedelta, timezone

from database import get_db_context

logger = logging.getLogger(__name__)


def run_onboarding_cron():
    """Check for users who need onboarding emails and send them."""
    now = datetime.now(timezone.utc)

    with get_db_context() as db:
        # Ensure tracking column exists
        db.execute(
            """
            ALTER TABLE users ADD COLUMN onboarding_day1_sent INTEGER DEFAULT 0
        """
        )
        db.execute(
            """
            ALTER TABLE users ADD COLUMN onboarding_day3_sent INTEGER DEFAULT 0
        """
        )
        db.execute(
            """
            ALTER TABLE users ADD COLUMN onboarding_day7_sent INTEGER DEFAULT 0
        """
        )
        db.commit()

    emails_sent = 0

    # Day 1: sent 1 day after signup
    emails_sent += _send_day1_emails(now)

    # Day 3: sent 3 days after signup
    emails_sent += _send_day3_emails(now)

    # Day 7: sent 7 days after signup
    emails_sent += _send_day7_emails(now)

    logger.info("Onboarding cron complete: %d emails sent", emails_sent)
    return emails_sent


def _send_day1_emails(now: datetime) -> int:
    """Send day 1 follow-up emails."""
    cutoff = (now - timedelta(hours=25)).isoformat()  # ~1 day ago
    cutoff_min = (now - timedelta(hours=26)).isoformat()  # Not sent yet window

    with get_db_context() as db:
        users = db.execute(
            """SELECT id, display_name, email FROM users
               WHERE created_at <= ? AND created_at > ?
               AND onboarding_day1_sent = 0""",
            (cutoff, cutoff_min),
        ).fetchall()

    sent = 0
    for user_id, name, email in users:
        try:
            from email_service import send_day1_followup

            send_day1_followup(name or email.split("@"), email)

            with get_db_context() as db:
                db.execute(
                    "UPDATE users SET onboarding_day1_sent = 1 WHERE id = ?",
                    (user_id,),
                )
                db.commit()
            sent += 1
        except Exception as e:
            logger.error("Failed to send day1 email to %s: %s", email, e)

    return sent


def _send_day3_emails(now: datetime) -> int:
    """Send day 3 circle reminder emails."""
    cutoff = (now - timedelta(days=3, hours=1)).isoformat()
    cutoff_min = (now - timedelta(days=3, hours=2)).isoformat()

    with get_db_context() as db:
        users = db.execute(
            """SELECT id, display_name, email FROM users
               WHERE created_at <= ? AND created_at > ?
               AND onboarding_day3_sent = 0
               AND subscription_plan = 'free'""",
            (cutoff, cutoff_min),
        ).fetchall()

    sent = 0
    for user_id, name, email in users:
        try:
            from email_service import send_day3_circle_reminder

            send_day3_circle_reminder(name or email.split("@"), email)

            with get_db_context() as db:
                db.execute(
                    "UPDATE users SET onboarding_day3_sent = 1 WHERE id = ?",
                    (user_id,),
                )
                db.commit()
            sent += 1
        except Exception as e:
            logger.error("Failed to send day3 email to %s: %s", email, e)

    return sent


def _send_day7_emails(now: datetime) -> int:
    """Send day 7 engagement emails."""
    cutoff = (now - timedelta(days=7, hours=1)).isoformat()
    cutoff_min = (now - timedelta(days=7, hours=2)).isoformat()

    with get_db_context() as db:
        users = db.execute(
            """SELECT id, display_name, email FROM users
               WHERE created_at <= ? AND created_at > ?
               AND onboarding_day7_sent = 0
               AND subscription_plan = 'free'""",
            (cutoff, cutoff_min),
        ).fetchall()

    sent = 0
    for user_id, name, email in users:
        try:
            from email_service import send_day7_engagement

            send_day7_engagement(name or email.split("@"), email)

            with get_db_context() as db:
                db.execute(
                    "UPDATE users SET onboarding_day7_sent = 1 WHERE id = ?",
                    (user_id,),
                )
                db.commit()
            sent += 1
        except Exception as e:
            logger.error("Failed to send day7 email to %s: %s", email, e)

    return sent


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_onboarding_cron()
