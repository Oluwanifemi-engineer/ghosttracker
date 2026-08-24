'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: '#0a0a0f', color: 'white', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚨</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Application Error
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginBottom: '1rem', maxWidth: '400px', wordBreak: 'break-all' }}>
            {error.message || 'A client-side exception has occurred.'}
          </p>
          {error.digest && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.625rem', marginBottom: '1rem' }}>
              Digest: {error.digest}
            </p>
          )}
          <pre style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.625rem', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem', overflow: 'auto', maxHeight: '200px', maxWidth: '100%' }}>
            {error.stack || 'No stack trace available'}
          </pre>
          <button
            onClick={reset}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', backgroundColor: '#10B981', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
