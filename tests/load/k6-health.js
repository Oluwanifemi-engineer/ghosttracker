/**
 * k6 Load Test: Health Endpoint
 *
 * Tests the /health endpoint under load to ensure it remains responsive
 * even when the server is under stress from other operations.
 *
 * Usage:
 *   k6 run tests/load/k6-health.js
 *   k6 run --vus 10 --duration 30s tests/load/k6-health.js
 *
 * Environment Variables:
 *   K6_BASE_URL - Server base URL (default: http://localhost:8000)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthDuration = new Trend('health_duration', true);
const healthRequests = new Counter('health_requests');

// Configuration
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:8000';

export const options = {
  // Smoke test (1 VU, 10s)
  // k6 run --vus 1 --duration 10s tests/load/k6-health.js

  // Load test (10 VUs, 30s)
  // k6 run --vus 10 --duration 30s tests/load/k6-health.js

  // Stress test (50 VUs, 60s)
  // k6 run --vus 50 --duration 60s tests/load/k6-health.js

  // Spike test (100 VUs, 30s)
  // k6 run --vus 100 --duration 30s tests/load/k6-health.js

  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      gracefulStop: '5s',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],  // <1% error rate
    errors: ['rate<0.01'],
    health_duration: ['p(95)<200'],  // Health endpoint 95% < 200ms
  },
};

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'health' },
  };

  // Health check
  const healthRes = http.get(`${BASE_URL}/health`, params);
  healthDuration.add(healthRes.timings.duration);
  healthRequests.add(1);

  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health response has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status !== undefined;
      } catch {
        return false;
      }
    },
    'health response has version': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.version !== undefined;
      } catch {
        return false;
      }
    },
    'health response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(0.1);  // 100ms between requests (10 RPS per VU = 100 RPS total)
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results/health-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  // Simplified text summary
  const metrics = data.metrics;
  const lines = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  k6 Load Test Results: Health Endpoint');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  if (metrics.http_req_duration) {
    const dur = metrics.http_req_duration.values;
    lines.push(`  HTTP Request Duration:`);
    lines.push(`    Min:    ${dur.min.toFixed(2)}ms`);
    lines.push(`    Max:    ${dur.max.toFixed(2)}ms`);
    lines.push(`    Avg:    ${dur.avg.toFixed(2)}ms`);
    lines.push(`    P95:    ${dur['p(95)'].toFixed(2)}ms`);
    lines.push(`    P99:    ${dur['p(99)'].toFixed(2)}ms`);
  }

  if (metrics.http_reqs) {
    lines.push('');
    lines.push(`  Total Requests: ${metrics.http_reqs.values.count}`);
    lines.push(`  Requests/sec:   ${(metrics.http_reqs.values.rate || 0).toFixed(2)}`);
  }

  if (metrics.http_req_failed) {
    lines.push('');
    lines.push(`  Failed Requests: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}
