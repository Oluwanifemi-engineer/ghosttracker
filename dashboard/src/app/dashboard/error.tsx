'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-white/50 text-sm font-mono mb-4 break-all">
          {error.message || 'Unknown error'}
        </p>
        {error.digest && (
          <p className="text-white/30 text-xs font-mono mb-4">
            Digest: {error.digest}
          </p>
        )}
        <pre className="text-white/30 text-xs font-mono text-left bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-4 overflow-auto max-h-40">
          {error.stack || 'No stack trace'}
        </pre>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
