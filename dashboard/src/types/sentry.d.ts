/**
 * Sentry Type Declarations
 *
 * These type declarations allow TypeScript to compile without
 * the actual @sentry/nextjs package installed.
 *
 * Once @sentry/nextjs is installed, these declarations will be
 * overridden by the package's own types.
 */

declare module '@sentry/nextjs' {
  export function init(options: any): void;
  export function captureException(error: Error | unknown, context?: any): string;
  export function captureMessage(message: string, level?: string): string;
  export function withScope(callback: (scope: SentryScope) => void): void;
  export function addBreadcrumb(breadcrumb: any): void;
  export function setUser(user: any | null): void;
  export function setTag(key: string, value: string): void;
  export function setContext(key: string, context: any): void;
  export function showReportDialog(options?: any): void;
  export function lastEventId(): string | undefined;

  export function startSpan<T>(
    context: { name: string; op: string },
    callback: () => Promise<T>
  ): Promise<T>;

  export const browserTracingIntegration: any;
  export const replayIntegration: any;

  interface SentryScope {
    setExtras(extras: Record<string, any>): void;
    setExtra(key: string, value: any): void;
    setTag(key: string, value: string): void;
    setContext(key: string, context: any): void;
    setMeasurement(key: string, value: number, unit: string): void;
  }
}

declare module '@sentry/react' {
  export function init(options: any): void;
  export function captureException(error: Error | unknown, context?: any): string;
  export function captureMessage(message: string, level?: string): string;
  export function withScope(callback: (scope: any) => void): void;
  export function setTag(key: string, value: string): void;
  export function setContext(key: string, context: any): void;
}
