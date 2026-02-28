'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: '#050510', color: '#e0e0e0', fontFamily: 'system-ui' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h2>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.5rem 1.5rem',
                background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.3)',
                color: '#00d4ff',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
