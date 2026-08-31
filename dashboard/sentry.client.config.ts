/**
 * Sentry Client-Side Configuration
 *
 * This file initializes Sentry on the client side.
 * It captures frontend errors and performance metrics.
 *
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "unknown",

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay for debugging
  replaysSessionSampleRate: 0.01,  // 1% of sessions
  replaysOnErrorSampleRate: 1.0,    // 100% of error sessions

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Don't send PII
  sendDefaultPii: false,

  // beforeSend - filter sensitive data
  beforeSend(event) {
    // Remove auth tokens
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
    }

    // Remove cookies
    if (event.request?.cookies) {
      event.request.cookies = '[Filtered]';
    }

    return event;
  },

  // beforeSendTransaction - filter health checks
  beforeSendTransaction(event) {
    // Don't track health check requests
    if (event.transaction?.includes('/health')) {
      return null;
    }
    return event;
  },

  // Debug mode in development
  debug: process.env.NODE_ENV === "development",
});
