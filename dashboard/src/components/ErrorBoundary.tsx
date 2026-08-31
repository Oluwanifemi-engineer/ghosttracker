/**
 * Sentry Error Boundary Component
 *
 * Catches React component errors and reports them to Sentry.
 * Provides a fallback UI when errors occur.
 *
 * Usage:
 * ```tsx
 * <SentryErrorBoundary fallback={<ErrorFallback />}>
 *   <MyComponent />
 * </SentryErrorBoundary>
 * ```
 */

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SentryErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to Sentry
    Sentry.withScope((scope) => {
      scope.setExtras(errorInfo);
      scope.setTag("component", "ErrorBoundary");
      Sentry.captureException(error);
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Default fallback component
function DefaultErrorFallback({ error }: { error: Error | null }) {
  const handleRetry = () => {
    window.location.reload();
  };

  const handleReport = () => {
    Sentry.showReportDialog({
      eventId: Sentry.lastEventId(),
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        An unexpected error occurred. Our team has been notified and is
        investigating the issue.
      </p>

      {process.env.NODE_ENV === "development" && error && (
        <pre className="text-sm text-left bg-muted p-4 rounded-lg mb-6 max-w-2xl overflow-auto">
          {error.message}
          {error.stack && `\n\n${error.stack}`}
        </pre>
      )}

      <div className="flex gap-4">
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Try Again
        </button>
        <button
          onClick={handleReport}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
        >
          Report Issue
        </button>
      </div>
    </div>
  );
}

export { SentryErrorBoundary as ErrorBoundary };
export default SentryErrorBoundary;
