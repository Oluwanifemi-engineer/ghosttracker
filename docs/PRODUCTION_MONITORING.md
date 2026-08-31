# Production Monitoring Guide

## Overview

Magneetar uses Grafana + Prometheus for production monitoring, providing real-time visibility into API performance, device activity, and system health.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Magneetar  │────▶│  Prometheus │────▶│   Grafana   │
│    API      │     │ (Collector) │     │(Visualizer) │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  Exporter   │
│  (FastAPI)  │
└─────────────┘
```

## Dashboards

### 1. Production Monitoring (`magneetar-production`)

Real-time production metrics:

- **System Health**: Uptime, RPS, response times, error rate
- **API Performance**: Request rates by endpoint, response time percentiles
- **Device Metrics**: Total devices, active devices, location pings
- **Alerts & Errors**: Alert delivery, error log

### 2. k6 Load Testing (`magneetar-k6-load`)

Load test visualization:

- **Overview**: RPS, response times, error rate
- **Response Times**: Percentiles over time
- **Throughput**: Requests and errors over time
- **Virtual Users**: Active VUs over time

## Setup

### 1. Start Monitoring Stack

```bash
# Start Grafana + Prometheus
make monitoring-up

# Open Grafana
make grafana-open
# Username: admin
# Password: magneetar-dev
```

### 2. Configure Prometheus

Edit `tests/load/prometheus.yml` to scrape your API:

```yaml
scrape_configs:
  - job_name: 'magneetar-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'
```

### 3. Import Dashboards

1. Go to **Grafana → Dashboards → Import**
2. Upload JSON files from `tests/load/grafana/`
3. Select Prometheus datasource

## Metrics Reference

### API Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| `http_requests_total` | Total HTTP requests | counter |
| `http_request_duration_seconds` | Request duration | histogram |
| `http_requests_in_flight` | Current in-flight requests | gauge |

### Business Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| `magneetar_devices_total` | Total registered devices | gauge |
| `magneetar_devices_active` | Active devices (1h) | gauge |
| `magneetar_locations_1h` | Location pings (1h) | gauge |
| `magneetar_alerts_24h` | Alerts (24h) | gauge |
| `magneetar_alerts_delivered_24h` | Delivered alerts (24h) | gauge |
| `magneetar_errors_1h` | Errors (1h) | gauge |
| `magneetar_websocket_connections` | WebSocket connections | gauge |

### System Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| `magneetar_uptime_seconds` | Server uptime | gauge |
| `magneetar_version_info` | Server version | gauge |
| `magneetar_cache_hit_rate` | Cache hit rate | gauge |
| `magneetar_commands_pending` | Pending commands | gauge |

## Alerts

### Recommended Alerts

#### Critical (Page immediately)

| Alert | Condition | Duration |
|-------|-----------|----------|
| API Down | Uptime < 90% | 5 min |
| High Error Rate | Error rate > 5% | 5 min |
| Response Time Critical | P95 > 2s | 5 min |

#### Warning (Notify team)

| Alert | Condition | Duration |
|-------|-----------|----------|
| High Error Rate | Error rate > 1% | 10 min |
| Response Time High | P95 > 1s | 10 min |
| Low Uptime | Uptime < 99% | 15 min |

#### Info (Log only)

| Alert | Condition | Duration |
|-------|-----------|----------|
| New Device Spike | Devices > 2x average | 5 min |
| Alert Delivery Failed | Delivery rate < 90% | 30 min |

### Create Alerts in Grafana

1. Go to **Alerting → Alert Rules**
2. Click **New Alert Rule**
3. Configure:
   - **Name**: Descriptive name
   - **Query**: Prometheus query
   - **Condition**: Threshold
   - **Duration**: How long condition must be true
4. Set notification channel (Slack, email, etc.)

## Performance Targets

### SLA Requirements

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Uptime | 99.9% | < 99.5% | < 99% |
| P50 Response Time | < 200ms | > 500ms | > 1s |
| P95 Response Time | < 500ms | > 1s | > 2s |
| Error Rate | < 0.1% | > 1% | > 5% |
| Alert Delivery | > 99% | < 95% | < 90% |

### Endpoint-Specific Targets

| Endpoint | P95 Target | RPS Target |
|----------|------------|------------|
| `/health` | < 100ms | > 500 |
| `/api/device/location` | < 500ms | > 100 |
| `/api/dashboard/devices` | < 1s | > 50 |
| `/api/device/commands/*` | < 500ms | > 100 |

## Troubleshooting

### High Response Times

1. **Check database**: SQLite locking under load
2. **Check Redis cache**: Hit rate < 90%
3. **Check network**: Latency between services
4. **Check CPU/Memory**: Resource exhaustion

### High Error Rate

1. **Check error log**: Identify error types
2. **Check rate limiting**: May be too aggressive
3. **Check dependencies**: External service failures
4. **Check configuration**: Missing environment variables

### Missing Metrics

1. **Check Prometheus**: Scrape targets healthy
2. **Check exporter**: Metrics endpoint accessible
3. **Check Grafana**: Datasource configured correctly

## Commands Reference

```bash
# Monitoring stack
make monitoring-up           # Start Grafana + Prometheus
make monitoring-down         # Stop monitoring
make monitoring-logs         # Follow logs
make grafana-open            # Open Grafana

# Load testing with monitoring
make load-test-monitored     # Run k6 with Prometheus output

# View metrics
curl http://localhost:8000/metrics  # Raw Prometheus metrics
```

## Resources

- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [FastAPI Metrics](https://prometheus.github.io/client_python/)
- [k6 Grafana Dashboards](https://grafana.com/grafana/dashboards/14801)
