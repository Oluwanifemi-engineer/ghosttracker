/**
 * Sentry Server-Side Configuration
 *
 * This file initializes Sentry on the server side.
 * It captures backend errors and API performance metrics.
 *
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send PII
  sendDefaultPii: false,

  // beforeSend - filter sensitive data
  beforeSend(event) {
    // Remove API keys from headers
    if (event.request?.headers) {
      delete event.request.headers['X-API-Key'];
      delete event.request.headers['X-Device-Key'];
      delete event.request.headers['Authorization'];
    }

    // Remove sensitive form data
    if (event.request?.data) {
      const data = event.request.data;
      if (typeof data === 'object') {
        delete data.password;
        delete data.api_key;
        delete data.device_key;
        delete data.token;
      }
    }

    return event;
  },

  // beforeSendTransaction - filter health checks and static assets
  beforeSendTransaction(event) {
    const transaction = event.transaction || '';

    // Don't track health checks
    if (transaction.includes('/health')) {
      return null;
    }

    // Don't track static assets
    if (transaction.includes('/_next/static') || transaction.includes('/static')) {
      return null;
    }

    return event;
  },

  // Debug mode in development
  debug: process.env.NODE_ENV === "development",
});
