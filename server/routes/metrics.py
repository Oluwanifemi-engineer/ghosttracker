"""
Magneetar Metrics Endpoint
Provides Prometheus-compatible metrics for monitoring and observability.
"""

import time
from datetime import datetime, timezone

from database import get_db_context
from fastapi import APIRouter, Response

router = APIRouter()


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
async def metrics():
    """Prometheus-compatible metrics endpoint.

    Provides:
    - Uptime
    - Request counts (by endpoint)
    - Active connections
    - Database statistics
    - Alert delivery rates
    - Device statistics
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

    return Response(
        content="\n".join(metrics_lines) + "\n",
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@router.get("/metrics/json")
async def metrics_json():
    """JSON metrics endpoint for dashboard consumption."""
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

    return metrics
