import type { HealthResponse } from "@ithaca/shared";
import { create } from "zustand";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type HealthStatus = "idle" | "loading" | "ready" | "error";

type HealthStore = {
  health: HealthResponse | null;
  error: string | null;
  status: HealthStatus;
  loadHealth: (signal?: AbortSignal) => Promise<void>;
};

export const useHealthStore = create<HealthStore>((set) => ({
  health: null,
  error: null,
  status: "idle",
  loadHealth: async (signal) => {
    set({ status: "loading", error: null });

    try {
      const res = await fetch(`${apiUrl}/health`, { signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as HealthResponse;
      if (signal?.aborted) {
        return;
      }
      set({ health: data, error: null, status: "ready" });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      set({
        health: null,
        error: err instanceof Error ? err.message : "Failed to reach API",
        status: "error",
      });
    }
  },
}));
