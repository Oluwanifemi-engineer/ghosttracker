"""
Magneetar Payment Processing Service
Handles Stripe integration for subscription tiers (Free, Pro, Enterprise).
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class PaymentService:
    """Stripe payment processing service."""

    def __init__(self):
        self.stripe = None
        self._initialized = False

    def initialize(self, api_key: str):
        """Initialize Stripe client."""
        try:
            import stripe

            stripe.api_key = api_key
            self.stripe = stripe
            self._initialized = True
            logger.info("Stripe payment service initialized")
        except ImportError:
            logger.warning("Stripe package not installed: pip install stripe")
        except Exception as e:
            logger.error(f"Failed to initialize Stripe: {e}")

    def is_configured(self) -> bool:
        """Check if Stripe is configured."""
        return self._initialized and self.stripe is not None

    def create_customer(self, email: str, name: Optional[str] = None) -> dict:
        """Create a Stripe customer."""
        if not self.is_configured():
            return {"error": "Stripe not configured"}

        try:
            customer = self.stripe.Customer.create(email=email, name=name, metadata={"source": "magneetar"})
            return {"customer_id": customer.id, "email": email}
        except Exception as e:
            logger.error(f"Failed to create customer: {e}")
            return {"error": str(e)}

    def create_subscription(self, customer_id: str, price_id: str) -> dict:
        """Create a subscription for a customer."""
        if not self.is_configured():
            return {"error": "Stripe not configured"}

        try:
            subscription = self.stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": price_id}],
                payment_behavior="default_incomplete",
                expand=["latest_invoice.payment_intent"],
            )
            return {
                "subscription_id": subscription.id,
                "status": subscription.status,
                "client_secret": subscription.latest_invoice.payment_intent.client_secret,
            }
        except Exception as e:
            logger.error(f"Failed to create subscription: {e}")
            return {"error": str(e)}

    def cancel_subscription(self, subscription_id: str) -> dict:
        """Cancel a subscription."""
        if not self.is_configured():
            return {"error": "Stripe not configured"}

        try:
            subscription = self.stripe.Subscription.delete(subscription_id)
            return {"subscription_id": subscription.id, "status": subscription.status}
        except Exception as e:
            logger.error(f"Failed to cancel subscription: {e}")
            return {"error": str(e)}

    def create_checkout_session(self, customer_id: str, price_id: str, success_url: str, cancel_url: str) -> dict:
        """Create a Stripe Checkout session."""
        if not self.is_configured():
            return {"error": "Stripe not configured"}

        try:
            session = self.stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode="subscription",
                success_url=success_url,
                cancel_url=cancel_url,
                subscription_data={"trial_period_days": 14},
            )
            return {"checkout_url": session.url, "session_id": session.id}
        except Exception as e:
            logger.error(f"Failed to create checkout session: {e}")
            return {"error": str(e)}

    def handle_webhook(self, payload: bytes, sig_header: str, webhook_secret: str) -> dict:
        """Handle Stripe webhook events."""
        if not self.is_configured():
            return {"error": "Stripe not configured"}

        try:
            event = self.stripe.Webhook.construct_event(payload, sig_header, webhook_secret)

            if event["type"] == "checkout.session.completed":
                session = event["data"]["object"]
                return {"event": "subscription_started", "customer": session["customer"]}

            elif event["type"] == "invoice.paid":
                invoice = event["data"]["object"]
                return {"event": "payment_success", "customer": invoice["customer"]}

            elif event["type"] == "invoice.payment_failed":
                invoice = event["data"]["object"]
                return {"event": "payment_failed", "customer": invoice["customer"]}

            elif event["type"] == "customer.subscription.deleted":
                subscription = event["data"]["object"]
                return {"event": "subscription_cancelled", "customer": subscription["customer"]}

            return {"event": event["type"]}

        except self.stripe.error.SignatureVerificationError:
            logger.warning("Invalid Stripe webhook signature")
            return {"error": "Invalid signature"}
        except Exception as e:
            logger.error(f"Failed to handle webhook: {e}")
            return {"error": str(e)}


# Plan configurations
PLANS = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "devices": 1,
        "features": ["basic_tracking", "location_history_7d", "sms_commands"],
    },
    "pro": {
        "name": "Pro",
        "price_monthly": 9.99,
        "devices": 5,
        "features": [
            "advanced_tracking",
            "location_history_30d",
            "sms_commands",
            "sentinel_ai",
            "guardian_network",
            "evidence_capture",
        ],
    },
    "enterprise": {
        "name": "Enterprise",
        "price_monthly": 29.99,
        "devices": 25,
        "features": [
            "all_pro_features",
            "location_history_unlimited",
            "priority_support",
            "custom_branding",
            "api_access",
        ],
    },
}


# Singleton instance
payment_service = PaymentService()


def get_plan_features(tier: str) -> dict:
    """Get features for a subscription tier."""
    return PLANS.get(tier, PLANS["free"])


def get_device_limit(tier: str) -> int:
    """Get device limit for a subscription tier."""
    plan = PLANS.get(tier, PLANS["free"])
    return plan["devices"]
