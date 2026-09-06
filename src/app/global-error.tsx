'use client';

// Root-level boundary (audit A26): survives layout-level failures that the
// nested error.tsx cannot catch.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f7f2ea', color: '#3a2f28' }}>
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Eclipsay hit an unexpected error.</h1>
          <p style={{ fontSize: 14, opacity: 0.75 }}>Please reload the app. Your data is stored locally and on your account.</p>
          <button
            onClick={reset}
            style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #d8cfc3', background: '#fff', cursor: 'pointer' }}
          >
            Reload
          </button>
          {error.digest && <small style={{ opacity: 0.6 }}>Reference: {error.digest}</small>}
        </div>
      </body>
    </html>
  );
}
