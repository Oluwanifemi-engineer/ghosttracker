"""
Magneetar Metrics Endpoint
Provides Prometheus-compatible metrics for monitoring and observability.
"""

import time
from datetime import datetime, timezone

from auth import require_dashboard_auth, user_id_from_subject
from database import get_db_context
from fastapi import APIRouter, Depends, HTTPException, Response

router = APIRouter()


def _require_operator(auth: str = Depends(require_dashboard_auth)) -> str:
    """Metrics are operational intelligence (user/device counts, alert-provider
    state) — visible to operators only, never to regular accounts."""
    if user_id_from_subject(auth) is not None:
        raise HTTPException(status_code=403, detail="Admin access required")
    return auth


def _get_server_start():
    """Get server start time from main module (avoids circular import)."""
    try:
        from main import SERVER_START

        return SERVER_START
    except ImportError:
        return time.time()


def _get_app_version():
    """Get app version from main module (avoids circular import)."""
    try:
        from main import APP_VERSION

        return APP_VERSION
    except ImportError:
        return "1.0.0"


@router.get("/metrics")
async def metrics(_: str = Depends(_require_operator)):
    """Prometheus-compatible metrics endpoint (operator/admin only).

    Provides:
    - Uptime
    - Request counts (by endpoint)
    - Active connections
    - Database statistics
    - Alert delivery rates
    - Device statistics

    Security: the payload leaks operational intelligence (registered user /
    device counts, DB health, which external alert services are configured)
    so it must never be anonymously scrapeable — requires a dashboard/admin
    JWT (same gate as every other /api/dashboard endpoint).
    """
    metrics_lines = []
    server_start = _get_server_start()
    app_version = _get_app_version()

    # Uptime
    uptime = time.time() - server_start
    metrics_lines.append("# HELP magneetar_uptime_seconds Server uptime in seconds")
    metrics_lines.append("# TYPE magneetar_uptime_seconds gauge")
    metrics_lines.append(f"magneetar_uptime_seconds {uptime:.2f}")

    # Version
    metrics_lines.append("# HELP magneetar_version_info Server version info")
    metrics_lines.append("# TYPE magneetar_version_info gauge")
    metrics_lines.append(f'magneetar_version_info{{version="{app_version}"}} 1')

    # Database statistics
    try:
        with get_db_context() as conn:
            # Device count
            device_count = conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
            metrics_lines.append("# HELP magneetar_devices_total Total registered devices")
            metrics_lines.append("# TYPE magneetar_devices_total gauge")
            metrics_lines.append(f"magneetar_devices_total {device_count}")

            # Active devices (seen in last hour)
            active_devices = conn.execute(
                "SELECT COUNT(*) FROM devices WHERE last_seen > datetime('now', '-1 hour')"
            ).fetchone()[0]
            metrics_lines.append("# HELP magneetar_devices_active Devices active in last hour")
            metrics_lines.append("# TYPE magneetar_devices_active gauge")
            metrics_lines.append(f"magneetar_devices_active {active_devices}")

            # User count
            user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            metrics_lines.append("# HELP magneetar_users_total Total registered users")
            metrics_lines.append("# TYPE magneetar_users_total gauge")
            metrics_lines.append(f"magneetar_users_total {user_count}")

            # Alert count (last 24h)
            alert_count_24h = conn.execute(
                "SELECT COUNT(*) FROM alerts WHERE created_at > datetime('now', '-1 day')"
            ).fetchone()[0]
            metrics_lines.append("# HELP magneetar_alerts_24h Alerts in last 24 hours")
            metrics_lines.append("# TYPE magneetar_alerts_24h gauge")
            metrics_lines.append(f"magneetar_alerts_24h {alert_count_24h}")

            # Delivered alerts (last 24h)
            delivered_alerts_24h = conn.execute(
                "SELECT COUNT(*) FROM alerts WHERE created_at > datetime('now', '-1 day') AND delivered=1"
            ).fetchone()[0]
            metrics_lines.append("# HELP magneetar_alerts_delivered_24h Delivered alerts in last 24 hours")
            metrics_lines.append("# TYPE magneetar_alerts_delivered_24h gauge")
            metrics_lines.append(f"magneetar_alerts_delivered_24h {delivered_alerts_24h}")

            # Location count (last hour)
            location_count_1h = conn.execute(
                "SELECT COUNT(*) FROM locations WHERE timestamp > datetime('now', '-1 hour')"
            ).fetchone()[0]
            metrics_lines.append("# HELP magneetar_locations_1h Location pings in last hour")
            metrics_lines.append("# TYPE magneetar_locations_1h gauge")
            metrics_lines.append(f"magneetar_locations_1h {location_count_1h}")

            # Error count (last hour)
            error_count_1h = conn.execute(
                "SELECT COUNT(*) FROM error_log WHERE created_at > datetime('now', '-1 hour')"
            ).fetchone()[0]
            metrics_lines.append("# HELP magneetar_errors_1h Errors in last hour")
            metrics_lines.append("# TYPE magneetar_errors_1h gauge")
            metrics_lines.append(f"magneetar_errors_1h {error_count_1h}")

            # Pending commands
            pending_commands = conn.execute("SELECT COUNT(*) FROM commands WHERE status='pending'").fetchone()[0]
            metrics_lines.append("# HELP magneetar_commands_pending Pending commands")
            metrics_lines.append("# TYPE magneetar_commands_pending gauge")
            metrics_lines.append(f"magneetar_commands_pending {pending_commands}")

    except Exception:
        metrics_lines.append("# HELP magneetar_database_error Database query error")
        metrics_lines.append("# TYPE magneetar_database_error gauge")
        metrics_lines.append("magneetar_database_error 1")

    # WebSocket connections
    try:
        from websocket_manager import active_dashboard_connections

        ws_connections = len(active_dashboard_connections)
        metrics_lines.append("# HELP magneetar_websocket_connections Active WebSocket connections")
        metrics_lines.append("# TYPE magneetar_websocket_connections gauge")
        metrics_lines.append(f"magneetar_websocket_connections {ws_connections}")
    except Exception:
        pass

    # Alert engine circuit breaker status
    try:
        from alerts import alert_engine

        for channel in ["email", "sms", "whatsapp", "push"]:
            failures = alert_engine._channel_failures.get(channel, 0)
            is_open = alert_engine._should_skip_channel(channel)
            metrics_lines.append(
                f'# HELP magneetar_alert_circuit_failures{{channel="{channel}"}} Alert circuit breaker failures'
            )
            metrics_lines.append("# TYPE magneetar_alert_circuit_failures gauge")
            metrics_lines.append(f'magneetar_alert_circuit_failures{{channel="{channel}"}} {failures}')
            metrics_lines.append(
                f'# HELP magneetar_alert_circuit_open{{channel="{channel}"}} Alert circuit breaker open (1=open)'
            )
            metrics_lines.append("# TYPE magneetar_alert_circuit_open gauge")
            metrics_lines.append(f'magneetar_alert_circuit_open{{channel="{channel}"}} {1 if is_open else 0}')
    except Exception:
        pass

    # Cache statistics
    try:
        from cache import get_all_cache_stats

        cache_stats = get_all_cache_stats()
        for cache_name, stats in cache_stats.items():
            metrics_lines.append(f'# HELP magneetar_cache_size{{cache="{cache_name}"}} Cache size')
            metrics_lines.append("# TYPE magneetar_cache_size gauge")
            metrics_lines.append(f'magneetar_cache_size{{cache="{cache_name}"}} {stats["size"]}')
            metrics_lines.append(f'# HELP magneetar_cache_hit_rate{{cache="{cache_name}"}} Cache hit rate')
            metrics_lines.append("# TYPE magneetar_cache_hit_rate gauge")
            hit_rate = stats.get("hit_rate", "0%")
            try:
                hit_rate_value = float(hit_rate.replace("%", "")) / 100
            except (ValueError, AttributeError):
                hit_rate_value = 0
            metrics_lines.append(f'magneetar_cache_hit_rate{{cache="{cache_name}"}} {hit_rate_value}')
    except Exception:
        pass

    # External service circuit breakers
    try:
        from circuit_breaker import get_all_circuit_breakers

        cb_stats = get_all_circuit_breakers()
        for service, stats in cb_stats.items():
            is_open = 1 if stats["state"] == "open" else 0
            metrics_lines.append(
                f'# HELP magneetar_external_circuit_open{{service="{service}"}} External service circuit breaker open'
            )
            metrics_lines.append("# TYPE magneetar_external_circuit_open gauge")
            metrics_lines.append(f'magneetar_external_circuit_open{{service="{service}"}} {is_open}')
            metrics_lines.append(
                f'# HELP magneetar_external_circuit_failures{{service="{service}"}} External service failures'
            )
            metrics_lines.append("# TYPE magneetar_external_circuit_failures gauge")
            metrics_lines.append(
                f'magneetar_external_circuit_failures{{service="{service}"}} {stats["total_failures"]}'
            )
    except Exception:
        pass

    # Redis cache statistics
    try:
        from cache_redis import get_redis_cache

        rc = get_redis_cache()
        if rc:
            stats = rc.get_stats()
            connected = 1 if stats["connected"] else 0
            metrics_lines.append("# HELP magneetar_redis_connected Redis cache connection status")
            metrics_lines.append("# TYPE magneetar_redis_connected gauge")
            metrics_lines.append(f"magneetar_redis_connected {connected}")
            metrics_lines.append("# HELP magneetar_cache_evictions_total Total cache evictions")
            metrics_lines.append("# TYPE magneetar_cache_evictions_total counter")
            metrics_lines.append(f"magneetar_cache_evictions_total {stats.get('evictions', 0)}")
    except Exception:
        pass

    return Response(
        content="\n".join(metrics_lines) + "\n",
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/metrics/json")
async def metrics_json(_: str = Depends(_require_operator)):
    """JSON metrics endpoint for dashboard consumption (operator/admin only)."""
    server_start = _get_server_start()
    metrics = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": time.time() - server_start,
    }

    try:
        with get_db_context() as conn:
            metrics["devices"] = {
                "total": conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0],
                "active_1h": conn.execute(
                    "SELECT COUNT(*) FROM devices WHERE last_seen > datetime('now', '-1 hour')"
                ).fetchone()[0],
                "owned": conn.execute("SELECT COUNT(*) FROM devices WHERE owner_id IS NOT NULL").fetchone()[0],
            }
            metrics["users"] = {
                "total": conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
                "active_24h": conn.execute(
                    "SELECT COUNT(*) FROM users WHERE last_login > datetime('now', '-1 day')"
                ).fetchone()[0],
            }
            metrics["alerts"] = {
                "total_24h": conn.execute(
                    "SELECT COUNT(*) FROM alerts WHERE created_at > datetime('now', '-1 day')"
                ).fetchone()[0],
                "delivered_24h": conn.execute(
                    "SELECT COUNT(*) FROM alerts WHERE created_at > datetime('now', '-1 day') AND delivered=1"
                ).fetchone()[0],
                "failed_24h": conn.execute(
                    "SELECT COUNT(*) FROM alerts WHERE created_at > datetime('now', '-1 day') AND delivered=0"
                ).fetchone()[0],
            }
            metrics["locations"] = {
                "pings_1h": conn.execute(
                    "SELECT COUNT(*) FROM locations WHERE timestamp > datetime('now', '-1 hour')"
                ).fetchone()[0],
                "pings_24h": conn.execute(
                    "SELECT COUNT(*) FROM locations WHERE timestamp > datetime('now', '-1 day')"
                ).fetchone()[0],
            }
            metrics["commands"] = {
                "pending": conn.execute("SELECT COUNT(*) FROM commands WHERE status='pending'").fetchone()[0],
                "executed_24h": conn.execute(
                    "SELECT COUNT(*) FROM commands WHERE status='executed' AND executed_at > datetime('now', '-1 day')"
                ).fetchone()[0],
                "failed_24h": conn.execute(
                    "SELECT COUNT(*) FROM commands WHERE status='failed' AND executed_at > datetime('now', '-1 day')"
                ).fetchone()[0],
            }
            metrics["errors"] = {
                "total_1h": conn.execute(
                    "SELECT COUNT(*) FROM error_log WHERE created_at > datetime('now', '-1 hour')"
                ).fetchone()[0],
                "total_24h": conn.execute(
                    "SELECT COUNT(*) FROM error_log WHERE created_at > datetime('now', '-1 day')"
                ).fetchone()[0],
            }
    except Exception as e:
        metrics["database_error"] = str(e)

    try:
        from websocket_manager import active_dashboard_connections

        metrics["websocket"] = {
            "active_connections": len(active_dashboard_connections),
        }
    except Exception:
        metrics["websocket"] = {"active_connections": 0}

    try:
        from cache_redis import get_redis_cache

        rc = get_redis_cache()
        if rc:
            metrics["redis_cache"] = rc.get_stats()
        else:
            metrics["redis_cache"] = {"connected": False}
    except Exception:
        metrics["redis_cache"] = {"connected": False}

    return metrics


