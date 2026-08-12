"""
Magneetar Alert Retry Semantics Tests

Regression lock for the 20.9s slow-request bug: `_send_with_retry` used to
retry EVERY failure, including permanent provider rejections (HTTP 401/403 =
bad credentials). With two misconfigured Twilio channels (SMS + WhatsApp)
and one retry each, a single sim_changed alert blocked the device's location
POST for ~21s of serial backoff — the phone's request paid the price of a
broken alert config.

The fix: providers raise ChannelPermanentError on 401/403, and the retry
wrapper returns immediately (still recording the circuit-breaker failure)
instead of sleeping + retrying. Transient failures (timeouts, 5xx) keep
their existing single retry.

These tests are pure unit tests (no DB): they only exercise the retry
wrapper and the SMS provider classification. All imports are lazy to follow
the codebase convention (test_e2e evicts config/database from sys.modules
mid-suite; a module-level binding would go stale)."""

import asyncio

import pytest

# ─── Lazy helpers ───────────────────────────────────────────────────────────


def _alerts():
    """Import alerts at CALL time so we always bind the current module."""
    import alerts  # noqa: F401

    return alerts


def _run(coro):
    """Run one async coroutine to completion."""
    return asyncio.run(coro)


# ─── Retry wrapper semantics ────────────────────────────────────────────────


class TestRetryWrapper:
    def test_permanent_failure_not_retried(self):
        """A ChannelPermanentError must return immediately — no backoff sleep,
        no second attempt. This is the fix: broken creds must never multiply
        alert latency (or block a device request) with serial retries."""
        alerts = _alerts()
        calls = []

        async def permanent_send(*args, **kwargs):
            calls.append(1)
            raise alerts.ChannelPermanentError("sms: Twilio rejected credentials (HTTP 401)")

        engine = alerts.AlertEngine()
        result = _run(engine._send_with_retry("sms", permanent_send))

        assert result is False
        assert len(calls) == 1, f"permanent failure must not be retried, got {len(calls)} attempts"
        # Circuit-breaker still records the failure so the channel can open.
        assert engine._channel_failures.get("sms") == 1

    def test_transient_failure_still_retried(self):
        """A plain False (transient provider rejection) keeps the one retry."""
        alerts = _alerts()
        calls = []

        async def flaky_send(*args, **kwargs):
            calls.append(1)
            return False

        engine = alerts.AlertEngine()
        result = _run(engine._send_with_retry("sms", flaky_send))

        assert result is False
        assert len(calls) == 2, f"transient failure should get exactly one retry, got {len(calls)}"

    def test_success_records_success(self):
        alerts = _alerts()
        calls = []

        async def ok_send(*args, **kwargs):
            calls.append(1)
            return True

        engine = alerts.AlertEngine()
        result = _run(engine._send_with_retry("sms", ok_send))

        assert result is True
        assert len(calls) == 1
        assert engine._channel_failures.get("sms") == 0


# ─── SMS provider classification ────────────────────────────────────────────


class TestSmsPermanentClassification:
    def test_twilio_401_without_termii_raises_permanent(self, monkeypatch):
        """Twilio 401 + no Termii fallback = permanent — the send raises so
        the retry wrapper fails fast instead of burning serial backoff."""
        alerts = _alerts()
        from config import settings  # noqa: E402 — lazy, current module

        class Fake401Response:
            status_code = 401
            text = '{"code":20003,"message":"Authenticate","status":401}'

        class FakeAsyncClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a, **k):
                return False

            async def post(self, *args, **kwargs):
                return Fake401Response()

        # Force the Twilio-preferred path regardless of what the repo .env holds.
        monkeypatch.setattr(settings, "TWILIO_SID", "ACtest" + "0" * 28)
        monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "x" * 32)
        monkeypatch.setattr(settings, "TWILIO_SMS_FROM", "+15551234567")
        monkeypatch.setattr(settings, "TERMII_API_KEY", "")
        monkeypatch.setattr(alerts.httpx, "AsyncClient", FakeAsyncClient)

        with pytest.raises(alerts.ChannelPermanentError):
            _run(alerts.AlertEngine().send_sms("+2348088678489", "sim_changed", {"location": "0,0", "time": "now"}))

    def test_twilio_401_raises_permanent_error_directly(self, monkeypatch):
        """The provider-level contract: send_sms itself raises
        ChannelPermanentError on 401 so the wrapper can skip retrying."""
        alerts = _alerts()
        from config import settings  # noqa: E402

        class Fake401Response:
            status_code = 401
            text = '{"code":20003,"message":"Authenticate","status":401}'

        class FakeAsyncClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a, **k):
                return False

            async def post(self, *args, **kwargs):
                return Fake401Response()

        monkeypatch.setattr(settings, "TWILIO_SID", "ACtest" + "0" * 28)
        monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "x" * 32)
        monkeypatch.setattr(settings, "TWILIO_SMS_FROM", "+15551234567")
        monkeypatch.setattr(settings, "TERMII_API_KEY", "")
        monkeypatch.setattr(alerts.httpx, "AsyncClient", FakeAsyncClient)

        with pytest.raises(alerts.ChannelPermanentError):
            _run(alerts.AlertEngine().send_sms("+2348088678489", "sim_changed", {"location": "0,0", "time": "now"}))

    def test_email_401_raises_permanent_error(self, monkeypatch):
        """SendGrid 401 is permanent too — the raise must NOT be swallowed by
        send_email's generic except (regression: the exception propagated for
        whatsapp/sms but was caught and turned into a retried False for email,
        so the wrapper never got the fast-fail signal and the SendGrid circuit
        breaker was double-counted)."""
        alerts = _alerts()
        from config import settings  # noqa: E402

        class Fake401Response:
            status_code = 401
            text = '{"errors":[{"message":"authorization"}]}'

        class FakeAsyncClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a, **k):
                return False

            async def post(self, *args, **kwargs):
                return Fake401Response()

        monkeypatch.setattr(settings, "SENDGRID_API_KEY", "SG.test-key")
        monkeypatch.setattr(alerts.httpx, "AsyncClient", FakeAsyncClient)

        with pytest.raises(alerts.ChannelPermanentError):
            _run(
                alerts.AlertEngine().send_email("owner@example.com", "sim_changed", {"location": "0,0", "time": "now"})
            )

    def test_whatsapp_401_raises_permanent_error(self, monkeypatch):
        """WhatsApp uses the same Twilio credentials — a 401 is equally
        permanent and must raise so the wrapper skips its retry."""
        alerts = _alerts()
        from config import settings  # noqa: E402

        class Fake401Response:
            status_code = 401
            text = '{"code":20003,"message":"Authenticate","status":401}'

        class FakeAsyncClient:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a, **k):
                return False

            async def post(self, *args, **kwargs):
                return Fake401Response()

        monkeypatch.setattr(settings, "TWILIO_SID", "ACtest" + "0" * 28)
        monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "x" * 32)
        monkeypatch.setattr(settings, "TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
        monkeypatch.setattr(alerts.httpx, "AsyncClient", FakeAsyncClient)

        with pytest.raises(alerts.ChannelPermanentError):
            _run(
                alerts.AlertEngine().send_whatsapp(
                    "+2348088678489", "sim_changed", {"location": "0,0", "time": "now", "score": 35}
                )
            )
