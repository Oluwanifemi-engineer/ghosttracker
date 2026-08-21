# Observability: Prometheus & Grafana (Guidance)

This document provides a practical, minimal observability setup for Magneetar using Prometheus for metrics scraping and Grafana for dashboards and SLOs.

Goals
- Expose operational metrics (already available at /api/metrics and /api/metrics/json).
- Scrape metrics securely (metrics endpoint requires dashboard/admin JWT) — use a Prometheus sidecar or a pushgateway when scraping is not possible.
- Create a small Grafana dashboard for uptime, active WS connections, device counts, alerts, and error rates.

Prometheus scrape configuration (example)

```yaml
# prometheus.yml (snippet)
scrape_configs:
  - job_name: 'magneetar-server'
    metrics_path: '/api/metrics'
    scheme: 'http'
    # If running Prometheus in the same network, point to the service DNS
    static_configs:
      - targets: ['magneetar-server:8002']
    # If metrics endpoint requires auth (recommended), use bearer_token_file or
    # relabeling to attach a short-lived JWT from the secret store / sidecar.
    # bearer_token_file: /var/run/secrets/magneetar/metrics.token

  # If Prometheus cannot authenticate to the admin-only endpoint, consider
  # a small metrics exporter sidecar that only exposes a scrapeable unauth'd
  # /metrics endpoint to the monitoring network and forwards requests to
  # the internal /api/metrics JSON while enforcing access control.
```

Security notes
- The server's /api/metrics endpoint is intentionally operator-only. Never expose it to public internet.
- Use network-level controls (VPC, firewall) to limit who can reach Prometheus & the metrics port.
- Prefer short-lived tokens (HashiCorp Vault, cloud secret manager) mounted as files for bearer_token_file.

Grafana dashboard: recommended panels
- Uptime (magneetar_uptime_seconds)
- Active WebSocket connections (magneetar_websocket_connections)
- Total devices (magneetar_devices_total) and active devices (magneetar_devices_active)
- Alerts delivered / failed over 24h (magneetar_alerts_24h, magneetar_alerts_delivered_24h)
- Errors (magneetar_errors_1h)
- Pending commands (magneetar_commands_pending)
- Realtime series: location pings per minute (derive from locations pings / time-window)

Alerting rules (examples)
- High error rate: if increase in magneetar_errors_1h by >5x over baseline → Page on-call
- Low delivery: magneetar_alerts_delivered_24h / magneetar_alerts_24h < 0.9 → Investigate provider failure
- High WS disconnects: if magneetar_websocket_connections drops by 50% in 5 minutes

Runbooks
- Add a short runbook that lists the steps to: check Prometheus scrape status, inspect server logs (docker compose logs --tail=200 server), check Redis and DB health, and roll back via scripts/rollback.sh.

Next steps
- Add a Prometheus scrape job in your infra (Kubernetes ServiceMonitor / Prometheus Operator or plain prometheus.yml).
- Create a Grafana dashboard JSON export from a running Grafana instance (start with the panels above) and store it in docs/grafana/magneetar-dashboard.json for versioning.
- Wire alerting via Alertmanager to a PagerDuty or Slack channel, and create SLOs for availability and alert delivery.
