"""
Magneetar NPS Survey
Collects Net Promoter Score feedback after support ticket resolution.

Flow:
1. Ticket is resolved → user receives email with survey link
2. User submits NPS score (0-10) + optional comment
3. Data stored for analytics dashboard
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/nps", tags=["nps"])


class NPSSubmitRequest(BaseModel):
    ticket_id: str
    score: int  # 0-10
    comment: Optional[str] = None


class NPSSummaryResponse(BaseModel):
    total_responses: int
    average_score: float
    promoters: int  # 9-10
    passives: int  # 7-8
    detractors: int  # 0-6
    nps_score: float  # (promoters - detractors) / total * 100


# ─── Submit NPS Score ───────────────────────────────────────────────────────


@router.post("/submit")
async def submit_nps(
    req: NPSSubmitRequest,
    auth: str = Depends(require_dashboard_auth),
):
    """Submit NPS feedback after ticket resolution."""
    user_id = user_id_from_subject(auth)

    # Validate score
    if req.score < 0 or req.score > 10:
        raise HTTPException(status_code=400, detail="Score must be between 0 and 10")

    with get_db_context() as db:
        # Create table if not exists
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS nps_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                ticket_id TEXT,
                score INTEGER NOT NULL,
                comment TEXT,
                category TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """
        )

        # Verify ticket belongs to user and is resolved
        ticket = db.execute(
            "SELECT id, status, category FROM support_tickets WHERE id = ? AND user_id = ?",
            (req.ticket_id, user_id),
        ).fetchone()

        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        # Check if already submitted
        existing = db.execute(
            "SELECT id FROM nps_responses WHERE user_id = ? AND ticket_id = ?",
            (user_id, req.ticket_id),
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="Feedback already submitted for this ticket")

        now = datetime.now(timezone.utc).isoformat()
        category = ticket[2] if ticket else None

        db.execute(
            """INSERT INTO nps_responses (user_id, ticket_id, score, comment, category, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, req.ticket_id, req.score, req.comment, category, now),
        )
        db.commit()

    # Classify
    if req.score >= 9:
        label = "promoter"
    elif req.score >= 7:
        label = "passive"
    else:
        label = "detractor"

    return {"ok": True, "score": req.score, "label": label}


# ─── Get NPS Summary (Admin) ────────────────────────────────────────────────


@router.get("/summary")
async def get_nps_summary(
    days: int = 30,
    auth: str = Depends(require_dashboard_auth),
):
    """Get NPS summary for the admin dashboard."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        # Verify admin
        user = db.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user or user[0] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        from datetime import timedelta

        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        responses = db.execute(
            "SELECT score FROM nps_responses WHERE created_at >= ?",
            (cutoff,),
        ).fetchall()

    scores = [r[0] for r in responses]
    total = len(scores)

    if total == 0:
        return {
            "total_responses": 0,
            "average_score": 0,
            "promoters": 0,
            "passives": 0,
            "detractors": 0,
            "nps_score": 0,
        }

    promoters = sum(1 for s in scores if s >= 9)
    passives = sum(1 for s in scores if 7 <= s <= 8)
    detractors = sum(1 for s in scores if s <= 6)
    nps_score = ((promoters - detractors) / total) * 100

    return {
        "total_responses": total,
        "average_score": round(sum(scores) / total, 1),
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "nps_score": round(nps_score, 1),
    }


# ─── Get Recent Responses (Admin) ───────────────────────────────────────────


@router.get("/responses")
async def get_nps_responses(
    limit: int = 50,
    auth: str = Depends(require_dashboard_auth),
):
    """Get recent NPS responses with comments."""
    user_id = user_id_from_subject(auth)

    with get_db_context() as db:
        user = db.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user or user[0] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")

        responses = db.execute(
            """SELECT n.score, n.comment, n.category, n.created_at,
                      u.display_name, u.email
               FROM nps_responses n
               JOIN users u ON n.user_id = u.id
               ORDER BY n.created_at DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()

    return {
        "responses": [
            {
                "score": r[0],
                "comment": r[1],
                "category": r[2],
                "created_at": r[3],
                "user_name": r[4],
                "user_email": r[5],
            }
            for r in responses
        ]
    }
