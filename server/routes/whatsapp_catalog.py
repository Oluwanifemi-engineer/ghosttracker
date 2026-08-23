"""
Magneetar WhatsApp Business Catalog
In-chat product browsing and purchasing via WhatsApp.

Features:
- Product catalog with plans and pricing
- Interactive message buttons for plan selection
- Payment link generation (Paystack)
- Order confirmation via WhatsApp
- Subscription management

WhatsApp Business Catalog:
- Up to 500 products per catalog
- Each product: title, description, price, images
- In-chat browsing without leaving WhatsApp
- Link to Paystack checkout for payment

Products:
1. Personal Monthly — ₦1,500
2. Personal Yearly — ₦15,000 (2 months free)
3. Family Monthly — ₦3,000
4. Family Yearly — ₦30,000 (2 months free)
"""

import logging
import secrets
from datetime import datetime, timezone

from database import get_db_context
from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp/catalog", tags=["whatsapp_catalog"])


# ─── Product Catalog ─────────────────────────────────────────────────────────

CATALOG_PRODUCTS = [
    {
        "id": "personal_monthly",
        "title": "Magneetar Personal — Monthly",
        "description": (
            "Protect your phone with military-grade anti-theft tracking.\n\n"
            "✓ 3 devices\n"
            "✓ 3-second GPS tracking\n"
            "✓ Smart AI geofencing\n"
            "✓ Family circles (5 members)\n"
            "✓ Panic button / SOS\n"
            "✓ Trust Score check\n"
            "✓ Community recovery bounties\n"
            "✓ Theft detection alerts"
        ),
        "price": "₦1,500/month",
        "price_value": 1500,
        "currency": "NGN",
        "interval": "monthly",
    },
    {
        "id": "personal_yearly",
        "title": "Magneetar Personal — Yearly",
        "description": (
            "Protect your phone for a full year — save 2 months!\n\n"
            "✓ Everything in Monthly\n"
            "✓ 2 months FREE\n"
            "✓ Priority support"
        ),
        "price": "₦15,000/year",
        "price_value": 15000,
        "currency": "NGN",
        "interval": "yearly",
        "badge": "BEST VALUE",
    },
    {
        "id": "family_monthly",
        "title": "Magneetar Family — Monthly",
        "description": (
            "Protect your entire family and team.\n\n"
            "✓ 10 devices\n"
            "✓ Unlimited GPS tracking\n"
            "✓ Smart AI geofencing\n"
            "✓ Unlimited family members\n"
            "✓ Digital inheritance\n"
            "✓ Panic button / SOS\n"
            "✓ Trust Score check\n"
            "✓ Community recovery bounties\n"
            "✓ Priority support"
        ),
        "price": "₦3,000/month",
        "price_value": 3000,
        "currency": "NGN",
        "interval": "monthly",
    },
    {
        "id": "family_yearly",
        "title": "Magneetar Family — Yearly",
        "description": (
            "Protect your entire family for a full year — save 2 months!\n\n"
            "✓ Everything in Family Monthly\n"
            "✓ 2 months FREE\n"
            "✓ Priority support\n"
            "✓ Dedicated account manager"
        ),
        "price": "₦30,000/year",
        "price_value": 30000,
        "currency": "NGN",
        "interval": "yearly",
        "badge": "FAMILY FAVORITE",
    },
]


# ─── Catalog API Endpoint ───────────────────────────────────────────────────


@router.get("/products")
async def get_catalog_products():
    """Return the product catalog for WhatsApp Business API.

    This endpoint is used by the WhatsApp Business API to sync the catalog.
    """
    return {
        "products": CATALOG_PRODUCTS,
        "total": len(CATALOG_PRODUCTS),
        "currency": "NGN",
        "business_name": "Magneetar",
    }


# ─── WhatsApp Interactive Message Handler ───────────────────────────────────


@router.post("/interactive")
async def handle_interactive_message(request: Request):
    """Handle WhatsApp interactive messages (button clicks, list selections).

    This processes:
    - Button clicks (e.g., "Subscribe to Personal Plan")
    - List selections (e.g., choosing a plan from a menu)
    - Quick replies (e.g., "Yes, subscribe")
    """
    body = await request.json()

    # Extract the interactive message
    interactive = body.get("interactive", {})
    msg_type = interactive.get("type", "")

    if msg_type == "button":
        button_id = interactive.get("button", {}).get("id", "")
        return await handle_button_click(button_id)

    elif msg_type == "list":
        selection = interactive.get("list_reply", {}).get("id", "")
        return await handle_list_selection(selection)

    return {"status": "ok"}


