/**
 * Magneetar Stress Test — 1,000+ concurrent devices
 *
 * Tests:
 * - Device registration at scale
 * - Location telemetry flood (300+ writes/second)
 * - WebSocket fan-out to 100+ dashboard sessions
 * - Command delivery under load
 * - Database write throughput
 * - Memory and connection pool exhaustion
 *
 * Run: k6 run tests/load/k6-stress-test.js
 * Or: k6 cloud tests/load/k6-stress-test.js
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

// ── Custom Metrics ────────────────────────────────────────────────────────
const registrationSuccess = new Counter('registration_success');
const registrationFail = new Counter('registration_fail');
const locationSuccess = new Counter('location_success');
const locationFail = new Counter('location_fail');
const commandSuccess = new Counter('command_success');
const wsConnections = new Gauge('ws_connections');
const wsMessages = new Counter('ws_messages');
const responseTime = new Trend('api_response_time');
const errorRate = new Rate('error_rate');

// ── Configuration ─────────────────────────────────────────────────────────
const BASE_URL = __ENV.TARGET_URL || 'https://api.magneetar.me';
const DEVICE_KEY = __ENV.DEVICE_KEY || '';
const TEST_USER_EMAIL = __ENV.TEST_EMAIL || 'loadtest@magneetar.me';
const TEST_USER_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest2026!';

// ── Test Scenarios ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Scenario 1: Device registration ramp-up
    registration: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // Ramp to 100 devices
        { duration: '5m', target: 500 },   // Ramp to 500 devices
        { duration: '10m', target: 1000 }, // Ramp to 1000 devices
        { duration: '5m', target: 1000 },  // Sustain 1000 devices
        { duration: '2m', target: 0 },     // Ramp down
      ],
      exec: 'registerAndTrack',
    },

    // Scenario 2: Location telemetry flood
    telemetry: {
      executor: 'constant-arrival-rate',
      rate: 300,  // 300 requests/second (1000 devices × 3-second pings ÷ 10)
      timeUnit: '1s',
      duration: '15m',
      preAllocatedVUs: 500,
      maxVUs: 2000,
      exec: 'sendLocation',
    },

    // Scenario 3: Dashboard WebSocket sessions
    dashboard: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 50 },    // 50 dashboard sessions
        { duration: '10m', target: 100 },  // 100 dashboard sessions
        { duration: '5m', target: 100 },   // Sustain
        { duration: '2m', target: 0 },     // Ramp down
      ],
      exec: 'dashboardWebSocket',
    },

    // Scenario 4: Command delivery
    commands: {
      executor: 'constant-arrival-rate',
      rate: 10,  // 10 commands/second
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 20,
      exec: 'sendCommands',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'],  // Less than 1% errors
    registration_success: ['count>900'],  // At least 900 successful registrations
    location_success: ['rate>0.99'],  // 99% location writes succeed
    error_rate: ['rate<0.01'],
  },
};

// ── Setup: Create test user and get auth token ────────────────────────────
export function setup() {
  console.log(`\n🚀 Magneetar Stress Test Starting`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Scenarios: registration, telemetry, dashboard, commands\n`);

  // Create/load test user
  const signUpRes = http.post(`${BASE_URL}/api/auth/sign-up`, JSON.stringify({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    display_name: 'Load Test User',
  }), { headers: { 'Content-Type': 'application/json' } });

  let token;
  if (signUpRes.status === 200 || signUpRes.status === 201) {
    token = signUpRes.json('access_token');
  } else {
    // User might already exist, try sign-in
    const signInRes = http.post(`${BASE_URL}/api/auth/sign-in`, JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    }), { headers: { 'Content-Type': 'application/json' } });
    token = signInRes.json('access_token');
  }

  if (!token) {
    console.error('❌ Failed to get auth token');
    return {};
  }

  console.log(`✅ Test user authenticated`);
  return { authToken: token };
}

// ── Scenario 1: Register and Track ────────────────────────────────────────
export function registerAndTrack(data) {
  const deviceId = `stress-test-${__VU}-${__ITER}`;
  const fingerprint = `fingerprint-${__VU}-${Date.now()}`;

  group('Device Registration', () => {
    const start = Date.now();

    const res = http.post(`${BASE_URL}/api/device/register`, JSON.stringify({
      device_id: deviceId,
      device_fingerprint: fingerprint,
      platform: 'android',
      app_version: '1.4.4',
      os_version: '14',
      model: 'Stress Test Device',
    }), {
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': DEVICE_KEY,
      },
      timeout: '10s',
    });

    responseTime.add(Date.now() - start);

    if (check(res, {
      'registration status is 200': (r) => r.status === 200,
      'registration has token': (r) => r.json('device_token') !== undefined,
    })) {
      registrationSuccess.add(1);
    } else {
      registrationFail.add(1);
      errorRate.add(1);
    }
  });

  // After registration, send location pings
  if (DEVICE_KEY) {
    for (let i = 0; i < 5; i++) {
      sleep(3);
      sendLocationTelemetry(deviceId);
    }
  }
}

// ── Scenario 2: Send Location ─────────────────────────────────────────────
export function sendLocation() {
  if (!DEVICE_KEY) return;

  const deviceId = `stress-test-${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 100)}`;

  sendLocationTelemetry(deviceId);
}

function sendLocationTelemetry(deviceId) {
  const lat = 6.5 + (Math.random() * 2 - 1);  // Random near OAU campus
  const lng = 3.5 + (Math.random() * 2 - 1);

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/device/location`, JSON.stringify({
    device_id: deviceId,
    lat: lat,
    lng: lng,
    accuracy: 10 + Math.random() * 20,
    speed: Math.random() * 30,
    bearing: Math.random() * 360,
    battery: Math.floor(Math.random() * 100),
    network_type: 'wifi',
    timestamp: new Date().toISOString(),
  }), {
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Key': DEVICE_KEY,
    },
    timeout: '5s',
  });

  responseTime.add(Date.now() - start);

  if (check(res, {
    'location status is 200': (r) => r.status === 200,
  })) {
    locationSuccess.add(1);
  } else {
    locationFail.add(1);
    errorRate.add(1);
  }
}

// ── Scenario 3: Dashboard WebSocket ───────────────────────────────────────
export function dashboardWebSocket(data) {
  if (!data.authToken) return;

  const url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');

  const wsConn = ws.connect(`${url}/ws/dashboard?token=${data.authToken}`, {}, (socket) => {
    wsConnections.add(1);

    socket.on('open', () => {
      console.log(`📡 Dashboard WS connected (VU: ${__VU})`);
    });

    socket.on('message', (msg) => {
      wsMessages.add(1);
    });

    socket.on('close', () => {
      wsConnections.add(-1);
    });

    socket.on('error', (e) => {
      console.error(`Dashboard WS error: ${e.error()}`);
    });

    // Keep connection alive for 30 seconds
    sleep(30);
  });

  check(wsConn, {
    'dashboard WS connected': (r) => r && r.readyState === 1,
  });
}

// ── Scenario 4: Send Commands ─────────────────────────────────────────────
export function sendCommands(data) {
  if (!data.authToken) return;

  const deviceId = `stress-test-${Math.floor(Math.random() * 1000)}-${Math.floor(Math.random() * 100)}`;

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/dashboard/command`, JSON.stringify({
    device_id: deviceId,
    command_type: 'siren',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.authToken}`,
    },
    timeout: '5s',
  });

  responseTime.add(Date.now() - start);

  if (check(res, {
    'command accepted': (r) => r.status === 200 || r.status === 202,
  })) {
    commandSuccess.add(1);
  } else {
    errorRate.add(1);
  }
}

// ── Teardown ──────────────────────────────────────────────────────────────
export function teardown(data) {
  console.log(`\n✅ Stress test complete`);
  console.log(`   Registrations: ${registrationSuccess.values().count || 0} success, ${registrationFail.values().count || 0} fail`);
  console.log(`   Locations: ${locationSuccess.values().count || 0} success, ${locationFail.values().count || 0} fail`);
  console.log(`   Commands: ${commandSuccess.values().count || 0}`);
  console.log(`   WS Messages: ${wsMessages.values().count || 0}`);
}
