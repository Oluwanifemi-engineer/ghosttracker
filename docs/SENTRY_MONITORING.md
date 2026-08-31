# Sentry Error Tracking & Performance Monitoring

## Overview

Magneetar uses [Sentry](https://sentry.io/) for real-time error tracking and performance monitoring across the dashboard application.

## Features

- **Error Tracking**: Capture and group frontend/backend errors
- **Performance Monitoring**: Track API response times, page loads
- **Session Replay**: See exactly what users did before errors
- **Release Tracking**: Know which version introduced issues
- **Alerting**: Get notified of new errors immediately

## Setup

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io/)
2. Sign up with GitHub
3. Create a new project (Next.js)

### 2. Get DSN

1. In Sentry dashboard, go to **Settings → Project → Client Keys (DSN)**
2. Copy the DSN

### 3. Add to Environment

Add to `.env.local`:

```bash
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token  # For source maps upload
```

### 4. Add to GitHub Secrets

1. Go to **Settings → Secrets and variables → Actions**
2. Add:
   - `SENTRY_DSN`
   - `SENTRY_AUTH_TOKEN`

## Configuration Files

### Client-Side (`sentry.client.config.ts`)

Initializes Sentry on the client:

```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% of transactions
  replaysSessionSampleRate: 0.01,  // 1% of sessions
  replaysOnErrorSampleRate: 1.0,  // 100% of error sessions
});
```

### Server-Side (`sentry.server.config.ts`)

Initializes Sentry on the server:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

### Edge Runtime (`sentry.edge.config.ts`)

Initializes Sentry for edge functions:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

### Instrumentation (`instrumentation.ts`)

Loads Sentry before any code runs:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
```

## Usage

### Error Boundary

Wrap components with the error boundary:

```tsx
import { SentryErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <SentryErrorBoundary>
      <Dashboard />
    </SentryErrorBoundary>
  );
}
```

### Track Page Views

```tsx
import { trackPageView } from '@/lib/sentry';

useEffect(() => {
  trackPageView('/dashboard', { deviceCount: devices.length });
}, [devices]);
```

### Track Commands

```tsx
import { trackCommand } from '@/lib/sentry';

async function handleLockCommand() {
  const startTime = Date.now();

  try {
    await lockDevice(deviceId);
    trackCommand('lock', deviceId, {
      success: true,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    trackCommand('lock', deviceId, {
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    });
  }
}
```

### Track API Calls

```tsx
import { trackApiCall } from '@/lib/sentry';

async function fetchDevices() {
  const startTime = Date.now();

  const response = await fetch('/api/dashboard/devices');

  trackApiCall('GET', '/api/dashboard/devices', response.status, Date.now() - startTime);

  return response.json();
}
```

### Wrap Async Operations

```tsx
import { withSentrySpan } from '@/lib/sentry';

async function loadDeviceData() {
  return withSentrySpan('loadDeviceData', 'http', async () => {
    const devices = await fetchDevices();
    const locations = await fetchLocations();
    return { devices, locations };
  });
}
```

### Set User Context

```tsx
import { setSentryUser, clearSentryUser } from '@/lib/sentry';

// On login
setSentryUser({ id: user.id, email: user.email, tier: user.tier });

// On logout
clearSentryUser();
```

## Performance Monitoring

### Transactions

Sentry automatically tracks:
- **Page loads**: Initial page load time
- **API calls**: Backend response times
- **Component renders**: React component performance

### Custom Spans

Add custom spans for specific operations:

```tsx
import * as Sentry from '@sentry/nextjs';

async function processEvidence() {
  return Sentry.startSpan(
    { name: 'processEvidence', op: 'task' },
    async () => {
      // Your processing logic
      const evidence = await analyzePhotos();
      const pdf = await generatePDF(evidence);
      return pdf;
    }
  );
}
```

## Alerting

### Create Alerts

1. Go to **Alerts → Create Alert Rule**
2. Choose alert type:
   - **Error**: New error, error count threshold
   - **Performance**: Duration threshold, apdex score
3. Configure notification channel (Slack, email, etc.)

### Recommended Alerts

| Alert | Condition | Priority |
|-------|-----------|----------|
| New Error | First occurrence | High |
| Error Spike | >10 errors/min | Critical |
| Slow API | p95 >2s | Warning |
| High Error Rate | >5% of requests | Critical |

## Source Maps

### Upload Source Maps

Source maps are uploaded automatically in CI:

```yaml
# .github/workflows/ci.yml
- name: Upload Source Maps
  run: |
    cd dashboard
    npx @sentry/cli releases files $SENTRY_RELEASE upload-sourcemaps .next/static
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_RELEASE: ${{ github.sha }}
```

### Local Development

```bash
# Upload source maps manually
cd dashboard
npx @sentry/cli releases files $(git rev-parse HEAD) upload-sourcemaps .next/static
```

## Session Replay

Session Replay captures what users did before errors:

- **Session Sample Rate**: 1% of all sessions
- **Error Sample Rate**: 100% of error sessions

### Privacy

- Text is masked by default
- Media is blocked
- Only DOM changes are recorded

## Debugging

### Local Development

Enable debug mode:

```bash
SENTRY_DEBUG=true npm run dev
```

### View Sentry Logs

```bash
# View Sentry CLI logs
SENTRY_DEBUG=true npx @sentry-cli info
```

## Troubleshooting

### Source Maps Not Working

1. Check `SENTRY_AUTH_TOKEN` is set
2. Ensure source maps are generated (`.next/static`)
3. Check release version matches

### Errors Not Appearing

1. Check DSN is correct
2. Verify `sentry.client.config.ts` is loaded
3. Check browser console for Sentry errors

### Performance Data Missing

1. Check `tracesSampleRate` is >0
2. Verify transactions are being created
3. Check Sentry dashboard for incoming data

## Commands Reference

```bash
# Environment variables
NEXT_PUBLIC_SENTRY_DSN=...  # Client DSN
SENTRY_DSN=...              # Server DSN
SENTRY_AUTH_TOKEN=...       # Auth token for source maps

# Source map upload
npx @sentry-cli releases files <release> upload-sourcemaps .next/static

# Check Sentry config
npx @sentry-cli info

# Create a release
npx @sentry-cli releases new <release>
npx @sentry-cli releases finalize <release>
```

## Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Session Replay](https://docs.sentry.io/product/session-replay/)
- [Sentry Alerting](https://docs.sentry.io/product/alerts/)