async def handle_button_click(button_id: str) -> dict:
    """Handle button click events."""
    if button_id.startswith("subscribe_"):
        plan_id = button_id.replace("subscribe_", "")
        return await generate_payment_link(plan_id)

    elif button_id == "check_status":
        return {"type": "text", "text": {"body": "Checking your subscription status..."}}

    elif button_id == "help":
        return {
            "type": "text",
            "text": {
                "body": (
                    "Magneetar Support\n\n"
                    "For help, visit:\nhttps://magneetar.me/support\n\n"
                    "Or email: support@magneetar.me"
                )
            },
        }

    return {"status": "ok"}


async def handle_list_selection(selection: str) -> dict:
    """Handle list menu selections."""
    if selection.startswith("plan_"):
        plan_id = selection.replace("plan_", "")
        return await generate_payment_link(plan_id)

    return {"status": "ok"}


# ─── Payment Link Generation ────────────────────────────────────────────────


async def generate_payment_link(plan_id: str) -> dict:
    """Generate a Paystack payment link for the selected plan."""
    product = next((p for p in CATALOG_PRODUCTS if p["id"] == plan_id), None)

    if not product:
        return {
            "type": "text",
            "text": {"body": "Invalid plan. Please try again."},
        }

    # Generate a payment reference
    ref = f"mgn_{plan_id}_{secrets.token_hex(4)}"

    # Store the payment intent
    with get_db_context() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS whatsapp_payments (
                id TEXT PRIMARY KEY,
                plan_id TEXT NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL
            )
        """
        )

        db.execute(
            """
            INSERT INTO whatsapp_payments (id, plan_id, amount, status, created_at)
            VALUES (?, ?, ?, 'pending', ?)
        """,
            (ref, plan_id, product["price_value"], datetime.now(timezone.utc).isoformat()),
        )
        db.commit()

    # Generate Paystack checkout link
    checkout_url = f"https://paystack.com/pay/magneetar-{plan_id}?reference={ref}"

    # Return interactive message with payment button
    return {
        "type": "interactive",
        "interactive": {
            "type": "cta_url",
            "header": {"type": "text", "text": f"Subscribe to {product['title']}"},
            "body": {
                "text": (
                    f"{product['description']}\n\n"
                    f"Price: {product['price']}\n\n"
                    f"Tap below to pay securely with Paystack."
                ),
            },
            "action": {
                "display_text": f"Pay {product['price']}",
                "url": checkout_url,
            },
        },
    }


# ─── WhatsApp Order Messages ────────────────────────────────────────────────


def get_welcome_message() -> dict:
    """Return the welcome message with interactive buttons."""
    return {
        "type": "interactive",
        "interactive": {
            "type": "button",
            "header": {"type": "text", "text": "🛡️ Welcome to Magneetar"},
            "body": {
                "text": ("Protect your phone and stay connected with your people.\n\n" "Choose an option below:"),
            },
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": "view_plans", "title": "📋 View Plans"}},
                    {"type": "reply", "reply": {"id": "check_imei", "title": "🔍 Check IMEI"}},
                    {"type": "reply", "reply": {"id": "help", "title": "❓ Help"}},
                ],
            },
        },
    }


def get_plan_list_message() -> dict:
    """Return the plan list as a WhatsApp list menu."""
    return {
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": {"type": "text", "text": "Magneetar Plans"},
            "body": {
                "text": (
                    "Choose a plan that fits your needs:\n\n"
                    "📱 Personal: Up to 3 devices\n"
                    "👨‍👩‍👧‍👦 Family: Up to 10 devices\n\n"
                    "All plans include:\n"
                    "✓ 3-second GPS tracking\n"
                    "✓ Smart AI geofencing\n"
                    "✓ Panic button / SOS\n"
                    "✓ Trust Score check\n"
                    "✓ Community recovery"
                ),
            },
            "action": {
                "button": "Select Plan",
                "sections": [
                    {
                        "title": "Personal Plans",
                        "rows": [
                            {
                                "id": "plan_personal_monthly",
                                "title": "Personal Monthly",
                                "description": "₦1,500/month — 3 devices",
                            },
                            {
                                "id": "plan_personal_yearly",
                                "title": "Personal Yearly",
                                "description": "₦15,000/year — Save 2 months!",
                            },
                        ],
                    },
                    {
                        "title": "Family Plans",
                        "rows": [
                            {
                                "id": "plan_family_monthly",
                                "title": "Family Monthly",
                                "description": "₦3,000/month — 10 devices",
                            },
                            {
                                "id": "plan_family_yearly",
                                "title": "Family Yearly",
                                "description": "₦30,000/year — Save 2 months!",
                            },
                        ],
                    },
                ],
            },
        },
    }
