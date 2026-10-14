import { useEffect, useState } from "react";
import type { HealthResponse } from "@ithaca/shared";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const res = await fetch(`${apiUrl}/health`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to reach API");
          setHealth(null);
        }
      }
    }

    void loadHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <h1>Project Ithaca</h1>
      <p className="tagline">Multi-agent B2B lead management</p>

      <section className="health">
        <h2>API health</h2>
        {error ? (
          <p className="error">Unable to reach API: {error}</p>
        ) : health ? (
          <ul>
            <li>Status: {health.ok ? "ok" : "error"}</li>
            <li>Database: {health.db}</li>
            <li>Orchestrator: {health.orchestrator ?? "n/a"}</li>
          </ul>
        ) : (
          <p>Checking…</p>
        )}
      </section>
    </main>
  );
}
