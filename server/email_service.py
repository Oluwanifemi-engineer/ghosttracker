"""
Magneetar Email Service
Handles transactional emails and onboarding sequences.

Emails are sent via SMTP (configurable) or a third-party provider.
For now, we use a simple SMTP approach that can be swapped for
SendGrid, Resend, or Mailgun later.
"""

import os
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# ─── Configuration ──────────────────────────────────────────────────────────

SMTP_HOST = os.getenv("MT_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("MT_SMTP_PORT", "587"))
SMTP_USER = os.getenv("MT_SMTP_USER", "")
SMTP_PASS = os.getenv("MT_SMTP_PASS", "")
FROM_EMAIL = os.getenv("MT_FROM_EMAIL", "noreply@magneetar.me")
FROM_NAME = os.getenv("MT_FROM_NAME", "Magneetar")

FRONTEND_URL = os.getenv("MT_FRONTEND_URL", "https://magneetar.me")


# ─── Email Templates ────────────────────────────────────────────────────────


# In-memory email event log (replace with DB table in production)
_email_events: list[dict] = []
_MAX_EVENTS = 10000


def _log_email_event(email: str, subject: str, status: str, error: str = ""):
    """Log an email send/open/click event."""
    global _email_events
    _email_events.append(
        {
            "email": email,
            "subject": subject,
            "status": status,
            "error": error,
            "ts": datetime.now(timezone.utc).isoformat() if "datetime" in dir() else "",
        }
    )
    if len(_email_events) > _MAX_EVENTS:
        _email_events = _email_events[-_MAX_EVENTS:]


def get_email_stats() -> dict:
    """Get email delivery statistics."""
    total = len(_email_events)
    sent = sum(1 for e in _email_events if e["status"] == "sent")
    failed = sum(1 for e in _email_events if e["status"] == "failed")
    opened = sum(1 for e in _email_events if e["status"] == "opened")
    clicked = sum(1 for e in _email_events if e["status"] == "clicked")
    return {
        "total": total,
        "sent": sent,
        "failed": failed,
        "opened": opened,
        "clicked": clicked,
        "open_rate": round(opened / sent * 100, 1) if sent > 0 else 0,
        "click_rate": round(clicked / sent * 100, 1) if sent > 0 else 0,
        "delivery_rate": round(sent / total * 100, 1) if total > 0 else 0,
    }


def get_recent_emails(limit: int = 50) -> list[dict]:
    """Get recent email events."""
    return list(reversed(_email_events[-limit:]))


def _base_template(content: str, preview_text: str = "") -> str:
    """Wrap content in a clean, responsive email template."""
    tracking_id = str(uuid.uuid4())[:8]
    # Tracking pixel for open tracking
    tracking_pixel = (
        f'<img src="{FRONTEND_URL}/api/email/track/open?id={tracking_id}" width="1" height="1" style="display:none" />'
    )
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Magneetar</title>
</head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">  # noqa: E501  # noqa: E501
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Preview text -->
    <div style="display:none;max-height:0;overflow:hidden;">{preview_text}</div>

    {tracking_pixel}

    <!-- Header -->
    <div style="padding:32px 40px 24px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:18px;font-weight:800;letter-spacing:0.15em;color:#111827;">MAGNEETAR</div>
      <div style="font-size:9px;font-family:monospace;color:#9ca3af;letter-spacing:0.2em;margin-top:4px;">TRACK · PROTECT · RECOVER</div>  # noqa: E501  # noqa: E501
    </div>

    <!-- Content -->
    <div style="padding:32px 40px;">
      {content}
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:1px solid #e5e7eb;background:#f9fafb;">
      <div style="font-size:11px;color:#9ca3af;text-align:center;">
        <p>Magneetar — Protect what you own. Stay close to who you love.</p>
        <p style="margin-top:8px;">
          <a href="{FRONTEND_URL}/unsubscribe" style="color:#9ca3af;">Unsubscribe</a> ·
          <a href="{FRONTEND_URL}/privacy" style="color:#9ca3af;">Privacy</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>"""


def welcome_email(name: str, email: str) -> tuple[str, str]:
    """Welcome email sent immediately after signup."""
    content = f"""
      <h1 style="font-size:24px;font-weight:800;color:#111827;margin:0 0 16px;">Welcome to Magneetar, {name.split()[0]}! 🎉</h1>  # noqa: E501  # noqa: E501
      <p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        You've just joined thousands of people protecting what matters most — their devices and their people.
      </p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 24px;">
        <h2 style="font-size:14px;font-weight:700;color:#166534;margin:0 0 12px;">🚀 Quick Start (2 minutes)</h2>
        <div style="font-size:14px;color:#166534;line-height:1.8;">
          <p style="margin:0 0 8px;"><strong>1.</strong> Download the APK from <a href="{FRONTEND_URL}/download" style="color:#166534;">magneetar.me/download</a></p>  # noqa: E501  # noqa: E501
          <p style="margin:0 0 8px;"><strong>2.</strong> Install and grant permissions (takes 30 seconds)</p>
          <p style="margin:0 0 8px;"><strong>3.</strong> Open the dashboard and see your device in real-time</p>
        </div>
      </div>

      <h2 style="font-size:14px;font-weight:700;color:#111827;margin:0 0 12px;">What you get for free:</h2>
      <ul style="font-size:14px;color:#6b7280;line-height:1.8;padding-left:20px;margin:0 0 24px;">
        <li>Real-time device tracking</li>
        <li>Remote lock &amp; alarm</li>
        <li>Community watch map</li>
        <li>Basic security score</li>
      </ul>

      <a href="{FRONTEND_URL}/download" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.05em;">  # noqa: E501  # noqa: E501
        Download APK →
      </a>
    """
    return (
        f"Welcome to Magneetar, {name.split()[0]}!",
        _base_template(content, "Welcome to Magneetar — let's protect what matters."),
    )


def day1_followup(name: str, email: str) -> tuple[str, str]:
    """Day 1 follow-up — did they install the app?"""
    content = f"""
      <h1 style="font-size:20px;font-weight:800;color:#111827;margin:0 0 16px;">Did you get Magneetar set up?</h1>
      <p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Hey {name.split()[0]}, we noticed you haven't installed the app yet. It only takes 2 minutes — and it's the only way to protect your phone.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 24px;">
        <h3 style="font-size:13px;font-weight:700;color:#111827;margin:0 0 12px;">Why people love Magneetar:</h3>
        <div style="font-size:14px;color:#6b7280;line-height:1.8;">
          <p style="margin:0 0 8px;">✅ <strong>3-second GPS updates</strong> — know exactly where your device is</p>
          <p style="margin:0 0 8px;">✅ <strong>Panic Button</strong> — one tap alerts your entire circle</p>
          <p style="margin:0 0 8px;">✅ <strong>Community recovery</strong> — phones get found when people help each other</p>  # noqa: E501  # noqa: E501
        </div>
      </div>

      <a href="{FRONTEND_URL}/download" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.05em;">  # noqa: E501  # noqa: E501
        Install Magneetar Now →
      </a>
    """
    return (
        "Still haven't installed Magneetar?",
        _base_template(content, "Your phone is unprotected — let's fix that in 2 minutes."),
    )


def day3_circle_reminder(name: str, email: str) -> tuple[str, str]:
    """Day 3 — remind about Family/Circle feature."""
    content = f"""
      <h1 style="font-size:20px;font-weight:800;color:#111827;margin:0 0 16px;">Your people need to be in your circle</h1>  # noqa: E501  # noqa: E501
      <p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Magneetar isn't just about protecting your phone — it's about staying connected with the people who matter.
      </p>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:0 0 24px;">
        <h3 style="font-size:13px;font-weight:700;color:#1e40af;margin:0 0 12px;">👤 Your Circle</h3>
        <p style="font-size:14px;color:#1e40af;line-height:1.6;margin:0 0 16px;">
          Invite your family, coworkers, or friends to your circle. You'll see each other's locations in real-time — no more "where are you?" texts.
        </p>
        <div style="font-size:13px;color:#1e40af;line-height:1.8;">
          <p style="margin:0 0 4px;">👨‍👩‍👧‍👦 <strong>Family</strong> — know your kids arrived at school safely</p>
          <p style="margin:0 0 4px;">👥 <strong>Coworkers</strong> — coordinate without constant calls</p>
          <p style="margin:0 0 4px;">💑 <strong>Partners</strong> — peace of mind without asking</p>
          <p style="margin:0 0 4px;">🏘️ <strong>Friends</strong> — meet up without "where are you?" texts</p>
        </div>
      </div>

      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        <strong>Upgrade to Personal (₦500/month)</strong> to create a circle of up to 5 people.
      </p>

      <a href="{FRONTEND_URL}/login" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.05em;">  # noqa: E501  # noqa: E501
        Open Dashboard →
      </a>
    """
    return ("Your circle is waiting", _base_template(content, "Family, friends, coworkers — stay connected."))


def day7_engagement(name: str, email: str) -> tuple[str, str]:
    """Day 7 — feature showcase + upgrade push."""
    content = f"""
      <h1 style="font-size:20px;font-weight:800;color:#111827;margin:0 0 16px;">You're protecting 1 device. What about the others?</h1>  # noqa: E501  # noqa: E501
      <p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Hey {name.split()[0]}, you've been using Magneetar for a week. Here's what you're missing with the free plan:
      </p>

      <div style="margin:0 0 24px;">
        <div style="display:flex;align-items:flex-start;gap:12px;margin:0 0 16px;">
          <div style="width:32px;height:32px;border-radius:8px;background:#fef3c7;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">⚡</div>  # noqa: E501  # noqa: E501
          <div>
            <h3 style="font-size:13px;font-weight:700;color:#111827;margin:0;">Real-time Tracking</h3>
            <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Free: 5 min updates → Personal: <strong>3-second updates</strong></p>  # noqa: E501  # noqa: E501
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;margin:0 0 16px;">
          <div style="width:32px;height:32px;border-radius:8px;background:#fce7f3;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">👨‍👩‍👧‍👦</div>  # noqa: E501  # noqa: E501
          <div>
            <h3 style="font-size:13px;font-weight:700;color:#111827;margin:0;">Family Circles</h3>
            <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">Free: not available → Personal: <strong>up to 5 people</strong></p>  # noqa: E501  # noqa: E501
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:12px;margin:0 0 16px;">
          <div style="width:32px;height:32px;border-radius:8px;background:#fee2e2;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">🆘</div>  # noqa: E501  # noqa: E501
          <div>
            <h3 style="font-size:13px;font-weight:700;color:#111827;margin:0;">Panic Button</h3>
            <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">One-tap SOS with evidence capture + family alerts</p>  # noqa: E501  # noqa: E501
          </div>
        </div>
      </div>

      <p style="font-size:14px;color:#111827;font-weight:700;margin:0 0 24px;">
        Upgrade to Personal for ₦500/month — less than ₦17/day.
      </p>

      <a href="{FRONTEND_URL}/login" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.05em;">  # noqa: E501  # noqa: E501
        Upgrade Now →
      </a>
    """
    return (
        "You're missing out on protection",
        _base_template(content, "3-second tracking, family circles, panic button — unlock everything."),
    )


# ─── Email Sender ───────────────────────────────────────────────────────────


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send an email via SMTP. Returns True on success."""
    if not SMTP_USER or not SMTP_PASS:
        print(f"[EMAIL] Would send to {to_email}: {subject}")
        return True  # Silently succeed in dev

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())

        # Log send event
        _log_email_event(to_email, subject, "sent")
        return True
    except Exception as e:
        print(f"[EMAIL] Failed to send to {to_email}: {e}")
        _log_email_event(to_email, subject, "failed", str(e))
        return False


