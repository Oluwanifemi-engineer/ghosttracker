"""
Magneetar Support Ticket System
Users submit support requests, admins view and respond.

Features:
- Submit tickets with category and description
- Admin view with status filters
- Admin responses and status updates
- Auto-assignment based on category
"""

import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/support", tags=["support"])


# ─── Models ──────────────────────────────────────────────────────────────────


class TicketCreateRequest(BaseModel):
    subject: str
    description: str
    category: str  # "bug", "feature", "billing", "account", "other"
    priority: str = "normal"  # "low", "normal", "high", "urgent"
    device_id: Optional[str] = None


class TicketResponseRequest(BaseModel):
    message: str


class TicketStatusUpdate(BaseModel):
    status: str  # "open", "in_progress", "resolved", "closed"
    assigned_to: Optional[str] = None


# ─── Create Ticket ──────────────────────────────────────────────────────────


@router.post("/tickets")
async def create_ticket(
    req: TicketCreateRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Submit a support ticket."""
    user_id = user_id_from_subject(auth)

    ticket_id = f"tkt_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()

    with get_db_context() as db:
        # Create table if not exists
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS support_tickets (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'normal',
                status TEXT NOT NULL DEFAULT 'open',
                device_id TEXT,
                assigned_to TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                resolved_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """
        )

        db.execute(
            """
            CREATE TABLE IF NOT EXISTS ticket_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id TEXT NOT NULL,
                responder_id TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
                FOREIGN KEY (responder_id) REFERENCES users(id)
            )
        """
        )

        db.execute(
            """INSERT INTO support_tickets
               (id, user_id, subject, description, category, priority, status, device_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)""",
            (ticket_id, user_id, req.subject, req.description, req.category, req.priority, req.device_id, now, now),
        )
        db.commit()

        # Send confirmation email (fire-and-forget)
        try:
            user = db.execute("SELECT display_name, email FROM users WHERE id = ?", (user_id,)).fetchone()
            if user:
                from email_service import send_ticket_created

                send_ticket_created(user[0] or user[1].split("@")[0], user[1], ticket_id, req.subject)
        except Exception:
            pass

        # Send Slack/Discord alert for urgent tickets (fire-and-forget)
        if req.priority in ("urgent", "high"):
            try:
                from routes.notifications import notify_urgent_ticket

                user_email = db.execute("SELECT email FROM users WHERE id = ?", (user_id,)).fetchone()
                import asyncio

                asyncio.create_task(
                    notify_urgent_ticket(
                        ticket_id=ticket_id,
                        subject=req.subject,
                        category=req.category,
                        user_email=user_email[0] if user_email else "unknown",
                        description=req.description,
                    )
                )
            except Exception:
                pass

    return {"ok": True, "ticket_id": ticket_id, "status": "open"}


# ─── Get My Tickets ─────────────────────────────────────────────────────────


@router.get("/tickets")
async def get_my_tickets(
    status: Optional[str] = None,
    auth: str = Depends(require_dashboard_auth),
):
    """Get support tickets submitted by the current user."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        if status:
            tickets = db.execute(
                """SELECT id, subject, category, priority, status, created_at, updated_at
                   FROM support_tickets
                   WHERE user_id = ? AND status = ?
                   ORDER BY created_at DESC""",
                (user_id, status),
            ).fetchall()
        else:
            tickets = db.execute(
                """SELECT id, subject, category, priority, status, created_at, updated_at
                   FROM support_tickets
                   WHERE user_id = ?
                   ORDER BY created_at DESC""",
                (user_id,),
            ).fetchall()

    return {
        "tickets": [
            {
                "id": r[0],
                "subject": r[1],
                "category": r[2],
                "priority": r[3],
                "status": r[4],
                "created_at": r[5],
                "updated_at": r[6],
            }
            for r in tickets
        ]
    }


# ─── Get Ticket Detail ──────────────────────────────────────────────────────


@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: str,
    auth: str = Depends(require_dashboard_auth),
):
    """Get ticket detail with responses."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        ticket = db.execute(
            """SELECT t.id, t.subject, t.description, t.category, t.priority,
                      t.status, t.device_id, t.assigned_to, t.created_at, t.updated_at,
                      u.display_name as user_name, u.email as user_email
               FROM support_tickets t
               JOIN users u ON t.user_id = u.id
               WHERE t.id = ? AND (t.user_id = ? OR EXISTS (
                   SELECT 1 FROM users WHERE id = ? AND role = 'admin'
               ))""",
            (ticket_id, user_id, user_id),
        ).fetchone()

        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        responses = db.execute(
            """SELECT r.id, r.message, r.created_at,
                      u.display_name as responder_name, u.role as responder_role
               FROM ticket_responses r
               JOIN users u ON r.responder_id = u.id
               WHERE r.ticket_id = ?
               ORDER BY r.created_at ASC""",
            (ticket_id,),
        ).fetchall()

    return {
        "ticket": {
            "id": ticket[0],
            "subject": ticket[1],
            "description": ticket[2],
            "category": ticket[3],
            "priority": ticket[4],
            "status": ticket[5],
            "device_id": ticket[6],
            "assigned_to": ticket[7],
            "created_at": ticket[8],
            "updated_at": ticket[9],
            "user_name": ticket[10],
            "user_email": ticket[11],
        },
        "responses": [
            {
                "id": r[0],
                "message": r[1],
                "created_at": r[2],
                "responder_name": r[3],
                "responder_role": r[4],
            }
            for r in responses
        ],
    }


