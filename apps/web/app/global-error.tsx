'use client';

import { useEffect } from 'react';

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In Sprint 6 we wire Sentry here. For now just log.
    console.error('Global error boundary:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444' }}>
            Critical error
          </p>
          <h1 style={{ marginTop: '0.5rem', fontSize: '1.875rem', fontWeight: 600 }}>
            Something went seriously wrong
          </h1>
          <p style={{ marginTop: '1rem', maxWidth: '28rem', color: '#64748b' }}>
            Our team has been notified. Try refreshing — if it still won’t load, email support.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '2rem',
              padding: '0.625rem 1.5rem',
              background: '#0A2540',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