# ─── A/B Test Analytics ────────────────────────────────────────────────────
# In-memory store for A/B test conversion events.
# In production, wire this to a real analytics backend (PostHog, Mixpanel, etc.).
_ab_test_events: list[dict] = []
_AB_MAX_EVENTS = 10000  # ring buffer cap


@router.post("/ab-event")
async def track_ab_event(payload: dict):
    """Receive an A/B test conversion event from the frontend.

    Expected payload:
        { experimentId, variant, event, value?, ts }

    Stores in-memory for now; in production, forward to analytics service.
    """
    global _ab_test_events
    event = {
        "experiment_id": payload.get("experimentId", "unknown"),
        "variant": payload.get("variant", "unknown"),
        "event": payload.get("event", "unknown"),
        "value": payload.get("value"),
        "client_ts": payload.get("ts"),
        "server_ts": datetime.now(timezone.utc).isoformat(),
    }
    _ab_test_events.append(event)
    # Ring buffer: drop oldest if too many events
    if len(_ab_test_events) > _AB_MAX_EVENTS:
        _ab_test_events = _ab_test_events[-_AB_MAX_EVENTS:]
    return {"ok": True}


@router.get("/ab-summary")
async def ab_test_summary():
    """Return aggregated A/B test results for the dashboard."""
    summary: dict = {}
    for ev in _ab_test_events:
        exp_id = ev["experiment_id"]
        variant = ev["variant"]
        event = ev["event"]
        key = f"{exp_id}:{variant}:{event}"
        if key not in summary:
            summary[key] = {
                "experiment_id": exp_id,
                "variant": variant,
                "event": event,
                "count": 0,
                "total_value": 0,
            }
        summary[key]["count"] += 1
        if ev.get("value") is not None:
            summary[key]["total_value"] += ev["value"]
    return {"events": list(summary.values()), "total": len(_ab_test_events)}
