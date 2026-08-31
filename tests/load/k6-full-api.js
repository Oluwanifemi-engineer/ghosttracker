/**
 * k6 Load Test: Full API Suite
 *
 * Comprehensive load test covering all main API endpoints:
 * - Health check
 * - Device registration
 * - Location updates
 * - Command polling
 * - Dashboard operations
 *
 * Usage:
 *   k6 run tests/load/k6-full-api.js
 *   k6 run --vus 50 --duration 120s tests/load/k6-full-api.js
 *
 * Environment Variables:
 *   K6_BASE_URL - Server base URL (default: http://localhost:8000)
 *   K6_API_KEY - Dashboard API key
 *   K6_DEVICE_KEY - Device registration key
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration', true);
const apiRequests = new Counter('api_requests');

// Configuration
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:8000';
const API_KEY = __ENV.K6_API_KEY || '';
const DEVICE_KEY = __ENV.K6_DEVICE_KEY || '';

// Shared state
let dashboardToken = '';
let deviceToken = '';
let deviceId = '';

export const options = {
  // Prometheus metrics output
  // Run with: k6 run --out prometheus tests/load/k6-full-api.js

  scenarios: {
    // Scenario 1: API stress test
    api_stress: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '30s', target: 50 },   // Ramp up
        { duration: '60s', target: 50 },   // Steady state
        { duration: '30s', target: 100 },  // Peak load
        { duration: '30s', target: 10 },   // Ramp down
      ],
      exec: 'runScenario',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],  // 95% < 2s, 99% < 5s
    http_req_failed: ['rate<0.1'],  // <10% error rate
    errors: ['rate<0.1'],
    api_duration: ['p(95)<1000'],  // API calls 95% < 1s
  },
};

function getHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };
}

function generateLocation() {
  return {
    lat: 6.4 + Math.random() * 0.2,
    lng: 3.2 + Math.random() * 0.3,
  };
}

// Setup: Get authentication tokens
export function setup() {
  console.log('Setting up load test...');

  // Get dashboard token
  if (API_KEY) {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`,
      JSON.stringify({ api_key: API_KEY }),
      getHeaders()
    );

    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      dashboardToken = body.access_token;
      console.log('Dashboard token obtained');
    }
  }

  // Register a test device
  deviceId = `mt-loadtest-${randomString(8)}`;
  const regRes = http.post(`${BASE_URL}/api/device/register`,
    JSON.stringify({
      device_id: deviceId,
      fingerprint: `loadtest-${randomString(16)}`,
      model: 'Load Test Device',
      os_version: 'Android 14',
      app_version: '1.0.0',
      device_key: DEVICE_KEY || undefined,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DEVICE_KEY || 'test-key',
      },
    }
  );

  if (regRes.status === 200) {
    const body = JSON.parse(regRes.body);
    deviceToken = body.access_token;
    console.log(`Device registered: ${deviceId}`);
  }

  return { dashboardToken, deviceToken, deviceId };
}

// Main scenario
export function runScenario(data) {
  const { dashboardToken: dToken, deviceToken: devToken, deviceId: devId } = data;

  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`, getHeaders());
    apiDuration.add(res.timings.duration);
    apiRequests.add(1);

    check(res, {
      'health status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(1);

  // Device operations (if we have a token)
  if (devToken) {
    group('Device Location Update', () => {
      const location = generateLocation();
      const res = http.post(`${BASE_URL}/api/device/location`,
        JSON.stringify({
          device_id: devId,
          lat: location.lat,
          lng: location.lng,
          accuracy: randomIntBetween(5, 50),
          battery_percent: randomIntBetween(10, 100),
          ping_sequence: `ping-${Date.now()}`,
          device_timestamp: new Date().toISOString(),
        }),
        getHeaders(devToken)
      );
      apiDuration.add(res.timings.duration);
      apiRequests.add(1);

      check(res, {
        'location update status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    });

    sleep(2);

    group('Command Poll', () => {
      const res = http.get(`${BASE_URL}/api/device/commands/${devId}`, getHeaders(devToken));
      apiDuration.add(res.timings.duration);
      apiRequests.add(1);

      check(res, {
        'command poll status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    });
  }

  sleep(1);

  // Dashboard operations (if we have a token)
  if (dToken) {
    group('Dashboard: List Devices', () => {
      const res = http.get(`${BASE_URL}/api/dashboard/devices`, getHeaders(dToken));
      apiDuration.add(res.timings.duration);
      apiRequests.add(1);

      check(res, {
        'devices list status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    });

    sleep(2);

    group('Dashboard: Device History', () => {
      const res = http.get(`${BASE_URL}/api/dashboard/locations/${devId}`, getHeaders(dToken));
      apiDuration.add(res.timings.duration);
      apiRequests.add(1);

      check(res, {
        'device history status is 200': (r) => r.status === 200,
      }) || errorRate.add(1);
    });
  }

  sleep(3);
}

export function handleSummary(data) {
  return {
    'stdout': formatSummary(data),
    'tests/load/results/full-api-summary.json': JSON.stringify(data, null, 2),
  };
}

function formatSummary(data) {
  const metrics = data.metrics;
  const lines = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  k6 Load Test Results: Full API Suite');
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

  if (metrics.api_duration) {
    const dur = metrics.api_duration.values;
    lines.push('');
    lines.push(`  API Duration:`);
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
