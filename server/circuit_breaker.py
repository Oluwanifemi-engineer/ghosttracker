"""
Magneetar Circuit Breaker
Implements the Circuit Breaker pattern for external service calls.

Why this matters:
- When Twilio/SendGrid/Firebase is down, waiting for timeouts wastes resources
- Cascading failures can bring down the entire server
- Circuit breakers fail fast and recover automatically

States:
- CLOSED: Normal operation, requests pass through
- OPEN: Service is failing, requests fail immediately
- HALF_OPEN: Testing if service has recovered

Configuration:
- failure_threshold: Number of failures before opening circuit
- recovery_timeout: Seconds to wait before trying again
- success_threshold: Number of successes to close circuit from half-open
"""

import asyncio
import logging
import time
from enum import Enum
from typing import Callable

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Circuit breaker for external service calls."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 30,
        success_threshold: int = 3,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0
        self._last_state_change = time.time()

        # Statistics
        self._total_calls = 0
        self._total_failures = 0
        self._total_successes = 0
        self._total_rejected = 0

    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        if self._state == CircuitState.OPEN:
            # Check if recovery timeout has elapsed
            if time.time() - self._last_failure_time >= self.recovery_timeout:
                self._transition_to(CircuitState.HALF_OPEN)
        return self._state

    def _transition_to(self, new_state: CircuitState):
        """Transition to a new state."""
        old_state = self._state
        self._state = new_state
        self._last_state_change = time.time()

        if new_state == CircuitState.CLOSED:
            self._failure_count = 0
            self._success_count = 0
        elif new_state == CircuitState.HALF_OPEN:
            self._success_count = 0

        logger.info(f"Circuit breaker '{self.name}': {old_state.value} -> {new_state.value}")

    def record_success(self):
        """Record a successful call."""
        self._total_calls += 1
        self._total_successes += 1

        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self.success_threshold:
                self._transition_to(CircuitState.CLOSED)
        elif self._state == CircuitState.CLOSED:
            self._failure_count = 0

    def record_failure(self):
        """Record a failed call."""
        self._total_calls += 1
        self._total_failures += 1
        self._failure_count += 1
        self._last_failure_time = time.time()

        if self._state == CircuitState.CLOSED:
            if self._failure_count >= self.failure_threshold:
                self._transition_to(CircuitState.OPEN)
        elif self._state == CircuitState.HALF_OPEN:
            self._transition_to(CircuitState.OPEN)

    def can_execute(self) -> bool:
        """Check if a call can be executed."""
        if self._state == CircuitState.CLOSED:
            return True
        elif self._state == CircuitState.OPEN:
            # Check if recovery timeout has elapsed
            if time.time() - self._last_failure_time >= self.recovery_timeout:
                self._transition_to(CircuitState.HALF_OPEN)
                return True
            return False
        elif self._state == CircuitState.HALF_OPEN:
            return True
        return False

    def get_stats(self) -> dict:
        """Get circuit breaker statistics."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "total_calls": self._total_calls,
            "total_failures": self._total_failures,
            "total_successes": self._total_successes,
            "total_rejected": self._total_rejected,
            "last_failure_time": self._last_failure_time,
            "last_state_change": self._last_state_change,
        }

    async def execute(self, func: Callable, *args, **kwargs):
        """Execute a function with circuit breaker protection."""
        if not self.can_execute():
            self._total_rejected += 1
            raise CircuitBreakerOpenError(f"Circuit breaker '{self.name}' is OPEN")

        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            self.record_success()
            return result
        except Exception:
            self.record_failure()
            raise


class CircuitBreakerOpenError(Exception):
    """Exception raised when circuit breaker is open."""

    pass


# Global circuit breakers for external services
_twilio_breaker = CircuitBreaker("twilio", failure_threshold=3, recovery_timeout=60)
_sendgrid_breaker = CircuitBreaker("sendgrid", failure_threshold=3, recovery_timeout=60)
_firebase_breaker = CircuitBreaker("firebase", failure_threshold=3, recovery_timeout=60)


def get_twilio_breaker() -> CircuitBreaker:
    """Get the Twilio circuit breaker."""
    return _twilio_breaker


def get_sendgrid_breaker() -> CircuitBreaker:
    """Get the SendGrid circuit breaker."""
    return _sendgrid_breaker


def get_firebase_breaker() -> CircuitBreaker:
    """Get the Firebase circuit breaker."""
    return _firebase_breaker


def get_all_circuit_breakers() -> dict:
    """Get statistics for all circuit breakers."""
    return {
        "twilio": _twilio_breaker.get_stats(),
        "sendgrid": _sendgrid_breaker.get_stats(),
        "firebase": _firebase_breaker.get_stats(),
    }


def reset_all_circuit_breakers():
    """Reset all circuit breakers to closed state."""
    _twilio_breaker._transition_to(CircuitState.CLOSED)
    _sendgrid_breaker._transition_to(CircuitState.CLOSED)
    _firebase_breaker._transition_to(CircuitState.CLOSED)
    logger.info("All circuit breakers reset")
