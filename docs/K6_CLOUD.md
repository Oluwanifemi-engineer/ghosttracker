# k6 Cloud Distributed Load Testing

## Overview

Magneetar uses [Grafana Cloud k6](https://grafana.com/products/cloud/performance-load-testing-k6/) for distributed load testing at scale.

## Features

- **Multi-Region Testing**: Run from Lagos, London, Virginia simultaneously
- **Massive Scale**: Up to 1M virtual users, 5M requests/sec
- **Real-time Dashboards**: Grafana dashboards with live metrics
- **Automated Reports**: Performance reports after each test
- **CI/CD Integration**: Run tests in GitHub Actions

## Setup

### 1. Create Grafana Cloud Account

1. Go to [grafana.com/products/cloud/](https://grafana.com/products/cloud/)
2. Sign up for free tier (50k VU hours/month)
3. Create a k6 project

### 2. Get Cloud Token

1. In Grafana Cloud, go to **k6 → Settings**
2. Copy your **API Token**

### 3. Add to Environment

```bash
# Add to .env.local or shell profile
export K6_CLOUD_TOKEN=your-token-here

# Or add to GitHub Secrets
# Settings → Secrets and variables → Actions
# Add: K6_CLOUD_TOKEN
```

### 4. Login to k6 Cloud

```bash
k6 login --token $K6_CLOUD_TOKEN
```

## Usage

### Run Local Test

```bash
# Standard load test
make load-test-full

# With Prometheus output
make load-test-monitored
```

### Run Distributed Test

```bash
# Run in k6 Cloud (distributed)
make load-test-cloud

# Lagos-focused (Nigerian users)
make load-test-cloud-lagos

# Equal global distribution
make load-test-cloud-global
```

### Custom Distribution

```bash
# Custom zone weights
K6_CLOUD_DISTRIBUTION='{"lagos":{"loadZone":"asia-south1","weight":60},"london":{"loadZone":"europe-west2","weight":40}}' k6 cloud tests/load/k6-distributed.js
```

## Load Zones

| Zone | Location | Best For |
|------|----------|----------|
| `asia-south1` | Lagos, Nigeria | Nigerian users |
| `europe-west2` | London, UK | European users |
| `us-east4` | Virginia, US | American users |
| `asia-east1` | Taiwan | Asian users |
| `southamerica-east1` | São Paulo | South American users |

## Test Scenarios

### Device Registration Storm

Simulates 100+ devices registering simultaneously:

- **VUs**: 0 → 100 → 0
- **Duration**: 9 minutes
- **Target**: /api/device/register

### Location Updates (Critical)

Simulates devices pinging every 3 seconds:

- **VUs**: 200 constant
- **Duration**: 10 minutes
- **Target**: /api/device/location

### Dashboard Users

Simulates users viewing the dashboard:

- **VUs**: 10 → 50 → 0
- **Duration**: 10 minutes
- **Target**: /api/dashboard/devices

## Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Response Time (p95) | < 500ms | > 1s | > 2s |
| Error Rate | < 1% | > 5% | > 10% |
| Throughput | > 500 RPS | < 200 RPS | < 100 RPS |

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday 2am
  workflow_dispatch:      # Manual trigger

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run Distributed Test
        run: k6 cloud tests/load/k6-distributed.js
        env:
          K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}
          K6_BASE_URL: ${{ secrets.PRODUCTION_URL }}
```

## Monitoring

### Grafana Dashboard

1. Go to **Grafana Cloud → k6 → Dashboards**
2. Select your test run
3. View real-time metrics:
   - Requests per second
   - Response time percentiles
   - Error rates
   - Virtual users over time

### Alerts

Configure alerts in Grafana:

1. Go to **Alerting → Alert Rules**
2. Create rule:
   - **Condition**: Response time p95 > 1s
   - **Duration**: 5 minutes
   - **Notification**: Slack, email, PagerDuty

## Cost Optimization

### Free Tier Limits

- 50,000 VU hours/month
- 100 VU max per test
- 10 minute max test duration

### Cost-Saving Tips

1. **Use `onlyChanged`**: Only test changed endpoints
2. **Shorter tests**: 5 minutes instead of 10
3. **Fewer VUs**: Scale down for non-critical tests
4. **Schedule wisely**: Run during off-peak hours

### Paid Plans

| Plan | VU Hours | Max VUs | Price |
|------|----------|---------|-------|
| Free | 50k | 100 | $0 |
| Pro | 500k | 1,000 | $49/mo |
| Enterprise | Unlimited | 1M+ | Custom |

## Troubleshooting

### Token Not Working

```bash
# Check token
k6 login --token $K6_CLOUD_TOKEN --verbose

# Re-login
k6 logout
k6 login --token $K6_CLOUD_TOKEN
```

### Test Failing to Start

1. Check token is valid
2. Verify network access to k6 Cloud
3. Check test script for errors

### Slow Test Execution

1. Reduce VU count
2. Simplify test scenarios
3. Check network latency to load zones

## Commands Reference

```bash
# Authentication
k6 login --token $K6_CLOUD_TOKEN  # Login to cloud
k6 logout                          # Logout

# Run tests
k6 cloud tests/load/k6-distributed.js          # Run in cloud
k6 cloud --distribution '{"lagos":{"loadZone":"asia-south1","weight":100}}' tests/load/k6-distributed.js

# View results
k6 cloud --help                    # Show cloud options
```

## Resources

- [Grafana Cloud k6 Docs](https://grafana.com/docs/k6/latest/)
- [k6 Cloud Pricing](https://grafana.com/products/cloud/pricing/)
- [Load Zone List](https://grafana.com/docs/k6/latest/testing-guides/running-distributed-tests/#available-load-zones)
- [k6 GitHub](https://github.com/grafana/k6)
