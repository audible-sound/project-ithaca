import type { LeadListItem, ListLeadListResponse } from "@ithaca/shared";
import { create } from "zustand";
import { apiUrl, authToken, readJson } from "./api";
import type { RequestStatus } from "./api";

type LeadStore = {
  leads: LeadListItem[];
  listStatus: RequestStatus;
  listMessage: string | null;
  loadLeads: () => Promise<void>;
};

export const useLeadStore = create<LeadStore>()((set) => ({
  leads: [],
  listStatus: "idle",
  listMessage: null,
  loadLeads: async () => {
    const token = authToken();
    if (!token) {
      set({ listStatus: "error", listMessage: "Authentication required." });
      return;
    }

    set({ listStatus: "loading", listMessage: null });

    try {
      const res = await fetch(`${apiUrl}/leads/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson<
        Partial<ListLeadListResponse> & { message?: string }
      >(res);
      if (!res.ok || !("leads" in data)) {
        set({
          listMessage: data.message ?? "Failed to reach API",
          listStatus: "error",
        });
        return;
      }

      set({
        leads: data.leads ?? [],
        listStatus: "ready",
        listMessage: null,
      });
    } catch (err) {
      set({
        listMessage: err instanceof Error ? err.message : "Failed to reach API",
        listStatus: "error",
      });
    }
  },
}));