# ─── Onboarding Sequence ────────────────────────────────────────────────────


def send_welcome(name: str, email: str) -> bool:
    """Send welcome email immediately after signup."""
    subject, html = welcome_email(name, email)
    return send_email(email, subject, html)


def send_day1_followup(name: str, email: str) -> bool:
    """Send day 1 follow-up email."""
    subject, html = day1_followup(name, email)
    return send_email(email, subject, html)


def send_day3_circle_reminder(name: str, email: str) -> bool:
    """Send day 3 circle reminder."""
    subject, html = day3_circle_reminder(name, email)
    return send_email(email, subject, html)


def send_day7_engagement(name: str, email: str) -> bool:
    """Send day 7 engagement email."""
    subject, html = day7_engagement(name, email)
    return send_email(email, subject, html)


# ─── Support Ticket Emails ──────────────────────────────────────────────────


def ticket_created_email(name: str, email: str, ticket_id: str, subject_text: str) -> tuple[str, str]:
    """Confirmation email when a support ticket is created."""
    content = f"""
      <h1 style="font-size:20px;font-weight:800;color:#111827;margin:0 0 16px;">We got your message</h1>
      <p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Hey {name.split()[0]}, our team has received your support request and will respond within 24 hours.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 24px;">
        <div style="font-size:10px;font-family:monospace;color:#9ca3af;letter-spacing:0.1em;margin-bottom:8px;">TICKET</div>  # noqa: E501
        <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px;">{subject_text}</div>
        <div style="font-size:12px;font-family:monospace;color:#6b7280;">#{ticket_id[:16]}</div>
      </div>
      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0;">
        We'll email you when we respond. You can also check the status in your dashboard settings.
      </p>
    """
    return (
        f"Support request received — #{ticket_id[:8]}",
        _base_template(content, "We received your support request."),
    )


