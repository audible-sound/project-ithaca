import { useEffect } from "react";
import { useHealthStore } from "./stores/healthStore";

export function App() {
  const health = useHealthStore((state) => state.health);
  const error = useHealthStore((state) => state.error);
  const loadHealth = useHealthStore((state) => state.loadHealth);

  useEffect(() => {
    const controller = new AbortController();
    void loadHealth(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadHealth]);

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
