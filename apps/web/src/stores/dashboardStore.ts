import type { DashboardLead, DashboardResponse, DashboardUsageRow } from "@ithaca/shared";
import { create } from "zustand";
import { apiUrl, authToken, readJson } from "./api";
import type { RequestStatus } from "./api";

type DashboardStore = {
  leads: DashboardLead[];
  usage: DashboardUsageRow[];
  status: RequestStatus;
  message: string | null;
  loadDashboard: () => Promise<void>;
};

export const useDashboardStore = create<DashboardStore>()((set) => ({
  leads: [],
  usage: [],
  status: "idle",
  message: null,
  loadDashboard: async () => {
    const token = authToken();
    if (!token) {
      set({ status: "error", message: "Authentication required." });
      return;
    }

    set({ status: "loading", message: null });

    try {
      const res = await fetch(`${apiUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<
        Partial<DashboardResponse> & { message?: string }
      >(res);
      if (!res.ok || !("leads" in data) || !Array.isArray(data.leads)) {
        set({
          message: data.message ?? "Failed to reach API",
          status: "error",
        });
        return;
      }

      set({
        leads: data.leads ?? [],
        usage: data.usage ?? [],
        status: "ready",
        message: null,
      });
    } catch (err) {
      set({
        message: err instanceof Error ? err.message : "Failed to reach API",
        status: "error",
      });
    }
  },
}));