# ─── Respond to Ticket (Admin) ──────────────────────────────────────────────


@router.post("/tickets/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: str,
    req: TicketResponseRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Respond to a support ticket (admin only)."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Verify admin
        user = db.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user or user[0] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        # Verify ticket exists
        ticket = db.execute("SELECT id FROM support_tickets WHERE id = ?", (ticket_id,)).fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        now = datetime.now(timezone.utc).isoformat()

        # Add response
        db.execute(
            """INSERT INTO ticket_responses (ticket_id, responder_id, message, created_at)
               VALUES (?, ?, ?, ?)""",
            (ticket_id, user_id, req.message, now),
        )

        # Update ticket status to in_progress if it was open
        db.execute(
            """UPDATE support_tickets
               SET status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                   updated_at = ?
               WHERE id = ?""",
            (now, ticket_id),
        )
        db.commit()

        # Send email notification to ticket owner (fire-and-forget)
        try:
            ticket_owner = db.execute(
                "SELECT u.display_name, u.email FROM support_tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ?",
                (ticket_id,),
            ).fetchone()
            admin_user = db.execute("SELECT display_name FROM users WHERE id = ?", (user_id,)).fetchone()
            if ticket_owner and admin_user:
                from email_service import send_ticket_response

                send_ticket_response(
                    ticket_owner[0] or ticket_owner[1].split("@")[0],
                    ticket_owner[1],
                    ticket_id,
                    ticket.subject if "ticket" in dir() else "Support Request",
                    req.message,
                    admin_user[0] or "Support Team",
                )
        except Exception:
            pass

    return {"ok": True, "message": "Response added"}


# ─── Update Ticket Status (Admin) ───────────────────────────────────────────


@router.put("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    req: TicketStatusUpdate,
    auth: str = Depends(require_dashboard_auth),
):
    """Update ticket status and assignment (admin only)."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Verify admin
        user = db.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user or user[0] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        now = datetime.now(timezone.utc).isoformat()

        updates = ["updated_at = ?"]
        params = [now]

        if req.status:
            updates.append("status = ?")
            params.append(req.status)
            if req.status in ("resolved", "closed"):
                updates.append("resolved_at = ?")
                params.append(now)

        if req.assigned_to:
            updates.append("assigned_to = ?")
            params.append(req.assigned_to)

        params.append(ticket_id)

        db.execute(
            f"UPDATE support_tickets SET {', '.join(updates)} WHERE id = ?",
            params,
        )
        db.commit()

    return {"ok": True, "status": req.status}


# ─── Admin: List All Tickets ────────────────────────────────────────────────


@router.get("/admin/tickets")
async def admin_list_tickets(
    status: Optional[str] = None,
    category: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    auth: str = Depends(require_dashboard_auth),
):
    """List all support tickets (admin only)."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Verify admin
        user = db.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user or user[0] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        offset = (page - 1) * limit
        conditions = []
        params = []

        if status:
            conditions.append("t.status = ?")
            params.append(status)
        if category:
            conditions.append("t.category = ?")
            params.append(category)

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        tickets = db.execute(
            f"""SELECT t.id, t.subject, t.category, t.priority, t.status,
                       t.created_at, t.updated_at,
                       u.display_name as user_name, u.email as user_email,
                       (SELECT COUNT(*) FROM ticket_responses WHERE ticket_id = t.id) as response_count
                FROM support_tickets t
                JOIN users u ON t.user_id = u.id
                {where}
                ORDER BY
                    CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                    t.created_at DESC
                LIMIT ? OFFSET ?""",
            params + [limit, offset],
        ).fetchall()

        total = db.execute(
            f"SELECT COUNT(*) FROM support_tickets t {where}",
            params,
        ).fetchone()[0]

    return {
        "tickets": [
            {
                "id": r[0],
                "subject": r[1],
                "category": r[2],
                "priority": r[3],
                "status": r[4],
                "created_at": r[5],
                "updated_at": r[6],
                "user_name": r[7],
                "user_email": r[8],
                "response_count": r[9],
            }
            for r in tickets
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }
