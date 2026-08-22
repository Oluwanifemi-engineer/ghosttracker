"""
Magneetar Email Tracking
Handles open/click tracking via pixel endpoints.

Open tracking: 1x1 pixel image loaded by email client
Click tracking: links rewritten to go through redirect endpoint
"""

import logging

from fastapi import APIRouter, Query, Response
from fastapi.responses import HTMLResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/email", tags=["email"])

# 1x1 transparent GIF pixel
PIXEL_GIF = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"  # noqa: E501


@router.get("/track/open")
async def track_open(id: str = Query(...)):
    """Track email open via tracking pixel."""
    from email_service import _log_email_event

    _log_email_event("", f"open:{id}", "opened")
    return Response(content=PIXEL_GIF, media_type="image/gif")


@router.get("/track/click")
async def track_click(id: str = Query(...), url: str = Query(...)):
    """Track email click and redirect to destination."""
    from email_service import _log_email_event

    _log_email_event("", f"click:{id}", "clicked")
    return HTMLResponse(
        content=f'<html><head><meta http-equiv="refresh" content="0;url={url}" /></head><body></body></html>',
        status_code=302,
    )


@router.get("/stats")
async def get_email_stats():
    """Get email delivery statistics."""
    from email_service import get_email_stats

    return get_email_stats()


@router.get("/recent")
async def get_recent_emails(limit: int = Query(50)):
    """Get recent email events."""
    from email_service import get_recent_emails

    return {"emails": get_recent_emails(limit)}
