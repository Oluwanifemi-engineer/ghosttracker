/**
 * Next.js Instrumentation
 *
 * This file is loaded before any server code runs.
 * It initializes Sentry and other monitoring tools.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side instrumentation
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime instrumentation
    await import("./sentry.edge.config");
  }
}
