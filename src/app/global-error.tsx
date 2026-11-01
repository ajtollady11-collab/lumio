"use client";

/**
 * Last-resort boundary: replaces the root layout, so it cannot rely on the
 * app's fonts, CSS or providers. Kept intentionally self-contained.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#050816",
          color: "#edf1ff",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <main>
          <h1 style={{ fontSize: "1.625rem", margin: 0 }}>Lumio couldn&apos;t load</h1>
          <p style={{ color: "#a2adcf", maxWidth: 420, margin: "12px auto 0" }}>
            Something went wrong while starting the app. Try again in a moment.
          </p>
          {digest && <p style={{ color: "#6f7ba3", fontSize: 12, fontFamily: "monospace" }}>Reference {digest}</p>}
          <button
            onClick={() => retry()}
            style={{
              marginTop: 24,
              height: 44,
              padding: "0 20px",
              borderRadius: 12,
              border: 0,
              background: "#3b7bff",
              color: "white",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
