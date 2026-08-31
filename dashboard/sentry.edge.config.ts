/**
 * Sentry Edge Runtime Configuration
 *
 * This file initializes Sentry for Edge Runtime (middleware, edge functions).
 *
 * Docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/edge/
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

  // Debug mode in development
  debug: process.env.NODE_ENV === "development",
});