def ticket_response_email(
    name: str, email: str, ticket_id: str, subject_text: str, response_message: str, responder_name: str
) -> tuple[str, str]:
    """Email when an admin responds to a support ticket."""
    content = f"""
      <h1 style="font-size:20px;font-weight:800;color:#111827;margin:0 0 16px;">New response on your ticket</h1>
      <p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Hey {name.split()[0]}, {responder_name} responded to your support request.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 24px;">
        <div style="font-size:10px;font-family:monospace;color:#9ca3af;letter-spacing:0.1em;margin-bottom:8px;">{subject_text}</div>  # noqa: E501
        <div style="font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap;">{response_message}</div>
        <div style="font-size:11px;font-family:monospace;color:#9ca3af;margin-top:12px;">— {responder_name}</div>
      </div>
      <a href="{FRONTEND_URL}/login" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.05em;">  # noqa: E501
        View in Dashboard →
      </a>
    """
    return (f"Re: {subject_text}", _base_template(content, f"{responder_name} responded to your ticket."))


def ticket_resolved_email(name: str, email: str, ticket_id: str, subject_text: str) -> tuple[str, str]:
    """Email when a support ticket is resolved."""
    content = f"""
      <h1 style="font-size:20px;font-weight:800;color:#111827;margin:0 0 16px;">Your ticket has been resolved ✅</h1>
      <p style="font-size:15px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Hey {name.split()[0]}, your support request has been resolved.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 24px;">
        <div style="font-size:14px;font-weight:700;color:#166534;">{subject_text}</div>
        <div style="font-size:12px;font-family:monospace;color:#166534;margin-top:4px;">#{ticket_id[:16]}</div>
      </div>
      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        If you have any other issues, don't hesitate to reach out. Your feedback helps us improve.
      </p>
      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 16px;">
        How was your experience? Rate us so we can improve:
      </p>
      <div style="display:flex;gap:8px;margin:0 0 24px;">
        {[str(i) for i in range(11)].map(lambda s: f'<a href="{FRONTEND_URL}/nps?ticket={ticket_id}&score={s}" style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;border:1px solid #e5e7eb;font-size:13px;font-weight:700;color:#374151;text-decoration:none;">{s}</a>').join('')}  # noqa: E501
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;font-family:monospace;color:#9ca3af;margin-top:-16px;margin-bottom:24px;">  # noqa: E501
        <span>Not likely</span><span>Very likely</span>
      </div>
    """
    return (f"Ticket resolved — {subject_text}", _base_template(content, "Your support request has been resolved."))


def send_ticket_created(name: str, email: str, ticket_id: str, subject_text: str) -> bool:
    subject, html = ticket_created_email(name, email, ticket_id, subject_text)
    return send_email(email, subject, html)


def send_ticket_response(
    name: str, email: str, ticket_id: str, subject_text: str, response_message: str, responder_name: str
) -> bool:
    subject, html = ticket_response_email(name, email, ticket_id, subject_text, response_message, responder_name)
    return send_email(email, subject, html)


def send_ticket_resolved(name: str, email: str, ticket_id: str, subject_text: str) -> bool:
    subject, html = ticket_resolved_email(name, email, ticket_id, subject_text)
    return send_email(email, subject, html)
