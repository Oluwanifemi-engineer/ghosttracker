# Load Testing Guide

## Overview

Magneetar uses [k6](https://k6.io/) for API load testing with [Grafana](https://grafana.com/) + [Prometheus](https://prometheus.io/) for visualization.

## Why Load Testing?

1. **Performance Baseline** - Know your API's capacity
2. **Scalability Planning** - Prepare for user growth
3. **Bottleneck Detection** - Find performance issues before users do
4. **SLA Validation** - Ensure response time commitments

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     k6      │────▶│  Prometheus │────▶│   Grafana   │
│ (Generator) │     │ (Collector) │     │(Visualizer) │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  Magneetar  │
│    API      │
└─────────────┘
```

## Setup

### 1. Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

### 2. Start Monitoring Stack (Optional)

```bash
# Start Grafana + Prometheus
make monitoring-up

# Open Grafana
make grafana-open
# Username: admin
# Password: magneetar-dev
```

## Test Scenarios

### Health Check Test

Basic endpoint availability test.

```bash
# Run health check test
make load-test-health

# Custom parameters
k6 run --vus 10 --duration 30s tests/load/k6-health.js
```

**Thresholds:**
- Response time: p95 < 500ms
- Error rate: < 1%

### Device Location Test

Most critical endpoint - devices ping every ~3 seconds.

```bash
# Run device location test
make load-test-location

# Custom parameters
k6 run --vus 20 --duration 60s tests/load/k6-device-location.js
```

**Thresholds:**
- Response time: p95 < 500ms
- Error rate: < 5%

### Full API Test

Comprehensive test covering all endpoints.

```bash
# Run full API test
make load-test-full

# With Prometheus output
make load-test-monitored
```

**Thresholds:**
- Response time: p95 < 1s, p99 < 2s
- Error rate: < 10%

### Stress Test

Peak load simulation.

```bash
# Run stress test (100 VUs, 60s)
make load-test-stress

# Custom parameters
k6 run --vus 100 --duration 120s tests/load/k6-full-api.js
```

## Test Results

### JSON Output

Results are saved to `tests/load/results/`:

```bash
# View results
make load-test-report

# Or manually
cat tests/load/results/full-api-summary.json
```

### Prometheus Metrics

With monitoring stack running:

```bash
# Run with Prometheus output
make load-test-monitored

# View in Grafana
make grafana-open
```

## Grafana Dashboard

The k6 dashboard includes:

### Overview Panels
- **Requests per Second** - Current throughput
- **Average Response Time** - Mean latency
- **P95 Response Time** - 95th percentile latency
- **Error Rate** - Failed request percentage

### Response Time Panels
- **Response Time Percentiles** - P50, P90, P95, P99 over time
- **Response Time Distribution** - Visual histogram

### Throughput Panels
- **Requests per Second** - Total, 2xx, 5xx over time
- **Error Rate** - 4xx and 5xx errors over time

### Virtual Users Panel
- **Virtual Users Over Time** - Active and max VUs

## Performance Targets

### Magneetar API SLA

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Response Time (p50) | < 200ms | > 500ms | > 1s |
| Response Time (p95) | < 500ms | > 1s | > 2s |
| Response Time (p99) | < 1s | > 2s | > 5s |
| Error Rate | < 1% | > 5% | > 10% |
| Throughput | > 100 RPS | < 50 RPS | < 10 RPS |

### Endpoint-Specific Targets

| Endpoint | Target p95 | Target RPS |
|----------|------------|------------|
| /health | < 100ms | > 500 |
| /api/device/location | < 500ms | > 100 |
| /api/dashboard/devices | < 1s | > 50 |
| /api/device/commands/* | < 500ms | > 100 |

## Best Practices

### 1. Baseline First

Run tests before changes to establish baseline:

```bash
# Save baseline
cp tests/load/results/full-api-summary.json tests/load/results/baseline.json
```

### 2. Realistic Scenarios

Match real-world usage patterns:

```javascript
// Device pings every 3 seconds
sleep(3);

// Dashboard users view for 5 seconds
sleep(5);

// 10% of devices poll for commands
if (Math.random() < 0.1) {
  pollCommands();
}
```

### 3. Gradual Ramp-up

Don't spike immediately:

```javascript
stages: [
  { duration: '30s', target: 50 },   // Ramp up
  { duration: '60s', target: 50 },   // Steady state
  { duration: '30s', target: 100 },  // Peak
  { duration: '30s', target: 10 },   // Ramp down
]
```

### 4. Thresholds as Gate

Fail CI if performance degrades:

```javascript
thresholds: {
  http_req_duration: ['p(95)<1000'],
  http_req_failed: ['rate<0.05'],
}
```

### 5. Monitor in Production

Use the same metrics in production:

```bash
# Production monitoring
make monitoring-up
# Configure Prometheus to scrape production metrics
```

## Troubleshooting

### High Error Rate

1. **Check server logs** - Look for 5xx errors
2. **Check database** - SQLite locking under load
3. **Check rate limiting** - May be too aggressive
4. **Check connection limits** - WebSocket saturation

### Slow Response Times

1. **Check database queries** - Missing indexes
2. **Check N+1 queries** - Batch database calls
3. **Check caching** - Redis cache hit rate
4. **Check network** - Latency between k6 and server

### k6 Connection Errors

1. **Check server is running** - `curl http://localhost:8000/health`
2. **Check port availability** - No conflicts
3. **Check firewall** - Allow local connections
4. **Check connection limits** - ulimit settings

## Commands Reference

```bash
# Load tests
make load-test-health        # Health endpoint
make load-test-location      # Device location
make load-test-full          # Full API suite
make load-test-stress        # Stress test (100 VUs)

# Monitoring
make monitoring-up           # Start Grafana + Prometheus
make monitoring-down         # Stop monitoring
make monitoring-logs         # Follow logs
make load-test-monitored     # Run with Prometheus output
make grafana-open            # Open Grafana

# Results
make load-test-report        # View JSON results
```

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Grafana k6 Dashboard](https://grafana.com/grafana/dashboards/14801)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
