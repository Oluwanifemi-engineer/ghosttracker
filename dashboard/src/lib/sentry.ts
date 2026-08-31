/**
 * Sentry Utility Functions
 *
 * Helper functions for Sentry error tracking and performance monitoring.
 *
 * Usage:
 * ```tsx
 * import { trackPageView, trackCommand, withSentrySpan } from '@/lib/sentry';
 *
 * // Track page views
 * trackPageView('/dashboard', { deviceCount: 5 });
 *
 * // Track custom transactions
 * trackCommand('lock', 'mt-1234', { success: true });
 *
 * // Wrap async operations with spans
 * const data = await withSentrySpan('fetchDevices', async () => {
 *   return await fetchDevices();
 * });
 * ```
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Track a page view with custom data
 */
export function trackPageView(
  path: string,
  data?: Record<string, string | number | boolean>
) {
  Sentry.withScope((scope) => {
    scope.setContext("page", { path, ...data });
    scope.setTag("page", path);
  });
}

/**
 * Track a user action
 */
export function trackAction(
  action: string,
  category: string,
  data?: Record<string, string | number | boolean>
) {
  Sentry.addBreadcrumb({
    category,
    message: action,
    level: "info",
    data,
  });
}

/**
 * Track a command execution
 */
export function trackCommand(
  command: string,
  deviceId: string,
  result: { success: boolean; duration?: number; error?: string }
) {
  Sentry.withScope((scope) => {
    scope.setTag("command", command);
    scope.setTag("deviceId", deviceId);
    scope.setTag("commandSuccess", result.success.toString());

    if (result.duration) {
      scope.setMeasurement("command.duration", result.duration, "millisecond");
    }

    if (!result.success && result.error) {
      scope.setExtra("error", result.error);
    }

    Sentry.captureMessage(
      `Command ${command} ${result.success ? "succeeded" : "failed"}`,
      result.success ? "info" : "warning"
    );
  });
}

/**
 * Track API performance
 */
export function trackApiCall(
  method: string,
  path: string,
  status: number,
  duration: number
) {
  Sentry.withScope((scope) => {
    scope.setTag("http.method", method);
    scope.setTag("http.status_code", status.toString());
    scope.setTag("http.url", path);
    scope.setMeasurement("http.duration", duration, "millisecond");

    Sentry.captureMessage(
      `API ${method} ${path} ${status}`,
      status >= 500 ? "error" : status >= 400 ? "warning" : "info"
    );
  });
}

/**
 * Wrap an async operation with a Sentry span
 */
export async function withSentrySpan<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: operation,
    },
    async () => {
      try {
        return await fn();
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    }
  );
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  tier?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Don't send PII
  });

  if (user.tier) {
    Sentry.setTag("user.tier", user.tier);
  }
}

/**
 * Clear user context
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Add a tag to the current scope
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

/**
 * Add context to the current scope
 */
export function setContext(
  key: string,
  context: Record<string, string | number | boolean | null | undefined>
) {
  Sentry.setContext(key, context);
}

/**
 * Capture a message with optional level
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" = "info"
) {
  Sentry.captureMessage(message, level);
}

/**
 * Capture an exception
 */
export function captureException(error: Error | unknown) {
  Sentry.captureException(error);
}
