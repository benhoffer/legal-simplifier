"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f9fafb" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "3rem", fontWeight: "bold", color: "#e5e7eb" }}>500</p>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#111827", marginTop: "1rem" }}>
              Server Error
            </h1>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginTop: "0.5rem" }}>
              {error.message || "Something went wrong on our end."}
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: "1.5rem",
                padding: "0.5rem 1.25rem",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
